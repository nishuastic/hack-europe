"""Product matching pipeline — uses Claude to match all products against each enriched lead."""

import json
import logging
import re

import anthropic

from backend.config import settings
from backend.db import async_session
from backend.models import EnrichmentStatus, Lead, Product, ProductMatch

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Prompt (inline fallback) ────────────────────────────────────────────

_FALLBACK_SYSTEM_PROMPT = """\
You are an expert B2B sales analyst. Given a target company's profile and a catalog of products, \
rank how well each product fits the company.

Return ONLY valid JSON with this structure:
{
  "matches": [
    {
      "product_id": 1,
      "match_score": 8.5,
      "match_reasoning": "Why this product fits this company",
      "conversion_likelihood": "high",
      "conversion_reasoning": "Why they would likely buy"
    }
  ]
}

Scoring: 9-10 perfect fit, 7-8 strong, 5-6 moderate, 3-4 weak, 1-2 poor.
conversion_likelihood: "high", "medium", "low".
Return a match for EVERY product. Be honest about poor fits.
"""


def _try_import_prompt() -> str | None:
    """Try to import Person B's prompt from prompts/matching_prompt.py."""
    try:
        from prompts.matching_prompt import build_prompt  # type: ignore[import-not-found]

        return build_prompt()
    except (ImportError, ModuleNotFoundError):
        return None


def _parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON from Claude response."""
    try:
        return json.loads(text)  # type: ignore[no-any-return]
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())  # type: ignore[no-any-return]

    raise ValueError(f"Could not parse JSON from Claude response: {text[:200]}")


def _build_lead_profile(lead: Lead) -> str:
    """Build a text profile of the lead for the matching prompt."""
    sections = [f"Company: {lead.company_name}"]
    if lead.description:
        sections.append(f"Description: {lead.description}")
    if lead.industry:
        sections.append(f"Industry: {lead.industry}")
    if lead.funding:
        sections.append(f"Funding: {lead.funding}")
    if lead.revenue:
        sections.append(f"Revenue: {lead.revenue}")
    if lead.employees:
        sections.append(f"Employees: {lead.employees}")
    if lead.customers:
        sections.append(f"Known customers: {', '.join(lead.customers)}")
    if lead.buying_signals:
        signals = []
        for s in lead.buying_signals:
            if isinstance(s, dict):
                sig = s
            elif hasattr(s, "model_dump"):
                sig = s.model_dump()
            else:
                sig = {"description": str(s)}
            strength = sig.get("strength", "unknown")
            sig_type = sig.get("signal_type", "")
            desc = sig.get("description", "")
            signals.append(f"- [{strength}] {sig_type}: {desc}")
        sections.append("Buying signals:\n" + "\n".join(signals))
    return "\n".join(sections)


def _build_product_catalog(products: list[Product]) -> str:
    """Build a text catalog of all products."""
    entries = []
    for p in products:
        parts = [f"Product ID: {p.id}", f"Name: {p.name}", f"Description: {p.description}"]
        if p.features:
            parts.append(f"Features: {', '.join(p.features)}")
        if p.industry_focus:
            parts.append(f"Industry focus: {p.industry_focus}")
        if p.pricing_model:
            parts.append(f"Pricing: {p.pricing_model}")
        if p.company_size_target:
            parts.append(f"Target company size: {p.company_size_target}")
        if p.differentiator:
            parts.append(f"Differentiator: {p.differentiator}")
        if p.example_clients:
            parts.append(f"Example clients: {', '.join(p.example_clients)}")
        entries.append("\n".join(parts))
    return "\n\n---\n\n".join(entries)


async def match_lead_to_products(lead: Lead, products: list[Product]) -> list[dict]:
    """Match a single lead against all products. Returns list of match dicts."""
    system_prompt = _try_import_prompt() or _FALLBACK_SYSTEM_PROMPT

    lead_profile = _build_lead_profile(lead)
    product_catalog = _build_product_catalog(products)

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": (
                f"## Target Company Profile\n{lead_profile}\n\n"
                f"## Product Catalog\n{product_catalog}\n\n"
                f"Match ALL products to this company. Return JSON."
            ),
        }],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    parsed = _parse_json_response(response_text)
    return parsed.get("matches", [])  # type: ignore[no-any-return]


async def generate_all_matches(ws_manager, user_id: int) -> None:
    """Generate matches for all enriched leads against all products."""
    from sqlmodel import select

    async with async_session() as session:
        # Load all enriched leads and all products
        leads_result = await session.execute(
            select(Lead).where(
                Lead.enrichment_status == EnrichmentStatus.COMPLETE,
                Lead.user_id == user_id,
            )
        )
        leads = list(leads_result.scalars().all())

        products_result = await session.execute(select(Product).where(Product.user_id == user_id))
        products = list(products_result.scalars().all())

        if not leads or not products:
            logger.warning("No enriched leads or no products — skipping matching")
            return

        await ws_manager.broadcast({
            "type": "matching_start",
            "total_leads": len(leads),
            "total_products": len(products),
        })

        for lead in leads:
            try:
                await ws_manager.broadcast({
                    "type": "agent_thinking",
                    "lead_id": lead.id,
                    "action": "matching",
                    "detail": f"Matching {lead.company_name} against {len(products)} products",
                })

                matches = await match_lead_to_products(lead, products)

                for m in matches:
                    product_id = m.get("product_id")
                    if product_id is None:
                        continue

                    # Upsert: delete existing match for this pair, then create new
                    existing = (await session.execute(
                        select(ProductMatch).where(
                            ProductMatch.lead_id == lead.id,
                            ProductMatch.product_id == product_id,
                        )
                    )).scalar_one_or_none()
                    if existing:
                        await session.delete(existing)
                        await session.flush()

                    match_record = ProductMatch(
                        lead_id=lead.id,  # type: ignore[arg-type]
                        product_id=product_id,
                        match_score=float(m.get("match_score", 0)),
                        match_reasoning=m.get("match_reasoning", ""),
                        conversion_likelihood=m.get("conversion_likelihood"),
                        conversion_reasoning=m.get("conversion_reasoning"),
                    )
                    session.add(match_record)
                    await session.commit()

                    await ws_manager.broadcast({
                        "type": "match_update",
                        "lead_id": lead.id,
                        "product_id": product_id,
                        "match_score": match_record.match_score,
                        "match_reasoning": match_record.match_reasoning,
                        "conversion_likelihood": match_record.conversion_likelihood,
                    })

            except Exception as e:
                logger.exception(f"Matching failed for lead {lead.id}")
                await ws_manager.broadcast({
                    "type": "matching_error",
                    "lead_id": lead.id,
                    "error": str(e),
                })

        await ws_manager.broadcast({"type": "matching_complete"})
