"""Agent 2: Search Executor — single consolidated LinkUp call per enrichment round."""

import json
import logging
from typing import Any

from backend.enrichment.linkup_search import _get_client

logger = logging.getLogger(__name__)


# ─── Models ──────────────────────────────────────────────────────────────

class SearchResult:
    """Result from a single LinkUp search."""

    def __init__(self, target_field: str, query: str, answer: str, sources: list[dict], depth: str):
        self.target_field = target_field
        self.query = query
        self.answer = answer
        self.sources = sources
        self.depth = depth

    def to_dict(self) -> dict:
        return {
            "target_field": self.target_field,
            "query": self.query,
            "answer": self.answer,
            "sources": self.sources,
            "depth": self.depth,
        }


# ─── Full enrichment schema — all fields in one structured call ──────────

_ENRICHMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {
            "type": "string",
            "description": "1-2 sentence company description",
        },
        "industry": {
            "type": "string",
            "description": "Primary industry, e.g. 'Fintech', 'Healthcare SaaS'",
        },
        "funding": {
            "type": "string",
            "description": "Latest funding info, e.g. 'Series C, $200M'. Empty string if unknown",
        },
        "revenue": {
            "type": "string",
            "description": "Revenue estimate if available, empty string if unknown",
        },
        "employees": {
            "type": "integer",
            "description": "Approximate employee count, 0 if unknown",
        },
        "contacts": {
            "type": "array",
            "description": "Key decision-makers at the company",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "linkedin": {"type": "string"},
                },
                "required": ["name", "role"],
            },
        },
        "customers": {
            "type": "array",
            "description": "Known customers or clients of this company",
            "items": {"type": "string"},
        },
        "buying_signals": {
            "type": "array",
            "description": "Recent signals indicating buying intent or growth",
            "items": {
                "type": "object",
                "properties": {
                    "signal_type": {
                        "type": "string",
                        "description": (
                            "One of: recent_funding, hiring_surge, "
                            "competitor_mentioned, expansion, "
                            "pain_indicator, tech_stack_match"
                        ),
                    },
                    "description": {"type": "string"},
                    "strength": {
                        "type": "string",
                        "description": "One of: strong, moderate, weak",
                    },
                },
                "required": ["signal_type", "description", "strength"],
            },
        },
    },
}


def _build_followup_schema(gaps: list[str]) -> dict[str, Any]:
    """Build a schema containing only the fields that need follow-up."""
    schema: dict[str, Any] = {"type": "object", "properties": {}}
    all_props: dict[str, Any] = _ENRICHMENT_SCHEMA["properties"]  # type: ignore[assignment]
    for field in gaps:
        if field in all_props:
            schema["properties"][field] = all_props[field]
    # Always include at least description as fallback
    if not schema["properties"]:
        schema["properties"]["description"] = all_props["description"]
    return schema


# ─── Single consolidated search ──────────────────────────────────────────

async def execute_single_enrichment_search(
    company_name: str,
    company_url: str | None = None,
    gaps: list[str] | None = None,
    existing_context: dict[str, Any] | None = None,
) -> SearchResult:
    """Execute ONE LinkUp structured call to get all enrichment data for a company.

    Round 1: queries for all fields using the full schema.
    Round 2: queries only for gap fields using a targeted schema + context.
    """
    client = _get_client()

    if gaps and existing_context:
        # Round 2: targeted follow-up
        known_parts = []
        if existing_context.get("industry"):
            known_parts.append(f"industry: {existing_context['industry']}")
        if existing_context.get("description"):
            known_parts.append(f"description: {existing_context['description'][:100]}")
        known_context = "; ".join(known_parts) if known_parts else ""

        query = (
            f"{company_name} company detailed information: {', '.join(gaps)}. "
            f"Known context: {known_context}"
        )
        schema = _build_followup_schema(gaps)
    else:
        # Round 1: broad enrichment
        url_part = f" ({company_url})" if company_url else ""
        query = (
            f"{company_name}{url_part} company overview: description, industry, "
            f"funding rounds, revenue, employee count, leadership team contacts, "
            f"notable customers, and recent buying signals or growth indicators"
        )
        schema = _ENRICHMENT_SCHEMA

    schema_str = json.dumps(schema)

    try:
        response = await client.async_search(
            query=query,
            depth="standard",
            output_type="structured",
            structured_output_schema=schema_str,
        )
        raw = response.output if hasattr(response, "output") else response
        if isinstance(raw, str):
            answer = raw
        else:
            answer = json.dumps(raw)
        sources: list[dict] = []
        if hasattr(response, "sources") and response.sources:
            sources = [
                {"name": getattr(s, "name", ""), "url": getattr(s, "url", ""), "snippet": getattr(s, "snippet", "")}
                for s in response.sources
            ]
    except Exception as e:
        logger.warning(f"Enrichment search failed for '{company_name}': {e}")
        answer = json.dumps({"error": str(e)})
        sources = []

    round_label = "follow_up" if gaps else "initial"
    logger.info(f"Enrichment search ({round_label}) for {company_name}: 1 LinkUp call")

    return SearchResult(
        target_field="all",
        query=query,
        answer=answer,
        sources=sources,
        depth="standard",
    )
