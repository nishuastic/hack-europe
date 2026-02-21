"""ICP Discovery Agent — Claude with tool_use to iteratively search for companies."""

import json
import logging
from typing import Any, Literal

import anthropic

from backend.config import settings
from backend.discovery.prompts import build_discovery_prompt
from backend.enrichment.linkup_search import _get_client
from backend.models import Product

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Tool Definitions ─────────────────────────────────────────────────────

TOOLS: list[anthropic.types.ToolParam] = [
    {
        "name": "search_companies",
        "description": (
            "Search the web for companies matching a query. Returns a list of companies "
            "with name, URL, description, and industry. Use specific queries like "
            "'Series B fintech startups in Europe' or 'mid-market SaaS companies using Kubernetes'. "
            "Already-found URLs are automatically excluded."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find matching companies",
                },
                "depth": {
                    "type": "string",
                    "enum": ["standard", "deep"],
                    "description": "Search depth: 'standard' for quick results, 'deep' for thorough search",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_company_website",
        "description": (
            "Fetch and read the content of a company's website. Use this to understand "
            "what the company actually does, their products, and their positioning. "
            "Returns the page content as text."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The URL to fetch (e.g. https://example.com or https://example.com/about)",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "get_company_details",
        "description": (
            "Get structured details about a specific company: description, industry, "
            "funding, revenue, employee count. Use after search_companies to fill in "
            "details for promising matches."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "company_name": {
                    "type": "string",
                    "description": "The company name to research",
                },
                "company_url": {
                    "type": "string",
                    "description": "Optional company URL to help narrow the search",
                },
            },
            "required": ["company_name"],
        },
    },
    {
        "name": "submit_discovered_companies",
        "description": (
            "Submit the final list of discovered companies. Call this when you have found "
            "enough companies or exhausted search strategies. This ends the discovery process."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "companies": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "company_name": {"type": "string"},
                            "company_url": {"type": "string"},
                            "description": {"type": "string"},
                            "industry": {"type": "string"},
                            "funding": {"type": "string"},
                            "revenue": {"type": "string"},
                            "employees": {"type": "integer"},
                            "why_good_fit": {"type": "string"},
                        },
                        "required": ["company_name", "why_good_fit"],
                    },
                    "description": "List of discovered companies with their details",
                },
            },
            "required": ["companies"],
        },
    },
]

# ─── Tool Execution ────────────────────────────────────────────────────────

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

_COMPANY_DETAILS_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "company_name": {"type": "string"},
        "website": {"type": "string"},
        "description": {"type": "string"},
        "industry": {"type": "string"},
        "employees": {"type": "integer"},
        "funding": {"type": "string"},
        "revenue": {"type": "string"},
    },
    "required": ["company_name"],
})


