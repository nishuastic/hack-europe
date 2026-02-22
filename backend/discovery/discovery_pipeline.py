"""Discovery pipeline — orchestrates ICP agent, creates Leads, kicks off enrichment."""

import asyncio
import logging
from typing import Any

from sqlmodel import select

from backend.billing import CREDIT_COSTS, check_credits, deduct_credits
from backend.db import async_session
from backend.discovery.icp_agent import run_discovery_agent
from backend.enrichment.pipeline import enrich_leads
from backend.models import CompanyProfile, EnrichmentStatus, GenerationRun, Lead, Product, UsageEventType

logger = logging.getLogger(__name__)


async def run_discovery(
    product_ids: list[int] | None,
    max_companies: int,
    ws_manager: Any,
    user_id: int,
    generation_run_id: int | None = None,
) -> None:
    """Full discovery pipeline: load products -> run agent -> create leads -> enrich.

    Runs as a background task (fire-and-forget from the API endpoint).
    """
    async with async_session() as session:
        # Always load all user products for full catalog context
        all_result = await session.execute(select(Product).where(Product.user_id == user_id))
        products = list(all_result.scalars().all())

        if not products:
            logger.error("No products found for discovery")
            await ws_manager.broadcast({
                "type": "discovery_error",
                "error": "No products found. Add products before running discovery.",
            })
            return

        # Derive selected_products from product_ids filter
        selected_products: list[Product] | None = None
        if product_ids:
            pid_set = set(product_ids)
            selected_products = [p for p in products if p.id in pid_set]
            if not selected_products:
                logger.error("No matching products found for given product_ids")
                await ws_manager.broadcast({
                    "type": "discovery_error",
                    "error": "No matching products found for the selected IDs.",
                })
                return

        # Load seller company profile (optional)
        cp_result = await session.execute(
            select(CompanyProfile).where(CompanyProfile.user_id == user_id)
        )
        company_profile = cp_result.scalars().first()

    # Broadcast start
    active_count = len(selected_products) if selected_products else len(products)
    await ws_manager.broadcast({
        "type": "discovery_start",
        "product_count": active_count,
        "max_companies": max_companies,
    })

    try:
        # Run the ICP discovery agent
        discovered = await run_discovery_agent(
            products, max_companies,
            selected_products=selected_products,
            ws_manager=ws_manager,
            company_profile=company_profile,
        )

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
                    generation_run_id=generation_run_id,
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

        # Update GenerationRun on completion
        if generation_run_id:
            async with async_session() as session:
                run = (await session.execute(
                    select(GenerationRun).where(GenerationRun.id == generation_run_id)
                )).scalar_one_or_none()
                if run:
                    run.lead_count = len(lead_ids)
                    run.status = "complete"
                    session.add(run)
                    await session.commit()

        # Broadcast completion
        await ws_manager.broadcast({
            "type": "discovery_complete",
            "companies_found": len(lead_ids),
            "lead_ids": lead_ids,
            "generation_run_id": generation_run_id,
        })

        # Auto-enrich discovered leads — deduct enrichment credits first
        if lead_ids:
            async with async_session() as credit_session:
                has_credits = await check_credits(
                    user_id, UsageEventType.ENRICHMENT, credit_session, quantity=len(lead_ids)
                )
                if has_credits:
                    await deduct_credits(
                        user_id, UsageEventType.ENRICHMENT, credit_session,
                        {"lead_ids": lead_ids},
                        quantity=len(lead_ids),
                    )
                    sc_used = len(lead_ids) * CREDIT_COSTS[UsageEventType.ENRICHMENT]
                    logger.info(f"Auto-enriching {len(lead_ids)} discovered leads (deducted {sc_used} SC)")
                    asyncio.create_task(enrich_leads(lead_ids, ws_manager))
                else:
                    logger.warning(f"Insufficient credits to auto-enrich {len(lead_ids)} leads — skipping enrichment")
                    await ws_manager.broadcast({
                        "type": "enrichment_skipped",
                        "reason": "insufficient_credits",
                        "lead_ids": lead_ids,
                    })

    except Exception as e:
        logger.exception("Discovery pipeline failed")
        # Update GenerationRun on failure
        if generation_run_id:
            try:
                async with async_session() as session:
                    run = (await session.execute(
                        select(GenerationRun).where(GenerationRun.id == generation_run_id)
                    )).scalar_one_or_none()
                    if run:
                        run.status = "failed"
                        session.add(run)
                        await session.commit()
            except Exception:
                logger.exception("Failed to update GenerationRun status")
        await ws_manager.broadcast({
            "type": "discovery_error",
            "error": str(e),
        })
