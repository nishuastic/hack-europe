"""ICP Discovery Agent — two-phase: LinkUp search then single Claude evaluation."""

import asyncio
import json
import logging
from typing import Any

from backend.api_keys import make_claude_client as _get_claude_client
from backend.api_keys import make_linkup_client as _get_client
from backend.discovery.prompts import build_discovery_prompt, build_evaluation_prompt
from backend.models import CompanyProfile, Product

logger = logging.getLogger(__name__)


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
                    "url": {
                        "type": "string",
                        "description": "Websites that have the company's name in the domain name",
                    },
                    "description": {"type": "string"},
                    "industry": {"type": "string"},
                    "company_fit": {"type": "string", "description": "Why the company fits our scope"},
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
        selected_products: list[Product] | None = None,
        company_profile: CompanyProfile | None = None,
) -> str:
    """Get the Phase 1 query-generation prompt for the selected products."""
    try:
        from prompts.discovery_prompt import build_prompt
        base = build_prompt(selected_products or products)
    except Exception:
        base = build_discovery_prompt(products, selected_products=selected_products)
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
    marker = "## Product Catalog"
    if marker in prompt:
        return prompt.replace(marker, block + marker, 1)
    return block + prompt


def _build_product_id_map(products: list[Product]) -> dict[Any, Product]:
    """Build a mapping from product id → Product for fast lookup."""
    return {p.id: p for p in products if p.id is not None}


async def _plan_discovery_queries(
        products: list[Product],
        selected_products: list[Product] | None = None,
        company_profile: CompanyProfile | None = None,
) -> list[dict[str, Any]]:
    """Call Claude to generate targeted search queries, tagged with product_id."""
    prompt = _get_query_gen_prompt(products, selected_products, company_profile)
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
        queries: list[dict[str, Any]] = data.get("queries", [])
        if not isinstance(queries, list) or not queries:
            logger.warning("Claude returned no queries, falling back")
            return []
        logger.info(f"Claude generated {len(queries)} discovery queries")
        return queries
    except Exception as e:
        logger.warning(f"Claude query generation failed: {e}")
        return []


def _build_search_queries_fallback(product: Product) -> list[dict[str, Any]]:
    """Fallback: build 2-3 search queries from a product's ICP signals, tagged with product_id."""
    queries: list[dict[str, Any]] = []
    base = product.name
    product_id = product.id

    if product.industry_focus:
        queries.append({
            "query": f"{product.industry_focus} companies that need {base}",
            "depth": "standard",
            "icp_rationale": f"Industry match: {product.industry_focus}",
            "product_id": product_id,
        })
    if product.company_size_target:
        queries.append({
            "query": f"{product.company_size_target} companies looking for {base}",
            "depth": "standard",
            "icp_rationale": f"Size match: {product.company_size_target}",
            "product_id": product_id,
        })
    if product.geography:
        queries.append({
            "query": f"{base} potential customers in {product.geography}",
            "depth": "standard",
            "icp_rationale": f"Geography match: {product.geography}",
            "product_id": product_id,
        })
    desc_snippet = (product.description or "")[:80]
    queries.append({
        "query": f"companies that would buy {base} {desc_snippet}",
        "depth": "standard",
        "icp_rationale": "General ICP search",
        "product_id": product_id,
    })
    return queries[:3]


async def _exec_search_companies(
        query: str,
        depth: str,
        product_id: Any,
) -> tuple[Any, dict[str, Any]]:
    """Execute a company search via LinkUp structured output.

    Returns (product_id, result_dict) so callers can attribute results to a product.
    """
    client = _get_client()
    try:
        response = await client.async_search(
            query=f"{query}. Do not include companies that sell similar products or services to the vendor.",
            depth="standard",
            output_type="structured",
            structured_output_schema=_COMPANY_SEARCH_SCHEMA,
        )
        raw = response.output if hasattr(response, "output") else response
        if isinstance(raw, str):
            data = json.loads(raw)
        else:
            data = raw

        return product_id, data
    except Exception as e:
        logger.warning(f"search_companies failed for query '{query}': {e}")
        return product_id, {"companies": [], "error": str(e)}


