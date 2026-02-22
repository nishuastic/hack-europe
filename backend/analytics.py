"""Analytics — SQL aggregations and Claude-powered conversion predictions."""

import json
import logging
import re

import anthropic
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.billing import HOURS_SAVED, SDR_HOURLY_RATE
from backend.config import settings
from backend.models import GenerationRun, Lead, Product, ProductMatch, UsageEvent, UsageEventType

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


async def get_analytics(session: AsyncSession, user_id: int) -> dict:
    """Compute analytics dashboard data from SQL aggregations for a specific user."""
    # Total leads and enriched count for this user
    total_result = await session.execute(select(func.count(Lead.id)).where(Lead.user_id == user_id))  # type: ignore[arg-type]
    total_leads = total_result.scalar() or 0

    enriched_result = await session.execute(
        select(func.count(Lead.id)).where(Lead.enrichment_status == "complete", Lead.user_id == user_id)  # type: ignore[arg-type]
    )
    enriched_count = enriched_result.scalar() or 0

    # Average ICP score by product (via GenerationRun.product_names)
    lead_rows = await session.execute(
        select(Lead.icp_fit_score, GenerationRun.product_names)
        .join(GenerationRun, Lead.generation_run_id == GenerationRun.id)  # type: ignore[arg-type]
        .where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[union-attr]
    )
    product_scores: dict[str, list[float]] = {}
    for icp_score, product_names_raw in lead_rows.all():
        names = product_names_raw if isinstance(product_names_raw, list) else json.loads(product_names_raw)
        for name in names:
            product_scores.setdefault(name, []).append(float(icp_score))
    avg_icp_score_by_product = {
        name: round(sum(scores) / len(scores), 1)
        for name, scores in product_scores.items()
    }

    # Top 5 opportunities by ICP fit score (via GenerationRun.product_names)
    top_lead_rows = await session.execute(
        select(Lead, GenerationRun.product_names)
        .join(GenerationRun, Lead.generation_run_id == GenerationRun.id)  # type: ignore[arg-type]
        .where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[union-attr]
        .order_by(Lead.icp_fit_score.desc())  # type: ignore[union-attr]
        .limit(5)
    )
    top_opportunities = []
    for lead, product_names_raw in top_lead_rows.all():
        names = product_names_raw if isinstance(product_names_raw, list) else json.loads(product_names_raw)
        product_name = names[0] if names else "Unknown"
        top_opportunities.append({
            "lead_id": lead.id,
            "company_name": lead.company_name,
            "product_name": product_name,
            "icp_score": lead.icp_fit_score,
        })

    # Buying signal frequency — count signals across all leads
    signal_frequency: dict[str, int] = {}
    leads_with_signals = await session.execute(
        select(Lead.buying_signals).where(Lead.buying_signals.isnot(None), Lead.user_id == user_id)  # type: ignore[union-attr]
    )
    for (signals_raw,) in leads_with_signals.all():
        if not signals_raw:
            continue
        signals = signals_raw if isinstance(signals_raw, list) else json.loads(signals_raw)
        for sig in signals:
            sig_type = sig.get("signal_type", "unknown") if isinstance(sig, dict) else "unknown"
            signal_frequency[sig_type] = signal_frequency.get(sig_type, 0) + 1

    # ICP score distribution buckets (0-100 scale)
    score_dist: dict[str, int] = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    all_scores = await session.execute(
        select(Lead.icp_fit_score)
        .where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[union-attr]
    )
    for (score,) in all_scores.all():
        if score <= 20:
            score_dist["0-20"] += 1
        elif score <= 40:
            score_dist["21-40"] += 1
        elif score <= 60:
            score_dist["41-60"] += 1
        elif score <= 80:
            score_dist["61-80"] += 1
        else:
            score_dist["81-100"] += 1

    # Top ICP score
    top_score_result = await session.execute(
        select(func.max(Lead.icp_fit_score)).where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[arg-type,union-attr]
    )
    top_icp_score = top_score_result.scalar()

    # Hours and dollars saved
    usage_rows = await session.execute(
        select(UsageEvent.event_type, func.count(UsageEvent.id))  # type: ignore[arg-type]
        .where(UsageEvent.user_id == user_id)
        .group_by(UsageEvent.event_type)
    )
    total_hours = 0.0
    actions_breakdown: dict[str, int] = {}
    for event_type_val, count in usage_rows.all():
        evt = UsageEventType(event_type_val) if isinstance(event_type_val, str) else event_type_val
        actions_breakdown[event_type_val if isinstance(event_type_val, str) else evt.value] = count
        total_hours += HOURS_SAVED.get(evt, 0.0) * count
    total_dollars = round(total_hours * SDR_HOURLY_RATE, 2)

    return {
        "total_leads": total_leads,
        "enriched_count": enriched_count,
        "avg_icp_score_by_product": avg_icp_score_by_product,
        "top_opportunities": top_opportunities,
        "signal_frequency": signal_frequency,
        "score_distribution": score_dist,
        "top_icp_score": top_icp_score,
        "hours_saved": round(total_hours, 1),
        "dollars_saved": total_dollars,
        "actions_breakdown": actions_breakdown,
    }


async def predict_conversions(ws_manager, session: AsyncSession, user_id: int) -> None:
    """Use Claude to predict conversion likelihood for matches missing it for a specific user."""
    matches_result = await session.execute(
        select(ProductMatch, Lead, Product)
        .join(Lead, Lead.id == ProductMatch.lead_id)  # type: ignore[arg-type]
        .join(Product, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .where(ProductMatch.conversion_likelihood.is_(None), Lead.user_id == user_id)  # type: ignore[union-attr]
    )
    rows = matches_result.all()
    if not rows:
        return

    for match_obj, lead, product in rows:
        try:
            message = await _get_claude_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=500,
                system=(
                    "You predict B2B conversion likelihood. Return ONLY JSON: "
                    '{"conversion_likelihood": "high|medium|low", "conversion_reasoning": "1-2 sentences"}'
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Company: {lead.company_name}, Industry: {lead.industry}, "
                        f"Funding: {lead.funding}, Employees: {lead.employees}\n"
                        f"Product: {product.name}\n"
                        f"Match score: {match_obj.match_score}/10\n"
                        f"Match reasoning: {match_obj.match_reasoning}\n"
                        f"Predict conversion likelihood."
                    ),
                }],
            )

            text_resp: str = message.content[0].text  # type: ignore[union-attr]
            try:
                parsed = json.loads(text_resp)
            except json.JSONDecodeError:
                fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text_resp)
                parsed = json.loads(fence_match.group(1).strip()) if fence_match else {}

            match_obj.conversion_likelihood = parsed.get("conversion_likelihood")
            match_obj.conversion_reasoning = parsed.get("conversion_reasoning")
            session.add(match_obj)
            await session.commit()

            await ws_manager.broadcast({
                "type": "prediction_update",
                "lead_id": match_obj.lead_id,
                "product_id": match_obj.product_id,
                "conversion_likelihood": match_obj.conversion_likelihood,
                "conversion_reasoning": match_obj.conversion_reasoning,
            })

        except Exception as e:
            logger.exception(f"Prediction failed for match {match_obj.id}: {e}")
