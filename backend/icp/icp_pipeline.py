"""ICP learning pipeline — orchestrates customer research + ICP extraction."""

import asyncio
import logging

from sqlmodel import select

from backend.db import async_session
from backend.icp.customer_research import research_customer
from backend.icp.icp_extractor import extract_icp_rubrics
from backend.models import CustomerResearch, ICPProfile, ICPResearchStatus, Product

logger = logging.getLogger(__name__)


async def run_icp_learning(product_id: int, ws_manager) -> None:
    """Research a product's current clients and derive ICP rubrics.

    Phase 1: Research each customer (max 3 concurrent).
    Phase 2: Extract ICP rubrics from aggregated research.
    """
    async with async_session() as session:
        product = (
            await session.execute(select(Product).where(Product.id == product_id))
        ).scalar_one_or_none()

        if not product or not product.current_clients:
            logger.error(f"Product {product_id} not found or has no current_clients")
            return

        # Upsert ICPProfile
        icp = (
            await session.execute(
                select(ICPProfile).where(ICPProfile.product_id == product_id)
            )
        ).scalar_one_or_none()

        if not icp:
            icp = ICPProfile(product_id=product_id, status=ICPResearchStatus.RESEARCHING_CUSTOMERS)
            session.add(icp)
        else:
            icp.status = ICPResearchStatus.RESEARCHING_CUSTOMERS
            session.add(icp)
        await session.commit()
        await session.refresh(icp)

        await ws_manager.broadcast({
            "type": "icp_research_start",
            "product_id": product_id,
            "product_name": product.name,
            "total_customers": len(product.current_clients),
        })

        try:
            # Phase 1: Research customers
            semaphore = asyncio.Semaphore(3)
            customer_results: list[dict] = []

            async def _research_one(client_info: dict) -> dict:
                async with semaphore:
                    name = client_info.get("name", "Unknown")
                    url = client_info.get("website", "")
                    data = await research_customer(name, url)

                    # Save CustomerResearch row
                    async with async_session() as inner_session:
                        cr = CustomerResearch(
                            product_id=product_id,
                            customer_name=name,
                            customer_url=url,
                            industry=data.get("industry"),
                            employee_count=data.get("employee_count"),
                            revenue=data.get("revenue"),
                            funding_stage=data.get("funding_stage"),
                            geography=data.get("geography"),
                            description=data.get("description"),
                            tech_stack=data.get("tech_stack"),
                            raw_research=data,
                        )
                        inner_session.add(cr)
                        await inner_session.commit()

                    await ws_manager.broadcast({
                        "type": "icp_customer_complete",
                        "product_id": product_id,
                        "customer_name": name,
                    })

                    return data

            tasks = [_research_one(c) for c in product.current_clients]
            customer_results = await asyncio.gather(*tasks, return_exceptions=False)

            # Filter out errors
            valid_results = [r for r in customer_results if isinstance(r, dict) and "error" not in r]

            if not valid_results:
                icp.status = ICPResearchStatus.FAILED
                session.add(icp)
                await session.commit()
                await ws_manager.broadcast({
                    "type": "icp_failed",
                    "product_id": product_id,
                    "reason": "All customer research failed",
                })
                return

            # Phase 2: Extract ICP rubrics
            icp.status = ICPResearchStatus.EXTRACTING_ICP
            session.add(icp)
            await session.commit()

            rubrics = await extract_icp_rubrics(
                customer_data=valid_results,
                product_name=product.name,
                product_description=product.description,
            )

            # Save ICP profile
            icp.target_industries = rubrics.get("target_industries")
            icp.employee_range_min = rubrics.get("employee_range_min")
            icp.employee_range_max = rubrics.get("employee_range_max")
            icp.revenue_range = rubrics.get("revenue_range")
            icp.funding_stages = rubrics.get("funding_stages")
            icp.geographies = rubrics.get("geographies")
            icp.common_traits = rubrics.get("common_traits")
            icp.anti_patterns = rubrics.get("anti_patterns")
            icp.icp_summary = rubrics.get("icp_summary")
            icp.customers_researched = len(valid_results)
            icp.status = ICPResearchStatus.COMPLETE
            session.add(icp)
            await session.commit()

            await ws_manager.broadcast({
                "type": "icp_complete",
                "product_id": product_id,
                "product_name": product.name,
                "customers_researched": len(valid_results),
            })

        except Exception as e:
            logger.exception(f"ICP learning failed for product {product_id}")
            icp.status = ICPResearchStatus.FAILED
            session.add(icp)
            await session.commit()

            await ws_manager.broadcast({
                "type": "icp_failed",
                "product_id": product_id,
                "reason": str(e),
            })
