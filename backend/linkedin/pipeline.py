"""LinkedIn import pipeline — save connections, match to leads, generate outreach."""

import asyncio
import logging

from sqlmodel import select

from backend.billing import check_credits, deduct_credits
from backend.linkedin.matching import find_matches
from backend.linkedin.outreach_generator import generate_outreach_plan
from backend.models import (
    CompanyProfile,
    Lead,
    LinkedInConnection,
    LinkedInMatch,
    LinkedInMatchStatus,
    ProductMatch,
    UsageEventType,
)

logger = logging.getLogger(__name__)


async def process_linkedin_import(
    user_id: int,
    connections: list[dict],
    ws_manager: object,
    session_factory: object,
) -> None:
    """Process a LinkedIn import: save connections, match to leads, generate outreach.

    Args:
        user_id: The user's ID
        connections: Parsed connection dicts from CSV
        ws_manager: WebSocket ConnectionManager with broadcast() method
        session_factory: Async session factory callable
    """
    broadcast = getattr(ws_manager, "broadcast", None)

    async def _broadcast(data: dict) -> None:
        if broadcast:
            await broadcast(data)

    try:
        async with session_factory() as session:  # type: ignore[operator]
            # 1. Save connections
            conn_records: list[LinkedInConnection] = []
            for c in connections:
                rec = LinkedInConnection(
                    user_id=user_id,
                    first_name=c["first_name"],
                    last_name=c["last_name"],
                    email=c.get("email"),
                    company=c.get("company"),
                    position=c.get("position"),
                    connected_on=c.get("connected_on"),
                )
                session.add(rec)
                conn_records.append(rec)
            await session.commit()
            for rec in conn_records:
                await session.refresh(rec)

            # 2. Load user's leads
            result = await session.execute(select(Lead).where(Lead.user_id == user_id))
            leads = result.scalars().all()

            await _broadcast({
                "type": "linkedin_import_start",
                "total_connections": len(conn_records),
                "total_leads": len(leads),
            })

            if not leads:
                await _broadcast({
                    "type": "linkedin_import_complete",
                    "total_matches": 0,
                    "total_outreach_plans": 0,
                })
                return

            # 3. Run fuzzy matching
            conn_dicts = [
                {"id": r.id, "company": r.company}
                for r in conn_records
            ]
            lead_dicts = [
                {"id": ld.id, "company_name": ld.company_name}
                for ld in leads
            ]
            raw_matches = find_matches(conn_dicts, lead_dicts)

            # 4. Save match records
            match_records: list[LinkedInMatch] = []
            for conn_id, lead_id, confidence in raw_matches:
                match_rec = LinkedInMatch(
                    user_id=user_id,
                    connection_id=conn_id,
                    lead_id=lead_id,
                    match_confidence=confidence,
                    status=LinkedInMatchStatus.PENDING,
                )
                session.add(match_rec)
                match_records.append(match_rec)
            await session.commit()
            for m_rec in match_records:
                await session.refresh(m_rec)

            # Broadcast match found events
            conn_by_id = {r.id: r for r in conn_records}
            lead_by_id = {ld.id: ld for ld in leads}
            for match_rec in match_records:
                conn_rec = conn_by_id.get(match_rec.connection_id)
                lead_rec = lead_by_id.get(match_rec.lead_id)
                if conn_rec and lead_rec:
                    await _broadcast({
                        "type": "linkedin_match_found",
                        "connection_name": f"{conn_rec.first_name} {conn_rec.last_name}",
                        "lead_id": match_rec.lead_id,
                        "company_name": lead_rec.company_name,
                        "confidence": match_rec.match_confidence,
                    })

            # 5. Generate outreach plans (semaphore-limited)
            sem = asyncio.Semaphore(3)
            outreach_count = 0

            # Load company profile once
            profile_result = await session.execute(
                select(CompanyProfile).where(CompanyProfile.user_id == user_id)
            )
            profile = profile_result.scalar_one_or_none()
            profile_dict = None
            if profile:
                profile_dict = {
                    "company_name": profile.company_name,
                    "value_proposition": profile.value_proposition,
                }

            async def _generate_for_match(match_rec: LinkedInMatch) -> None:
                nonlocal outreach_count
                async with sem:
                    try:
                        # Check credits
                        async with session_factory() as gen_session:  # type: ignore[operator]
                            has_credits = await check_credits(
                                user_id, UsageEventType.LINKEDIN_OUTREACH, gen_session
                            )
                            if not has_credits:
                                logger.warning("Insufficient credits for outreach, skipping match %s", match_rec.id)
                                return

                            conn_rec = conn_by_id.get(match_rec.connection_id)
                            lead_rec = lead_by_id.get(match_rec.lead_id)
                            if not conn_rec or not lead_rec:
                                return

                            # Update status
                            match_db = (await gen_session.execute(
                                select(LinkedInMatch).where(LinkedInMatch.id == match_rec.id)
                            )).scalar_one_or_none()
                            if not match_db:
                                return
                            match_db.status = LinkedInMatchStatus.GENERATING
                            gen_session.add(match_db)
                            await gen_session.commit()

                            # Get product match if available
                            pm_result = await gen_session.execute(
                                select(ProductMatch)
                                .where(ProductMatch.lead_id == lead_rec.id)
                                .order_by(ProductMatch.match_score.desc())  # type: ignore[attr-defined]
                            )
                            pm = pm_result.scalar_one_or_none()
                            pm_dict = None
                            if pm:
                                pm_dict = {
                                    "product_name": "",
                                    "match_score": pm.match_score,
                                    "match_reasoning": pm.match_reasoning,
                                }

                            conn_dict = {
                                "first_name": conn_rec.first_name,
                                "last_name": conn_rec.last_name,
                                "position": conn_rec.position,
                                "company": conn_rec.company,
                            }
                            lead_dict = {
                                "company_name": lead_rec.company_name,
                                "description": lead_rec.description,
                                "industry": lead_rec.industry,
                                "funding": lead_rec.funding,
                                "employees": lead_rec.employees,
                            }

                            outreach = await generate_outreach_plan(
                                conn_dict, lead_dict, pm_dict, profile_dict
                            )

                            # Save outreach plan
                            match_db.outreach_plan = outreach.model_dump()  # type: ignore[assignment]
                            match_db.status = LinkedInMatchStatus.COMPLETE
                            gen_session.add(match_db)
                            await deduct_credits(
                                user_id, UsageEventType.LINKEDIN_OUTREACH, gen_session,
                                {"match_id": match_rec.id},
                            )
                            await gen_session.commit()
                            outreach_count += 1

                            await _broadcast({
                                "type": "linkedin_outreach_generated",
                                "match_id": match_rec.id,
                                "connection_name": f"{conn_rec.first_name} {conn_rec.last_name}",
                                "company_name": lead_rec.company_name,
                            })

                    except Exception:
                        logger.exception("Failed to generate outreach for match %s", match_rec.id)
                        try:
                            async with session_factory() as err_session:  # type: ignore[operator]
                                match_db = (await err_session.execute(
                                    select(LinkedInMatch).where(LinkedInMatch.id == match_rec.id)
                                )).scalar_one_or_none()
                                if match_db:
                                    match_db.status = LinkedInMatchStatus.FAILED
                                    err_session.add(match_db)
                                    await err_session.commit()
                        except Exception:
                            logger.exception("Failed to update match status to FAILED")

            tasks = [_generate_for_match(m) for m in match_records]
            await asyncio.gather(*tasks)

            await _broadcast({
                "type": "linkedin_import_complete",
                "total_matches": len(match_records),
                "total_outreach_plans": outreach_count,
            })

    except Exception as e:
        logger.exception("LinkedIn import pipeline failed")
        await _broadcast({"type": "linkedin_import_error", "error": str(e)})
