"""ICP Discovery Agent — two-phase: LinkUp search then single Claude evaluation."""

import asyncio
import json
import logging
from typing import Any

import anthropic

from backend.config import settings
from backend.discovery.prompts import build_discovery_prompt, build_evaluation_prompt
from backend.enrichment.linkup_search import _get_client
from backend.models import CompanyProfile, Product

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── LinkUp Search Schema ─────────────────────────────────────────────────

_COMPANY_SEARCH_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "companies": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "url": {"type": "string"},
                    "description": {"type": "string"},
                    "industry": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    "required": ["companies"],
})


# ─── Phase 1: Search ──────────────────────────────────────────────────────


def _get_query_gen_prompt(
    products: list[Product],
    company_profile: CompanyProfile | None = None,
) -> str:
    """Get the Phase 1 query-generation prompt, preferring the prompts/ override."""
    try:
        from prompts.discovery_prompt import build_prompt
        base = build_prompt(products)
    except Exception:
        base = build_discovery_prompt(products)
    if company_profile:
        base = _prepend_company_context(base, company_profile)
    return base


def _prepend_company_context(prompt: str, cp: CompanyProfile) -> str:
    """Insert a seller company context block before the product catalog."""
    parts = [f"## Your Company (the seller)\n- **Name:** {cp.company_name}"]
    if cp.website:
        parts.append(f"- **Website:** {cp.website}")
    if cp.value_proposition:
        parts.append(f"- **Value proposition:** {cp.value_proposition}")
    if cp.growth_stage:
        parts.append(f"- **Growth stage:** {cp.growth_stage}")
    if cp.geography:
        parts.append(f"- **Geography:** {cp.geography}")
    block = "\n".join(parts) + "\n\n"
    # Insert before "## Product Catalog"
    marker = "## Product Catalog"
    if marker in prompt:
        return prompt.replace(marker, block + marker, 1)
    # Fallback: prepend
    return block + prompt


async def _plan_discovery_queries(
    products: list[Product],
    company_profile: CompanyProfile | None = None,
) -> list[dict[str, str]]:
    """Call Claude to generate targeted search queries for the products."""
    prompt = _get_query_gen_prompt(products, company_profile)
    try:
        response = await _get_claude_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = ""
        if response.content:
            first = response.content[0]
            text = first.text if hasattr(first, "text") else ""

        # Strip markdown fences if present
        json_str = text
        if "```" in json_str:
            start = json_str.find("```")
            end = json_str.rfind("```")
            if start != end:
                inner = json_str[start:end]
                inner = inner.split("\n", 1)[1] if "\n" in inner else inner
                json_str = inner
        json_str = json_str.strip()

        data = json.loads(json_str)
        queries: list[dict[str, str]] = data.get("queries", [])
        if not isinstance(queries, list) or not queries:
            logger.warning("Claude returned no queries, falling back")
            return []
        logger.info(f"Claude generated {len(queries)} discovery queries")
        return queries
    except Exception as e:
        logger.warning(f"Claude query generation failed: {e}")
        return []


def _build_search_queries_fallback(product: Product) -> list[dict[str, str]]:
    """Fallback: build 2-3 search queries from a product's ICP signals."""
    queries: list[dict[str, str]] = []
    base = product.name
    if product.industry_focus:
        queries.append({
            "query": f"{product.industry_focus} companies that need {base}",
            "depth": "standard",
            "icp_rationale": f"Industry match: {product.industry_focus}",
        })
    if product.company_size_target:
        queries.append({
            "query": f"{product.company_size_target} companies looking for {base}",
            "depth": "standard",
            "icp_rationale": f"Size match: {product.company_size_target}",
        })
    if product.geography:
        queries.append({
            "query": f"{base} potential customers in {product.geography}",
            "depth": "standard",
            "icp_rationale": f"Geography match: {product.geography}",
        })
    # Always add a generic query
    desc_snippet = (product.description or "")[:80]
    queries.append({
        "query": f"companies that would buy {base} {desc_snippet}",
        "depth": "deep",
        "icp_rationale": "General ICP search",
    })
    return queries[:3]


