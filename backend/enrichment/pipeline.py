"""Enrichment pipeline — multi-agent orchestrator with iterative follow-up."""

import asyncio
import logging

from sqlmodel import select

from backend.db import async_session
from backend.enrichment.agents.data_extractor import ExtractionResult, extract_lead_data
from backend.enrichment.agents.query_planner import plan_queries
from backend.enrichment.agents.search_executor import execute_searches
from backend.models import EnrichmentStatus, Lead

logger = logging.getLogger(__name__)

# Fields to broadcast individually for the live "cells filling in" effect
BROADCAST_FIELDS = [
    "description", "industry", "funding", "revenue", "employees",
    "contacts", "customers", "buying_signals",
]

# Important fields that justify a follow-up round if missing
_IMPORTANT_FIELDS = {"description", "funding", "industry", "contacts", "buying_signals"}

# Max enrichment rounds (1 broad + 1 targeted follow-up)
MAX_ROUNDS = 2


def _should_follow_up(extraction: ExtractionResult, round_num: int) -> bool:
    """Decide whether to do a follow-up round based on gaps in important fields."""
    if round_num >= MAX_ROUNDS:
        return False
    important_gaps = [g for g in extraction.gaps if g in _IMPORTANT_FIELDS]
    return len(important_gaps) > 0


async def enrich_lead(lead_id: int, ws_manager) -> None:  # noqa: C901
    """Enrich a single lead using the 3-agent pipeline with iterative follow-up."""
    async with async_session() as session:
        lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
        if not lead:
            logger.error(f"Lead {lead_id} not found")
            return

        # Mark in-progress
        lead.enrichment_status = EnrichmentStatus.IN_PROGRESS
        session.add(lead)
        await session.commit()

        await ws_manager.broadcast({
            "type": "enrichment_start",
            "lead_id": lead_id,
            "company_name": lead.company_name,
        })

        try:
            existing_data: dict | None = None
            current_gaps: list[str] = []
            current_hints: list[str] = []
            round_num = 0

            while round_num < MAX_ROUNDS:
                round_num += 1
                logger.info(f"Lead {lead_id} ({lead.company_name}): starting round {round_num}")

                # ── Agent 1: Query Planner ──
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "planning_queries",
                    "detail": f"Round {round_num}: Planning search queries",
                    "queries": [],
                })

                search_plan = await plan_queries(
                    company_name=lead.company_name,
                    company_url=lead.company_url,
                    existing_context=existing_data,
                    gaps=current_gaps if round_num > 1 else None,
                    follow_up_hints=current_hints if round_num > 1 else None,
                )

                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "planning_queries",
                    "detail": f"Round {round_num}: Planning {len(search_plan)} searches",
                    "queries": search_plan.query_texts,
                })

                # ── Agent 2: Search Executor ──
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "executing_searches",
                    "detail": f"Running {len(search_plan)} LinkUp searches in parallel",
                })

                search_results = await execute_searches(search_plan)

                # ── Agent 3: Data Extractor ──
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "extracting_data",
                    "detail": f"Analyzing {len(search_results)} search results with Claude",
                })

                extraction = await extract_lead_data(
                    company_name=lead.company_name,
                    search_results=search_results,
                    existing_data=existing_data,
                )

                # Save + broadcast extracted fields
                for field in BROADCAST_FIELDS:
                    value = extraction.data.get(field)
                    if value is not None:
                        setattr(lead, field, value)
                        session.add(lead)
                        await session.commit()

                        await ws_manager.broadcast({
                            "type": "cell_update",
                            "lead_id": lead_id,
                            "field": field,
                            "value": value,
                        })
                        await asyncio.sleep(0.15)

                # Update state for potential follow-up
                existing_data = extraction.data
                current_gaps = extraction.gaps
                current_hints = extraction.follow_up_hints

                # ── Follow-up decision ──
                if _should_follow_up(extraction, round_num):
                    important_gaps = [g for g in extraction.gaps if g in _IMPORTANT_FIELDS]
                    await ws_manager.broadcast({
                        "type": "agent_thinking",
                        "lead_id": lead_id,
                        "round": round_num,
                        "action": "follow_up_needed",
                        "detail": f"Gaps in: {', '.join(important_gaps)}. Starting round {round_num + 1}.",
                    })
                    continue
                else:
                    break

            # Mark complete
            lead.enrichment_status = EnrichmentStatus.COMPLETE
            session.add(lead)
            await session.commit()

            await ws_manager.broadcast({
                "type": "enrichment_complete",
                "lead_id": lead_id,
                "company_name": lead.company_name,
                "rounds": round_num,
            })

        except Exception as e:
            logger.exception(f"Enrichment failed for lead {lead_id}")
            lead.enrichment_status = EnrichmentStatus.FAILED
            session.add(lead)
            await session.commit()

            await ws_manager.broadcast({
                "type": "enrichment_error",
                "lead_id": lead_id,
                "error": str(e),
            })


async def enrich_leads(lead_ids: list[int], ws_manager) -> None:
    """Enrich multiple leads with concurrency limit."""
    semaphore = asyncio.Semaphore(3)

    async def _limited(lead_id: int):
        async with semaphore:
            await enrich_lead(lead_id, ws_manager)

    await asyncio.gather(*[_limited(lid) for lid in lead_ids])
