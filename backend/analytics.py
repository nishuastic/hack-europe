"""Analytics — SQL aggregations and Claude-powered conversion predictions."""

import json
import logging
import re
from difflib import SequenceMatcher

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


def _normalize_industry(name: str) -> str:
    """Normalize an industry string for grouping: lowercase, strip slashes, collapse whitespace."""
    name = name.strip().lower()
    # Split on common delimiters and take unique meaningful tokens
    tokens = re.split(r"[/,&]+", name)
    tokens = [t.strip() for t in tokens if t.strip()]
    # Rejoin sorted tokens for canonical form
    return " / ".join(tokens)


def _fuzzy_group_industries(raw: dict[str, int], threshold: float = 0.6) -> dict[str, int]:
    """Group industry labels that are similar using fuzzy matching.

    Uses token overlap + SequenceMatcher. The label with the highest count
    in a cluster becomes the canonical name.
    """
    # First pass: normalize
    normalized: dict[str, list[tuple[str, int]]] = {}
    for label, count in raw.items():
        norm = _normalize_industry(label)
        normalized.setdefault(norm, []).append((label, count))

    # Merge exact-normalized groups
    interim: dict[str, int] = {}
    canonical_labels: dict[str, str] = {}
    for norm, entries in normalized.items():
        total = sum(c for _, c in entries)
        # Pick the shortest original label as canonical (cleaner)
        best_label = min(entries, key=lambda e: len(e[0]))[0]
        interim[norm] = total
        canonical_labels[norm] = best_label

    # Second pass: fuzzy merge remaining similar groups
    norms = list(interim.keys())
    merged: dict[str, int] = {}
    used: set[int] = set()

    for i, n1 in enumerate(norms):
        if i in used:
            continue
        cluster_count = interim[n1]
        cluster_label = canonical_labels[n1]
        for j in range(i + 1, len(norms)):
            if j in used:
                continue
            n2 = norms[j]
            # Token overlap check
            tokens1 = set(n1.split())
            tokens2 = set(n2.split())
            overlap = len(tokens1 & tokens2) / max(len(tokens1 | tokens2), 1)
            seq_ratio = SequenceMatcher(None, n1, n2).ratio()
            if overlap >= threshold or seq_ratio >= threshold:
                cluster_count += interim[n2]
                # Keep the shorter/cleaner label
                if len(canonical_labels[n2]) < len(cluster_label):
                    cluster_label = canonical_labels[n2]
                used.add(j)
        merged[cluster_label] = cluster_count
        used.add(i)

    return merged


async def get_analytics(session: AsyncSession, user_id: int) -> dict:
    """Compute analytics dashboard data from SQL aggregations for a specific user."""
    # Total leads and enriched count for this user
    total_result = await session.execute(select(func.count(Lead.id)).where(Lead.user_id == user_id))  # type: ignore[arg-type]
    total_leads = total_result.scalar() or 0

    enriched_result = await session.execute(
        select(func.count(Lead.id)).where(Lead.enrichment_status == "complete", Lead.user_id == user_id)  # type: ignore[arg-type]
    )
    enriched_count = enriched_result.scalar() or 0

    # Industry breakdown (with fuzzy grouping)
    industry_rows = await session.execute(
        select(Lead.industry, func.count(Lead.id))  # type: ignore[arg-type]
        .where(Lead.industry.isnot(None), Lead.user_id == user_id)  # type: ignore[union-attr]
        .group_by(Lead.industry)
    )
    raw_industry_breakdown = {row[0]: row[1] for row in industry_rows.all()}
    industry_breakdown = _fuzzy_group_industries(raw_industry_breakdown)

    # Average ICP score by product (using Lead.icp_fit_score via ProductMatch join)
    avg_score_rows = await session.execute(
        select(Product.name, func.avg(Lead.icp_fit_score))
        .join(ProductMatch, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .join(Lead, Lead.id == ProductMatch.lead_id)  # type: ignore[arg-type]
        .where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[union-attr]
        .group_by(Product.name)
    )
    avg_icp_score_by_product = {row[0]: round(float(row[1]), 1) for row in avg_score_rows.all()}

    # Top 5 opportunities by ICP fit score
    top_rows = await session.execute(
        select(Lead, Product.name, ProductMatch.conversion_likelihood)
        .join(ProductMatch, Lead.id == ProductMatch.lead_id)  # type: ignore[arg-type]
        .join(Product, Product.id == ProductMatch.product_id)  # type: ignore[arg-type]
        .where(Lead.user_id == user_id, Lead.icp_fit_score.isnot(None))  # type: ignore[union-attr]
        .order_by(Lead.icp_fit_score.desc())  # type: ignore[union-attr]
        .limit(5)
    )
    top_opportunities = []
    for row in top_rows.all():
        lead, product_name, conversion_likelihood = row
        top_opportunities.append({
            "lead_id": lead.id,
            "company_name": lead.company_name,
            "product_name": product_name,
            "icp_score": lead.icp_fit_score,
            "conversion_likelihood": conversion_likelihood,
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

    return {
        "total_leads": total_leads,
        "enriched_count": enriched_count,
        "industry_breakdown": industry_breakdown,
        "avg_icp_score_by_product": avg_icp_score_by_product,
        "top_opportunities": top_opportunities,
        "signal_frequency": signal_frequency,
        "score_distribution": score_dist,
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