async def _exec_search_companies(
    query: str, depth: str, exclude_urls: set[str],
) -> dict[str, Any]:
    """Execute a company search via LinkUp structured output."""
    client = _get_client()
    try:
        response = await client.async_search(
            query=query,
            depth="deep" if depth == "deep" else "standard",
            output_type="structured",
            structured_output_schema=_COMPANY_SEARCH_SCHEMA,
        )
        raw = response.output if hasattr(response, "output") else response
        if isinstance(raw, str):
            data = json.loads(raw)
        else:
            data = raw

        # Filter out already-found URLs
        if exclude_urls and "companies" in data:
            data["companies"] = [
                c for c in data["companies"]
                if not c.get("url") or c["url"] not in exclude_urls
            ]

        return data  # type: ignore[return-value]
    except Exception as e:
        logger.warning(f"search_companies failed for query '{query}': {e}")
        return {"companies": [], "error": str(e)}


async def _search_all_products(
    products: list[Product],
    ws_manager: Any | None = None,
    company_profile: CompanyProfile | None = None,
) -> list[dict[str, Any]]:
    """Phase 1: Run LinkUp searches for all products in parallel, deduplicate."""
    seen_urls: set[str] = set()
    all_candidates: list[dict[str, Any]] = []

    # Try Claude-planned queries first, fall back to templates
    planned = await _plan_discovery_queries(products, company_profile)
    tasks: list[tuple[str, str]] = []  # (query, depth)
    if planned:
        for q in planned:
            tasks.append((q.get("query", ""), q.get("depth", "standard")))
        tasks = [(q, d) for q, d in tasks if q]
    if not tasks:
        logger.info("Using fallback query builder")
        for product in products:
            for q in _build_search_queries_fallback(product):
                tasks.append((q["query"], q.get("depth", "standard")))

    if ws_manager:
        await ws_manager.broadcast({
            "type": "discovery_thinking",
            "iteration": 1,
            "detail": f"Searching for candidates with {len(tasks)} queries...",
        })

    # Run all searches in parallel
    search_coros = [
        _exec_search_companies(query, depth, seen_urls)
        for query, depth in tasks
    ]
    results = await asyncio.gather(*search_coros, return_exceptions=True)

    for raw_result in results:
        if isinstance(raw_result, BaseException):
            logger.warning(f"Search task failed: {raw_result}")
            continue
        result: dict[str, Any] = raw_result
        for company in result.get("companies", []):
            url = company.get("url", "")
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            all_candidates.append(company)

    logger.info(f"Phase 1 complete: {len(all_candidates)} candidates from {len(tasks)} searches")
    return all_candidates


# ─── Phase 2: Evaluate ────────────────────────────────────────────────────


async def _evaluate_candidates(
    candidates: list[dict[str, Any]],
    products: list[Product],
    max_companies: int,
    ws_manager: Any | None = None,
) -> list[dict[str, Any]]:
    """Phase 2: Single Claude call to evaluate and rank all candidates."""
    if not candidates:
        return []

    if ws_manager:
        await ws_manager.broadcast({
            "type": "discovery_thinking",
            "iteration": 2,
            "detail": f"Evaluating {len(candidates)} candidates with Claude...",
        })

    prompt = build_evaluation_prompt(products, candidates, max_companies)

    response = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse JSON from response
    first_block = response.content[0] if response.content else None
    text = first_block.text if first_block and hasattr(first_block, "text") else ""
    # Extract JSON array from response (handle markdown code blocks)
    json_str = text
    if "```" in json_str:
        # Extract content between code fences
        start = json_str.find("```")
        end = json_str.rfind("```")
        if start != end:
            inner = json_str[start:end]
            # Remove the opening fence line
            inner = inner.split("\n", 1)[1] if "\n" in inner else inner
            json_str = inner
    json_str = json_str.strip()

    try:
        result = json.loads(json_str)
        if isinstance(result, dict) and "companies" in result:
            result = result["companies"]
        if not isinstance(result, list):
            logger.warning("Claude evaluation returned non-list, wrapping")
            result = [result]
        logger.info(f"Phase 2 complete: {len(result)} companies approved")
        return result  # type: ignore[return-value]
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude evaluation response: {e}\nText: {text[:500]}")
        return []


# ─── Main Entry Point ─────────────────────────────────────────────────────


async def run_discovery_agent(
    products: list[Product],
    max_companies: int,
    ws_manager: Any | None = None,
    company_profile: CompanyProfile | None = None,
) -> list[dict[str, Any]]:
    """Run two-phase discovery: search then evaluate.

    Returns a list of discovered company dicts.
    """
    # Phase 1: Search
    candidates = await _search_all_products(products, ws_manager, company_profile)

    if not candidates:
        logger.warning("No candidates found in search phase")
        return []

    # Phase 2: Evaluate with Claude
    discovered = await _evaluate_candidates(candidates, products, max_companies, ws_manager)

    return discovered
