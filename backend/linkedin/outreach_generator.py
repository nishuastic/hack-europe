"""Generate warm intro outreach plans using Claude."""

import json
import logging
import re

import anthropic

from backend.config import settings
from backend.models import WarmIntroOutreach

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


_SYSTEM_PROMPT = """\
You are a warm introduction strategist. Given a LinkedIn connection and a target \
company (lead), generate a plan for reaching the prospect through the connection.

Return ONLY valid JSON:
{
  "intro_message": "A message to send to your connection asking for an introduction",
  "talking_points": ["Point 1", "Point 2", "Point 3"],
  "context": "Brief context on why this connection is valuable for reaching this lead",
  "timing_suggestion": "When and how to reach out"
}

Guidelines:
- The intro message should be warm, personal, and reference the shared connection
- Talking points should be specific to the lead's business and situation
- Keep the message under 150 words
- Suggest specific timing based on any signals available
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


async def generate_outreach_plan(
    connection: dict,
    lead: dict,
    product_match: dict | None = None,
    company_profile: dict | None = None,
) -> WarmIntroOutreach:
    """Generate a warm intro outreach plan for a connection-lead pair."""
    conn_info = (
        f"Name: {connection.get('first_name', '')} {connection.get('last_name', '')}\n"
        f"Position: {connection.get('position', 'Unknown')}\n"
        f"Company: {connection.get('company', 'Unknown')}"
    )

    lead_info = f"Company: {lead.get('company_name', '')}"
    if lead.get("description"):
        lead_info += f"\nDescription: {lead['description']}"
    if lead.get("industry"):
        lead_info += f"\nIndustry: {lead['industry']}"
    if lead.get("funding"):
        lead_info += f"\nFunding: {lead['funding']}"
    if lead.get("employees"):
        lead_info += f"\nEmployees: {lead['employees']}"

    user_content = f"## Your LinkedIn Connection\n{conn_info}\n\n## Target Company\n{lead_info}"

    if product_match:
        user_content += (
            f"\n\n## Product Match\n"
            f"Product: {product_match.get('product_name', '')}\n"
            f"Score: {product_match.get('match_score', '')}\n"
            f"Reasoning: {product_match.get('match_reasoning', '')}"
        )

    if company_profile:
        user_content += (
            f"\n\n## Your Company\n"
            f"Name: {company_profile.get('company_name', '')}\n"
            f"Value Prop: {company_profile.get('value_proposition', '')}"
        )

    user_content += "\n\nGenerate the warm introduction outreach plan."

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    parsed = _parse_json_response(response_text)

    return WarmIntroOutreach(
        intro_message=parsed.get("intro_message", ""),
        talking_points=parsed.get("talking_points", []),
        context=parsed.get("context", ""),
        timing_suggestion=parsed.get("timing_suggestion", ""),
    )
