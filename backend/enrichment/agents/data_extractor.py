"""Agent 3: Data Extractor — uses Claude to extract structured Lead fields from search results."""

import json
import logging
import re

import anthropic

from backend.config import settings
from backend.enrichment.agents.search_executor import SearchResult

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Models ──────────────────────────────────────────────────────────────

class FieldConfidence:
    """Confidence assessment for a single extracted field."""

    def __init__(self, field: str, confidence: str, reason: str):
        self.field = field
        self.confidence = confidence  # "high", "medium", "low"
        self.reason = reason

    def to_dict(self) -> dict:
        return {"field": self.field, "confidence": self.confidence, "reason": self.reason}


class ExtractionResult:
    """Structured extraction output with gap analysis."""

    def __init__(
        self,
        data: dict,
        field_confidences: list[FieldConfidence],
        gaps: list[str],
        follow_up_hints: list[str],
    ):
        self.data = data
        self.field_confidences = field_confidences
        self.gaps = gaps
        self.follow_up_hints = follow_up_hints

    def to_dict(self) -> dict:
        return {
            "data": self.data,
            "field_confidences": [fc.to_dict() for fc in self.field_confidences],
            "gaps": self.gaps,
            "follow_up_hints": self.follow_up_hints,
        }


# ─── Prompt (inline fallback) ────────────────────────────────────────────

# --- PLACEHOLDER — Person B replaces via prompts/extraction_prompt.py ---
_FALLBACK_SYSTEM_PROMPT = """\
You are a sales intelligence analyst. Given web search results about a company, \
extract structured data and assess data quality.

Return ONLY valid JSON with this exact structure:
{
  "data": {
    "description": "1-2 sentence company description",
    "funding": "Latest funding info, e.g. 'Series C, $200M'. null if unknown",
    "industry": "Primary industry, e.g. 'Fintech'",
    "revenue": "Revenue estimate if available, or null",
    "employees": integer or null,
    "contacts": [{"name": "...", "role": "...", "linkedin": "...or null"}],
    "customers": ["Company A", "Company B"],
    "buying_signals": [
      {"signal_type": "recent_funding", "description": "Raised $45M Series B", "strength": "strong"}
    ]
  },
  "field_confidences": [
    {"field": "description", "confidence": "high|medium|low", "reason": "why this confidence level"}
  ],
  "gaps": ["field names that are missing or low-confidence"],
  "follow_up_hints": ["specific search suggestions to fill the gaps"]
}

Signal types: recent_funding, hiring_surge, competitor_mentioned, expansion, pain_indicator, tech_stack_match
Strength: strong, moderate, weak
Confidence: high (multiple sources confirm), medium (single source or partial), low (inferred or uncertain)

Rules:
- If a field is unknown, use null (or empty list for arrays) and mark it as a gap
- Never invent data — only extract what's supported by the search results
- Include follow_up_hints for any gap — suggest what to search for next
- For contacts, always include name and role at minimum
"""

_FALLBACK_MERGE_ADDENDUM = """
IMPORTANT: This is a follow-up extraction. You have existing data from a prior round.
Merge new findings with existing data. Rules:
- Keep existing values if new data doesn't contradict them
- Replace existing values if new data is higher-confidence
- Append to lists (contacts, customers, buying_signals) — deduplicate by name
- Update confidence assessments based on combined evidence

Existing data from prior round:
{existing_data}
"""
# --- END PLACEHOLDER ---


def _try_import_prompt() -> tuple[str, str] | None:
    """Try to import Person B's prompt from prompts/extraction_prompt.py."""
    try:
        from prompts.extraction_prompt import build_prompt  # type: ignore[import-not-found]
        return build_prompt()  # Expected to return (system_prompt, merge_addendum)
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


# ─── Main function ────────────────────────────────────────────────────────

async def extract_lead_data(
    company_name: str,
    search_results: list[SearchResult],
    existing_data: dict | None = None,
) -> ExtractionResult:
    """Extract structured Lead fields from search results using Claude.

    For initial extraction: pass company_name + search_results.
    For follow-up: also pass existing_data to merge with.
    """
    # Try Person B's prompts first, fall back to inline
    imported = _try_import_prompt()
    if imported:
        system_prompt, merge_addendum = imported
    else:
        system_prompt = _FALLBACK_SYSTEM_PROMPT
        merge_addendum = _FALLBACK_MERGE_ADDENDUM

    # If follow-up, inject existing data context
    if existing_data:
        system_prompt = system_prompt + "\n\n" + merge_addendum.format(
            existing_data=json.dumps(existing_data, indent=2)[:3000]
        )

    # Build research text from search results
    research_sections = []
    for sr in search_results:
        research_sections.append(
            f"=== {sr.target_field.upper()} (query: {sr.query}) ===\n{sr.answer}"
        )
    research_text = "\n\n".join(research_sections)

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2500,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": (
                f"Extract structured sales intelligence for **{company_name}** "
                f"from this research:\n\n{research_text}"
            ),
        }],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    parsed = _parse_json_response(response_text)

    # Handle both flat format (just data fields) and structured format (with gaps/confidences)
    if "data" in parsed:
        data = parsed["data"]
        raw_confidences = parsed.get("field_confidences", [])
        gaps = parsed.get("gaps", [])
        follow_up_hints = parsed.get("follow_up_hints", [])
    else:
        # Flat format — treat entire response as data, no gap analysis
        data = parsed
        raw_confidences = []
        gaps = _infer_gaps(data)
        follow_up_hints = []

    field_confidences = [
        FieldConfidence(
            field=fc.get("field", ""),
            confidence=fc.get("confidence", "medium"),
            reason=fc.get("reason", ""),
        )
        for fc in raw_confidences
    ]

    logger.info(f"Data extractor for {company_name}: {len(gaps)} gaps found")
    return ExtractionResult(
        data=data,
        field_confidences=field_confidences,
        gaps=gaps,
        follow_up_hints=follow_up_hints,
    )


def _infer_gaps(data: dict) -> list[str]:
    """Infer which important fields are missing from extracted data."""
    important_fields = ["description", "funding", "industry", "contacts", "buying_signals"]
    gaps = []
    for field in important_fields:
        value = data.get(field)
        if value is None or value == [] or value == "":
            gaps.append(field)
    return gaps
