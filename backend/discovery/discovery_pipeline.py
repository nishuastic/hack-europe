"""Discovery pipeline — orchestrates ICP agent, creates Leads, kicks off enrichment."""

import asyncio
import logging
from typing import Any

from sqlmodel import select

from backend.db import async_session
from backend.discovery.icp_agent import run_discovery_agent
from backend.enrichment.pipeline import enrich_leads
from backend.models import EnrichmentStatus, Lead, Product

logger = logging.getLogger(__name__)


async def run_discovery(
    product_ids: list[int] | None,
    max_companies: int,
    ws_manager: Any,
    user_id: int,
) -> None:
    """Full discovery pipeline: load products -> run agent -> create leads -> enrich.

    Runs as a background task (fire-and-forget from the API endpoint).
    """
    async with async_session() as session:
        # Load products
        if product_ids:
            result = await session.execute(
                select(Product).where(Product.id.in_(product_ids), Product.user_id == user_id)  # type: ignore[union-attr]
            )
        else:
            result = await session.execute(select(Product).where(Product.user_id == user_id))
        products = list(result.scalars().all())

        if not products:
            logger.error("No products found for discovery")
            await ws_manager.broadcast({
                "type": "discovery_error",
                "error": "No products found. Add products before running discovery.",
            })
            return

    # Broadcast start
    await ws_manager.broadcast({
        "type": "discovery_start",
        "product_count": len(products),
        "max_companies": max_companies,
    })

    try:
        # Run the ICP discovery agent
        discovered = await run_discovery_agent(products, max_companies, ws_manager)

        if not discovered:
            logger.warning("Discovery agent returned no companies")
            await ws_manager.broadcast({
                "type": "discovery_complete",
                "companies_found": 0,
                "lead_ids": [],
            })
            return

        # Create Lead rows for each discovered company
        lead_ids: list[int] = []
        async with async_session() as session:
            for company in discovered:
                company_name = company.get("company_name", "").strip()
                if not company_name:
                    continue

                # Dedup: skip if Lead with same company_name already exists
                existing = (
                    await session.execute(
                        select(Lead).where(Lead.company_name == company_name)
                    )
                ).scalar_one_or_none()
                if existing:
                    logger.info(f"Skipping duplicate: {company_name}")
                    continue

                lead = Lead(
                    user_id=user_id,
                    company_name=company_name,
                    company_url=company.get("company_url"),
                    description=company.get("description"),
                    industry=company.get("industry"),
                    funding=company.get("funding"),
                    revenue=company.get("revenue"),
                    employees=company.get("employees"),
                    enrichment_status=EnrichmentStatus.PENDING,
                )
                session.add(lead)
                await session.commit()
                await session.refresh(lead)
                assert lead.id is not None
                lead_ids.append(lead.id)

                await ws_manager.broadcast({
                    "type": "company_discovered",
                    "lead_id": lead.id,
                    "company_name": company_name,
                    "company_url": company.get("company_url"),
                    "why_good_fit": company.get("why_good_fit", ""),
                })

        # Broadcast completion
        await ws_manager.broadcast({
            "type": "discovery_complete",
            "companies_found": len(lead_ids),
            "lead_ids": lead_ids,
        })

        # Auto-enrich discovered leads
        if lead_ids:
            logger.info(f"Auto-enriching {len(lead_ids)} discovered leads")
            asyncio.create_task(enrich_leads(lead_ids, ws_manager))

    except Exception as e:
        logger.exception("Discovery pipeline failed")
        await ws_manager.broadcast({
            "type": "discovery_error",
            "error": str(e),
        })
