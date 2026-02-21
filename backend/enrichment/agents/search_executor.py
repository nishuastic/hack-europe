"""Agent 2: Search Executor — runs LinkUp searches in parallel, no Claude."""

import asyncio
import json
import logging
from typing import Literal

from backend.enrichment.agents.query_planner import SearchPlan
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


# ─── Structured output schemas for LinkUp ─────────────────────────────────

# Used when output_type="structured" for contacts/customers
_CONTACTS_SCHEMA = {
    "type": "object",
    "properties": {
        "contacts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "linkedin": {"type": "string"},
                },
                "required": ["name", "role"],
            },
        }
    },
}

_CUSTOMERS_SCHEMA = {
    "type": "object",
    "properties": {
        "customers": {
            "type": "array",
            "items": {"type": "string"},
        }
    },
}

# Fields that should use structured output
_STRUCTURED_FIELDS = {"contacts", "customers"}
_FIELD_SCHEMAS = {
    "contacts": _CONTACTS_SCHEMA,
    "customers": _CUSTOMERS_SCHEMA,
}


# ─── Single search execution ─────────────────────────────────────────────

async def _run_single_search(query: str, depth: str, target_field: str) -> SearchResult:
    """Execute a single LinkUp search and return a SearchResult."""
    client = _get_client()
    depth_literal: Literal["standard", "deep"] = "deep" if depth == "deep" else "standard"
    try:
        if target_field in _STRUCTURED_FIELDS:
            schema_str = json.dumps(_FIELD_SCHEMAS[target_field])
            response = await client.async_search(
                query=query,
                depth=depth_literal,
                output_type="structured",
                structured_output_schema=schema_str,
            )
            # Structured returns the data directly
            answer = json.dumps(response.output) if hasattr(response, "output") else str(response)
            sources: list[dict] = []
        else:
            response = await client.async_search(
                query=query,
                depth=depth_literal,
                output_type="sourcedAnswer",
            )
            answer = response.output if hasattr(response, "output") else str(response)
            sources = []
            if hasattr(response, "sources") and response.sources:
                sources = [
                    {"name": getattr(s, "name", ""), "url": getattr(s, "url", ""), "snippet": getattr(s, "snippet", "")}
                    for s in response.sources
                ]
    except Exception as e:
        logger.warning(f"Search failed for query '{query[:60]}...': {e}")
        answer = f"[Search error: {e}]"
        sources = []

    return SearchResult(
        target_field=target_field,
        query=query,
        answer=answer,
        sources=sources,
        depth=depth,
    )


# ─── Main function ────────────────────────────────────────────────────────

async def execute_searches(plan: SearchPlan) -> list[SearchResult]:
    """Execute all queries from a SearchPlan in parallel via asyncio.gather().

    Returns a list of SearchResult objects.
    """
    tasks = [
        _run_single_search(q.query, q.depth, q.target_field)
        for q in plan.queries
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    search_results: list[SearchResult] = []
    for i, result in enumerate(results):
        if isinstance(result, BaseException):
            logger.warning(f"Search task {i} failed: {result}")
            q = plan.queries[i]
            search_results.append(SearchResult(
                target_field=q.target_field,
                query=q.query,
                answer=f"[Search error: {result}]",
                sources=[],
                depth=q.depth,
            ))
        else:
            search_results.append(result)  # type: ignore[arg-type]

    logger.info(f"Search executor completed {len(search_results)} searches")
    return search_results
