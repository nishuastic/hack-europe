"""ICP extractor — Claude call to derive ICP rubrics from customer research data."""

import json
import logging
import re

import anthropic

from backend.config import settings

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


_SYSTEM_PROMPT = """\
You are an expert B2B sales analyst. Given research data about a product's existing customers, \
extract the Ideal Customer Profile (ICP) — the common patterns that define who is most likely to buy.

Return ONLY valid JSON with this structure:
{
  "target_industries": ["Industry1", "Industry2"],
  "employee_range_min": 50,
  "employee_range_max": 500,
  "revenue_range": "$5M - $50M ARR",
  "funding_stages": ["Series A", "Series B"],
  "geographies": ["US", "Europe"],
  "common_traits": ["Uses modern tech stack", "High growth rate", "B2B SaaS"],
  "anti_patterns": ["Pre-revenue startups", "Government/public sector"],
  "icp_summary": "2-3 sentence summary of the ideal customer"
}

Rules:
- Derive patterns from what the customers have IN COMMON
- Be specific with ranges (don't say "any size" — find the actual cluster)
- anti_patterns = types of companies that DON'T fit based on what's missing from customer base
- If data is insufficient for a field, use null
"""


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


async def extract_icp_rubrics(
    customer_data: list[dict],
    product_name: str,
    product_description: str,
) -> dict:
    """Derive ICP rubrics from researched customer data using Claude."""
    customers_text = "\n\n".join(
        f"Customer {i+1}: {json.dumps(c, indent=2)}" for i, c in enumerate(customer_data)
    )

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": (
                f"Product: {product_name}\n"
                f"Description: {product_description}\n\n"
                f"Existing customers ({len(customer_data)} researched):\n\n"
                f"{customers_text}\n\n"
                f"Extract the Ideal Customer Profile. Return JSON."
            ),
        }],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    return _parse_json_response(response_text)
