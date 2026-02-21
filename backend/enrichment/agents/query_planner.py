"""Agent 1: Query Planner — uses Claude to generate tailored search queries per company."""

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


# ─── Models ──────────────────────────────────────────────────────────────

class SearchQuery:
    """A single search query with metadata."""

    def __init__(self, query: str, depth: str, target_field: str, rationale: str):
        self.query = query
        self.depth = depth  # "standard" or "deep"
        self.target_field = target_field
        self.rationale = rationale

    def to_dict(self) -> dict:
        return {
            "query": self.query, "depth": self.depth,
            "target_field": self.target_field, "rationale": self.rationale,
        }


class SearchPlan:
    """A collection of search queries produced by the planner."""

    def __init__(self, queries: list[SearchQuery]):
        self.queries = queries

    @property
    def query_texts(self) -> list[str]:
        return [q.query for q in self.queries]

    def __len__(self) -> int:
        return len(self.queries)


# ─── Prompt (inline fallback) ────────────────────────────────────────────

# --- PLACEHOLDER — Person B replaces via prompts/query_planner_prompt.py ---
_FALLBACK_SYSTEM_PROMPT = """\
You are a sales research query planner. Given a company name (and optionally a URL and prior context), \
generate targeted web search queries to gather comprehensive sales intelligence.

Return ONLY valid JSON matching this schema:
{
  "queries": [
    {
      "query": "the search query string",
      "depth": "standard" or "deep",
      "target_field": "which Lead field this targets (description|funding|industry|revenue|...)",
      "rationale": "why this query is useful"
    }
  ]
}

Guidelines:
- Generate 5-8 queries for a fresh research round (no prior context)
- Generate 2-4 targeted queries for a follow-up round (when gaps and hints are provided)
- Use "standard" depth for simple factual lookups (company overview, industry)
- Use "deep" depth for harder-to-find data (contacts, customers, revenue, buying signals)
- Each query should target a specific field — tag it clearly
- Make queries specific to the company, not generic templates
- For contacts, include "CEO", "CTO", "leadership" in the query
- For customers, include "case studies", "clients", "testimonials"
- For buying signals, look for recent funding, hiring, expansion, competitor usage
"""

_FALLBACK_FOLLOW_UP_ADDENDUM = """
IMPORTANT: This is a follow-up round. The following fields still have gaps:
{gaps}

Hints from prior extraction:
{hints}

Generate 2-4 targeted queries ONLY for the missing fields. Do NOT repeat prior queries.
Existing data so far:
{existing_context}
"""
# --- END PLACEHOLDER ---


def _try_import_prompt() -> tuple[str, str] | None:
    """Try to import Person B's prompt from prompts/query_planner_prompt.py."""
    try:
        from prompts.query_planner_prompt import build_prompt  # type: ignore[import-not-found]
        return build_prompt()  # Expected to return (system_prompt, follow_up_addendum)
    except (ImportError, ModuleNotFoundError):
        return None


def _parse_plan_response(text: str) -> list[dict]:
    """Parse Claude's JSON response into a list of query dicts."""
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            parsed = json.loads(match.group(1).strip())
        else:
            raise ValueError(f"Could not parse JSON from query planner response: {text[:200]}")

    if isinstance(parsed, dict) and "queries" in parsed:
        return parsed["queries"]  # type: ignore[no-any-return]
    if isinstance(parsed, list):
        return parsed  # type: ignore[return-value]
    raise ValueError(f"Unexpected query planner response structure: {text[:200]}")


# ─── Main function ────────────────────────────────────────────────────────

async def plan_queries(
    company_name: str,
    company_url: str | None = None,
    existing_context: dict | None = None,
    gaps: list[str] | None = None,
    follow_up_hints: list[str] | None = None,
) -> SearchPlan:
    """Use Claude to generate tailored search queries for a company.

    For initial research: pass only company_name (and optionally company_url).
    For follow-up: also pass existing_context, gaps, and follow_up_hints.
    """
    # Try Person B's prompts first, fall back to inline
    imported = _try_import_prompt()
    if imported:
        system_prompt, follow_up_addendum = imported
    else:
        system_prompt = _FALLBACK_SYSTEM_PROMPT
        follow_up_addendum = _FALLBACK_FOLLOW_UP_ADDENDUM

    # Build user message
    user_parts = [f"Plan search queries for: **{company_name}**"]
    if company_url:
        user_parts.append(f"Company URL: {company_url}")

    # If this is a follow-up round, inject gap context
    if gaps and follow_up_hints is not None:
        addendum = follow_up_addendum.format(
            gaps=", ".join(gaps),
            hints="\n".join(f"- {h}" for h in follow_up_hints) if follow_up_hints else "None",
            existing_context=json.dumps(existing_context or {}, indent=2)[:2000],
        )
        system_prompt = system_prompt + "\n\n" + addendum

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=system_prompt,
        messages=[{"role": "user", "content": "\n".join(user_parts)}],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    raw_queries = _parse_plan_response(response_text)

    queries = []
    for q in raw_queries:
        queries.append(SearchQuery(
            query=q.get("query", ""),
            depth=q.get("depth", "standard"),
            target_field=q.get("target_field", "description"),
            rationale=q.get("rationale", ""),
        ))

    logger.info(f"Query planner generated {len(queries)} queries for {company_name}")
    return SearchPlan(queries=queries)
