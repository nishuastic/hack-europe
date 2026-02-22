"""Email generator — uses Claude to draft personalized outreach emails."""

import json
import logging
import re

import anthropic

from backend.config import settings
from backend.matching.pipeline import _build_lead_profile

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Prompt (inline fallback) ────────────────────────────────────────────

_FALLBACK_SYSTEM_PROMPT = """\
You are a B2B sales copywriter. Write a personalized cold outreach email.

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "body": "Full email body"
}

Guidelines: 5-8 word subject, reference something specific about the company, \
connect their challenge to the product, clear CTA, 150-200 words max.
"""


def _try_import_prompt() -> str | None:
    """Try to import Person B's prompt from prompts/email_prompt.py."""
    try:
        from prompts.email_prompt import build_prompt  # type: ignore[import-not-found]

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


async def generate_email(lead, product, match_reasoning: str, contact: dict | None = None) -> dict:
    """Generate a personalized outreach email. Returns {subject, body, contact_name, contact_role}."""
    system_prompt = _try_import_prompt() or _FALLBACK_SYSTEM_PROMPT

    lead_profile = _build_lead_profile(lead)

    # Pick best contact
    contact_name = "there"
    contact_role = "Decision Maker"
    if contact:
        contact_name = contact.get("name", "there")
        contact_role = contact.get("role", "Decision Maker")
    elif lead.contacts:
        first = lead.contacts[0]
        if isinstance(first, dict):
            contact_name = first.get("name", "there")
            contact_role = first.get("role", "Decision Maker")
        elif hasattr(first, "name"):
            contact_name = first.name
            contact_role = first.role

    product_parts = [f"Product: {product.name}", f"Description: {product.description}"]
    if product.features:
        product_parts.append(f"Features: {', '.join(product.features)}")
    if product.differentiator:
        product_parts.append(f"Differentiator: {product.differentiator}")
    if product.pricing_model:
        product_parts.append(f"Pricing: {product.pricing_model}")
    if product.example_clients:
        product_parts.append(f"Example clients: {', '.join(product.example_clients)}")
    if product.current_clients:
        client_names = [c["name"] if isinstance(c, dict) else str(c) for c in product.current_clients]
        product_parts.append(f"Current clients: {', '.join(client_names)}")
    if product.company_name:
        product_parts.append(f"Sold by: {product.company_name}")
    product_summary = "\n".join(product_parts)

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": (
                f"## Target Company\n{lead_profile}\n\n"
                f"## Product\n{product_summary}\n\n"
                f"## Match Reasoning\n{match_reasoning}\n\n"
                f"## Contact\nName: {contact_name}\nRole: {contact_role}\n\n"
                f"Write the outreach email."
            ),
        }],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    parsed = _parse_json_response(response_text)

    return {
        "subject": parsed.get("subject", ""),
        "body": parsed.get("body", ""),
        "contact_name": contact_name,
        "contact_role": contact_role,
    }
