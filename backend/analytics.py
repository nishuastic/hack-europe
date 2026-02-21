"""Analytics — SQL aggregations and Claude-powered conversion predictions."""

import json
import logging
import re

import anthropic
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.config import settings
from backend.models import Lead, Product, ProductMatch

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


async def get_analytics(session: AsyncSession) -> dict:
    """Compute analytics dashboard data from SQL aggregations."""
    # Total leads and enriched count
    total_result = await session.execute(select(func.count(Lead.id)))  # type: ignore[arg-type]
    total_leads = total_result.scalar() or 0

    enriched_result = await session.execute(
        select(func.count(Lead.id)).where(Lead.enrichment_status == "complete")  # type: ignore[arg-type]
    )
    enriched_count = enriched_result.scalar() or 0

    # Industry breakdown
    industry_rows = await session.execute(
        select(Lead.industry, func.count(Lead.id))  # type: ignore[arg-type]
        .where(Lead.industry.isnot(None))  # type: ignore[union-attr]
        .group_by(Lead.industry)
    )
    industry_breakdown = {row[0]: row[1] for row in industry_rows.all()}

    # Average match score by product
    avg_score_rows = await session.execute(
        select(Product.name, func.avg(ProductMatch.match_score))
        .join(Product, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .group_by(Product.name)
    )
    avg_match_score_by_product = {row[0]: round(float(row[1]), 2) for row in avg_score_rows.all()}

    # Top 5 opportunities by match score
    top_rows = await session.execute(
        select(ProductMatch, Lead.company_name, Product.name)
        .join(Lead, Lead.id == ProductMatch.lead_id)  # type: ignore[arg-type]
        .join(Product, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .order_by(ProductMatch.match_score.desc())  # type: ignore[attr-defined]
        .limit(5)
    )
    top_opportunities = []
    for row in top_rows.all():
        match_obj, company_name, product_name = row
        top_opportunities.append({
            "lead_id": match_obj.lead_id,
            "company_name": company_name,
            "product_id": match_obj.product_id,
            "product_name": product_name,
            "match_score": match_obj.match_score,
            "conversion_likelihood": match_obj.conversion_likelihood,
        })

    # Buying signal frequency — count signals across all leads
    signal_frequency: dict[str, int] = {}
    leads_with_signals = await session.execute(
        select(Lead.buying_signals).where(Lead.buying_signals.isnot(None))  # type: ignore[union-attr]
    )
    for (signals_raw,) in leads_with_signals.all():
        if not signals_raw:
            continue
        signals = signals_raw if isinstance(signals_raw, list) else json.loads(signals_raw)
        for sig in signals:
            sig_type = sig.get("signal_type", "unknown") if isinstance(sig, dict) else "unknown"
            signal_frequency[sig_type] = signal_frequency.get(sig_type, 0) + 1

    # Score distribution buckets
    score_dist: dict[str, int] = {"1-3": 0, "4-6": 0, "7-10": 0}
    all_scores = await session.execute(select(ProductMatch.match_score))
    for (score,) in all_scores.all():
        if score <= 3:
            score_dist["1-3"] += 1
        elif score <= 6:
            score_dist["4-6"] += 1
        else:
            score_dist["7-10"] += 1

    return {
        "total_leads": total_leads,
        "enriched_count": enriched_count,
        "industry_breakdown": industry_breakdown,
        "avg_match_score_by_product": avg_match_score_by_product,
        "top_opportunities": top_opportunities,
        "signal_frequency": signal_frequency,
        "score_distribution": score_dist,
    }


async def predict_conversions(ws_manager, session: AsyncSession) -> None:
    """Use Claude to predict conversion likelihood for matches missing it."""
    matches_result = await session.execute(
        select(ProductMatch, Lead, Product)
        .join(Lead, Lead.id == ProductMatch.lead_id)  # type: ignore[arg-type]
        .join(Product, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .where(ProductMatch.conversion_likelihood.is_(None))  # type: ignore[union-attr]
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
