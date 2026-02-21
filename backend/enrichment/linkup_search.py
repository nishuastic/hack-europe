"""LinkUp SDK wrapper — runs parallel searches per company."""

import asyncio

from linkup import LinkupClient

from backend.config import settings

_client: LinkupClient | None = None


def _get_client() -> LinkupClient:
    global _client
    if _client is None:
        _client = LinkupClient(api_key=settings.linkup_api_key)
    return _client

# --- PLACEHOLDER QUERIES — Person B replaces via prompts/linkup_queries.py ---
QUERY_TEMPLATES: dict[str, str] = {
    "overview": "{company} company overview what do they do",
    "funding": "{company} funding rounds investors valuation",
    "leadership": "{company} CEO founders leadership team",
    "customers": "{company} customers clients case studies",
    "news": "{company} latest news announcements 2025 2026",
}
# --- END PLACEHOLDER ---


async def _search(query: str) -> str:
    """Run a single LinkUp search, return sourced answer text."""
    try:
        response = await _get_client().async_search(
            query=query,
            depth="standard",
            output_type="sourcedAnswer",
        )
        return response.output if hasattr(response, "output") else str(response)
    except Exception as e:
        return f"[Search error: {e}]"


async def search_company(company_name: str) -> dict[str, str]:
    """Run all 5 searches in parallel, return {category: answer_text}."""
    queries = {
        category: template.format(company=company_name)
        for category, template in QUERY_TEMPLATES.items()
    }

    tasks = {category: _search(query) for category, query in queries.items()}
    results = await asyncio.gather(*tasks.values())

    return dict(zip(tasks.keys(), results))