async def _search_all_products(
        products: list[Product],
        selected_products: list[Product] | None = None,
        ws_manager: Any | None = None,
        company_profile: CompanyProfile | None = None,
) -> list[dict[str, Any]]:
    """Phase 1: Run LinkUp searches for selected products in parallel.

    Each returned candidate is annotated with `matched_product_ids` (list) so the
    evaluation phase can attribute it to the correct product(s).
    """
    url_to_candidate: dict[str, dict[str, Any]] = {}
    all_candidates: list[dict[str, Any]] = []
    product_id_map = _build_product_id_map(products)

    # Determine which products to search for
    active_products = selected_products if selected_products is not None else products

    # Try Claude-planned queries first, fall back to templates
    planned = await _plan_discovery_queries(products, selected_products, company_profile)

    # Each task: (query_str, depth, product_id)
    tasks: list[tuple[str, str, Any]] = []

    if planned:
        for q in planned:
            query_str = q.get("query", "")
            depth = q.get("depth", "standard")
            product_id = q.get("product_id")
            if query_str:
                tasks.append((query_str, depth, product_id))

    if not tasks:
        logger.info("Using fallback query builder")
        for product in active_products:
            for q in _build_search_queries_fallback(product):
                tasks.append((q["query"], q.get("depth", "standard"), q.get("product_id")))

    if ws_manager:
        await ws_manager.broadcast({
            "type": "discovery_thinking",
            "iteration": 1,
            "detail": f"Searching for candidates with {len(tasks)} queries across {len(active_products)} product(s)...",
        })

    # Run all searches in parallel
    search_coros = [
        _exec_search_companies(query, depth, product_id)
        for query, depth, product_id in tasks
    ]
    results = await asyncio.gather(*search_coros, return_exceptions=True)

    for raw_result in results:
        if isinstance(raw_result, BaseException):
            logger.warning(f"Search task failed: {raw_result}")
            continue

        product_id, result = raw_result

        # Resolve product name for attribution
        matched_product = product_id_map.get(product_id)
        matched_product_name = matched_product.name if matched_product else None

        for company in result.get("companies", []):
            url = company.get("url", "")

            if url and url in url_to_candidate:
                # Duplicate URL — merge product association into existing candidate
                existing = url_to_candidate[url]
                if product_id not in existing["matched_product_ids"]:
                    existing["matched_product_ids"].append(product_id)
                    if matched_product_name and matched_product_name not in existing["matched_product_names"]:
                        existing["matched_product_names"].append(matched_product_name)
                continue

            # New candidate — initialize with list-based product attribution
            company["matched_product_ids"] = [product_id]
            company["matched_product_names"] = [matched_product_name] if matched_product_name else []
            all_candidates.append(company)
            if url:
                url_to_candidate[url] = company

    logger.info(
        f"Phase 1 complete: {len(all_candidates)} candidates from {len(tasks)} searches "
        f"across {len(active_products)} product(s)"
    )
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

    first_block = response.content[0] if response.content else None
    text = first_block.text if first_block and hasattr(first_block, "text") else ""

    json_str = text
    if "```" in json_str:
        start = json_str.find("```")
        end = json_str.rfind("```")
        if start != end:
            inner = json_str[start:end]
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
        selected_products: list[Product] | None = None,
        ws_manager: Any | None = None,
        company_profile: CompanyProfile | None = None,
) -> list[dict[str, Any]]:
    """Run two-phase discovery: search then evaluate.

    Args:
        products: Full product catalog.
        max_companies: Maximum number of companies to return.
        selected_products: If provided, only generate queries and search for these products.
            All products are still passed to the evaluation phase for context.
        ws_manager: Optional websocket manager for progress updates.
        company_profile: Optional seller company profile for additional context.

    Returns a list of discovered company dicts, each with a `best_product_match` field.
    """
    # Phase 1: Search (scoped to selected_products if provided)
    candidates = await _search_all_products(
        products,
        selected_products=selected_products,
        ws_manager=ws_manager,
        company_profile=company_profile,
    )

    if not candidates:
        logger.warning("No candidates found in search phase")
        return []

    # Phase 2: Evaluate — use full product list for context, but candidates are
    # already annotated with matched_product_ids from Phase 1
    discovered = await _evaluate_candidates(candidates, products, max_companies, ws_manager)

    return discovered
