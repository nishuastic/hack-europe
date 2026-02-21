"""Claude structured extraction — raw search text → Lead fields."""

import json
import re

import anthropic

from backend.config import settings

_aclient: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient

# --- PLACEHOLDER PROMPT — Person B replaces via prompts/claude_prompts.py ---
EXTRACTION_SYSTEM_PROMPT = """\
You are a sales intelligence analyst. \
Given raw web research about a company, extract structured data.

Return ONLY valid JSON with these fields:
{
  "description": "1-2 sentence company description",
  "funding": "Latest funding info, e.g. 'Series C, $200M'",
  "industry": "Primary industry, e.g. 'Fintech'",
  "revenue": "Revenue estimate if available, or null",
  "employees": "integer or null",
  "contacts": [{"name": "...", "role": "..."}],
  "customers": ["Company A", "Company B"],
  "buying_signals": [
    {"signal_type": "recent_funding",
     "description": "Raised $45M Series B",
     "strength": "strong"}
  ]
}

Signal types: recent_funding, hiring_surge, competitor_mentioned, expansion, pain_indicator, tech_stack_match
Strength: strong, moderate, weak

If a field is unknown, use null (or empty list for arrays). Never invent data."""
# --- END PLACEHOLDER ---


def _parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON from Claude response."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip ```json ... ``` fences
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())

    raise ValueError(f"Could not parse JSON from Claude response: {text[:200]}")


async def extract_lead_data(company_name: str, raw_research: dict[str, str]) -> dict:
    """Send raw research to Claude, get structured Lead fields back."""
    research_text = "\n\n".join(
        f"=== {category.upper()} ===\n{text}"
        for category, text in raw_research.items()
    )

    message = await _get_client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Extract structured sales intelligence for "
                    f"**{company_name}** from this research:\n\n"
                    f"{research_text}"
                ),
            }
        ],
    )

    block = message.content[0]
    response_text = block.text  # type: ignore[union-attr]
    return _parse_json_response(response_text)
