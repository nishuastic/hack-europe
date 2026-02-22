"""Enrichment pipeline — 2-round orchestrator with single LinkUp call per round."""

import asyncio
import logging

from sqlmodel import select

from backend.db import async_session
from backend.enrichment.agents.data_extractor import ExtractionResult, extract_lead_data
from backend.enrichment.agents.search_executor import execute_single_enrichment_search
from backend.models import EnrichmentStatus, GenerationRun, ICPProfile, ICPResearchStatus, Lead

logger = logging.getLogger(__name__)

# Fields to broadcast individually for the live "cells filling in" effect
BROADCAST_FIELDS = [
    "description", "industry", "funding", "revenue", "employees",
    "contacts", "customers", "company_fit", "buying_signals",
    "icp_fit_score", "icp_fit_reasoning",
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
    """Enrich a single lead: 1 LinkUp call per round → Claude validates → optional round 2."""
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

        # Load ICP context if available for this lead's products
        icp_context: str | None = None
        if lead.generation_run_id:
            gen_run = (
                await session.execute(
                    select(GenerationRun).where(GenerationRun.id == lead.generation_run_id)
                )
            ).scalar_one_or_none()
            if gen_run and gen_run.product_ids:
                for pid in gen_run.product_ids:
                    icp = (
                        await session.execute(
                            select(ICPProfile).where(
                                ICPProfile.product_id == pid,
                                ICPProfile.status == ICPResearchStatus.COMPLETE,
                            )
                        )
                    ).scalar_one_or_none()
                    if icp:
                        parts = []
                        if icp.icp_summary:
                            parts.append(f"Summary: {icp.icp_summary}")
                        if icp.target_industries:
                            parts.append(f"Target Industries: {', '.join(icp.target_industries)}")
                        if icp.employee_range_min or icp.employee_range_max:
                            emp_min = icp.employee_range_min or "?"
                            emp_max = icp.employee_range_max or "?"
                            parts.append(f"Employee Range: {emp_min} - {emp_max}")
                        if icp.revenue_range:
                            parts.append(f"Revenue Range: {icp.revenue_range}")
                        if icp.funding_stages:
                            parts.append(f"Funding Stages: {', '.join(icp.funding_stages)}")
                        if icp.geographies:
                            parts.append(f"Geographies: {', '.join(icp.geographies)}")
                        if icp.common_traits:
                            parts.append(f"Common Traits: {', '.join(icp.common_traits)}")
                        if icp.anti_patterns:
                            parts.append(f"Anti-Patterns: {', '.join(icp.anti_patterns)}")
                        icp_context = "\n".join(parts)
                        break  # Use first available ICP

        try:
            existing_data: dict | None = None
            current_gaps: list[str] = []
            round_num = 0

            while round_num < MAX_ROUNDS:
                round_num += 1
                logger.info(f"Lead {lead_id} ({lead.company_name}): starting round {round_num}")

                # ── Single LinkUp structured call ──
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "executing_searches",
                    "detail": f"Round {round_num}: Searching LinkUp for all enrichment data (1 call)",
                })

                search_result = await execute_single_enrichment_search(
                    company_name=lead.company_name,
                    company_url=lead.company_url,
                    gaps=current_gaps if round_num > 1 else None,
                    existing_context=existing_data if round_num > 1 else None,
                )

                # ── Claude validates + extracts structured data ──
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead_id,
                    "round": round_num,
                    "action": "extracting_data",
                    "detail": f"Round {round_num}: Claude validating and structuring data",
                })

                extraction = await extract_lead_data(
                    company_name=lead.company_name,
                    search_results=[search_result],
                    existing_data=existing_data,
                    icp_context=icp_context,
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
