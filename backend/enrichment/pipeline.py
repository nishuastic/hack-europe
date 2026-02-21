"""Enrichment pipeline — orchestrates search → Claude → save → WS broadcast."""

import asyncio
import logging

from sqlmodel import select

from backend.db import async_session
from backend.enrichment.claude_enricher import extract_lead_data
from backend.enrichment.linkup_search import search_company
from backend.models import EnrichmentStatus, Lead

logger = logging.getLogger(__name__)

# Fields to broadcast individually for the live "cells filling in" effect
BROADCAST_FIELDS = [
    "description", "industry", "funding", "revenue", "employees",
    "contacts", "customers", "buying_signals",
]


async def enrich_lead(lead_id: int, ws_manager) -> None:
    """Enrich a single lead: search → Claude → save → broadcast."""
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
            # Step 1: Parallel web searches
            raw_research = await search_company(lead.company_name)

            # Step 2: Claude extraction
            extracted = await extract_lead_data(lead.company_name, raw_research)

            # Step 3: Save + broadcast each field individually
            for field in BROADCAST_FIELDS:
                value = extracted.get(field)
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
                    # Small delay for visual streaming effect
                    await asyncio.sleep(0.15)

            # Mark complete
            lead.enrichment_status = EnrichmentStatus.COMPLETE
            session.add(lead)
            await session.commit()

            await ws_manager.broadcast({
                "type": "enrichment_complete",
                "lead_id": lead_id,
                "company_name": lead.company_name,
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