async def _exec_search_companies(
    query: str, depth: str, exclude_urls: set[str],
) -> dict[str, Any]:
    """Execute a company search via LinkUp structured output."""
    client = _get_client()
    search_depth: Literal["standard", "deep"] = "deep" if depth == "deep" else "standard"
    try:
        response = await client.async_search(
            query=query,
            depth=search_depth,
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


async def _exec_fetch_website(url: str) -> dict[str, Any]:
    """Fetch a company website via LinkUp."""
    client = _get_client()
    try:
        response = await client.async_search(
            query=f"site:{url} about company overview",
            depth="standard",
            output_type="sourcedAnswer",
        )
        answer = response.output if hasattr(response, "output") else str(response)
        sources = []
        if hasattr(response, "sources") and response.sources:
            sources = [
                {"name": s.name, "url": s.url, "snippet": s.snippet}
                for s in response.sources
            ]
        return {"content": answer, "sources": sources}
    except Exception as e:
        logger.warning(f"fetch_company_website failed for '{url}': {e}")
        return {"content": "", "error": str(e)}


async def _exec_get_company_details(
    company_name: str, company_url: str | None = None,
) -> dict[str, Any]:
    """Get structured company details via LinkUp."""
    client = _get_client()
    query = f"{company_name} company overview funding employees revenue"
    if company_url:
        query += f" site:{company_url}"
    try:
        response = await client.async_search(
            query=query,
            depth="deep",
            output_type="structured",
            structured_output_schema=_COMPANY_DETAILS_SCHEMA,
        )
        raw = response.output if hasattr(response, "output") else response
        if isinstance(raw, str):
            return json.loads(raw)  # type: ignore[return-value]
        return raw  # type: ignore[return-value]
    except Exception as e:
        logger.warning(f"get_company_details failed for '{company_name}': {e}")
        return {"company_name": company_name, "error": str(e)}


async def _execute_tool(
    name: str, tool_input: dict[str, Any], exclude_urls: set[str],
) -> dict[str, Any]:
    """Route a tool call to the appropriate handler."""
    if name == "search_companies":
        return await _exec_search_companies(
            query=tool_input["query"],
            depth=tool_input.get("depth", "standard"),
            exclude_urls=exclude_urls,
        )
    elif name == "fetch_company_website":
        return await _exec_fetch_website(url=tool_input["url"])
    elif name == "get_company_details":
        return await _exec_get_company_details(
            company_name=tool_input["company_name"],
            company_url=tool_input.get("company_url"),
        )
    elif name == "submit_discovered_companies":
        # Terminal tool — just echo back the input
        return {"status": "submitted", "count": len(tool_input.get("companies", []))}
    else:
        return {"error": f"Unknown tool: {name}"}


# ─── Agentic Loop ──────────────────────────────────────────────────────────


async def run_discovery_agent(
    products: list[Product],
    max_companies: int,
    ws_manager: Any | None = None,
) -> list[dict[str, Any]]:
    """Run the ICP discovery agent — Claude with tool_use to find matching companies.

    Returns a list of discovered company dicts.
    """
    system_prompt = build_discovery_prompt(products)
    messages: list[anthropic.types.MessageParam] = [
        {
            "role": "user",
            "content": (
                f"Find up to {max_companies} companies that would be ideal customers "
                f"for the products in the catalog. Use search_companies to discover them, "
                f"fetch_company_website and get_company_details to validate promising ones, "
                f"then submit_discovered_companies with your final list."
            ),
        },
    ]

    found_urls: set[str] = set()
    discovered: list[dict[str, Any]] = []
    max_iterations = 20  # safety cap

    for iteration in range(max_iterations):
        logger.info(f"Discovery agent iteration {iteration + 1}")

        response = await _get_claude_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

        # Broadcast thinking (text blocks)
        for block in response.content:
            if block.type == "text" and block.text.strip() and ws_manager:
                await ws_manager.broadcast({
                    "type": "discovery_thinking",
                    "iteration": iteration + 1,
                    "detail": block.text[:500],
                })

        if response.stop_reason == "end_turn":
            logger.info("Discovery agent ended (no more tool calls)")
            break

        if response.stop_reason == "tool_use":
            tool_results: list[dict[str, Any]] = []

            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input

                if ws_manager:
                    await ws_manager.broadcast({
                        "type": "discovery_thinking",
                        "iteration": iteration + 1,
                        "detail": f"Calling {tool_name}: {json.dumps(tool_input)[:200]}",
                    })

                result = await _execute_tool(tool_name, tool_input, found_urls)

                # Track found URLs from search results
                if tool_name == "search_companies":
                    for co in result.get("companies", []):
                        url = co.get("url")
                        if url:
                            found_urls.add(url)

                # Capture final submission
                if tool_name == "submit_discovered_companies":
                    raw_companies = tool_input.get("companies", [])
                    discovered = raw_companies if isinstance(raw_companies, list) else []
                    logger.info(f"Discovery agent submitted {len(discovered)} companies")

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

            # Append assistant response + tool results to messages
            assistant_msg: Any = {"role": "assistant", "content": response.content}
            user_msg: Any = {"role": "user", "content": tool_results}
            messages.append(assistant_msg)
            messages.append(user_msg)

        # If we got a submission, we're done
        if discovered:
            break

    return discovered
