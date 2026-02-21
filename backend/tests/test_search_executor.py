"""Tests for Agent 2: Search Executor."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.enrichment.agents.query_planner import SearchPlan, SearchQuery
from backend.enrichment.agents.search_executor import SearchResult, execute_searches

# ─── SearchResult model tests ─────────────────────────────────────────────

def test_search_result_to_dict():
    sr = SearchResult(
        target_field="description",
        query="Stripe overview",
        answer="Stripe is a payments company",
        sources=[{"name": "Wikipedia", "url": "https://en.wikipedia.org", "snippet": "..."}],
        depth="standard",
    )
    d = sr.to_dict()
    assert d["target_field"] == "description"
    assert d["answer"] == "Stripe is a payments company"
    assert len(d["sources"]) == 1


# ─── Parallel execution tests (mocked LinkUp) ────────────────────────────

@pytest.mark.asyncio
async def test_execute_searches_parallel():
    """All queries execute in parallel and return SearchResults."""
    mock_response = MagicMock()
    mock_response.output = "Stripe is a payments company"
    mock_response.sources = []

    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(return_value=mock_response)

    plan = SearchPlan(queries=[
        SearchQuery("Stripe overview", "standard", "description", "r1"),
        SearchQuery("Stripe funding", "standard", "funding", "r2"),
        SearchQuery("Stripe news", "standard", "buying_signals", "r3"),
    ])

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        results = await execute_searches(plan)

    assert len(results) == 3
    assert all(isinstance(r, SearchResult) for r in results)
    assert results[0].target_field == "description"
    assert results[1].target_field == "funding"
    assert mock_client.async_search.call_count == 3


@pytest.mark.asyncio
async def test_execute_searches_handles_errors():
    """Failed searches return error SearchResults instead of crashing."""
    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(side_effect=Exception("API rate limit"))

    plan = SearchPlan(queries=[
        SearchQuery("failing query", "standard", "description", "test"),
    ])

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        results = await execute_searches(plan)

    assert len(results) == 1
    assert "[Search error:" in results[0].answer


@pytest.mark.asyncio
async def test_execute_searches_structured_for_contacts():
    """Contacts field should use structured output type."""
    mock_response = MagicMock()
    mock_response.output = '{"contacts": [{"name": "Alice", "role": "CEO"}]}'
    # No sources attribute for structured output
    del mock_response.sources

    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(return_value=mock_response)

    plan = SearchPlan(queries=[
        SearchQuery("Stripe leadership", "standard", "contacts", "find contacts"),
    ])

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        results = await execute_searches(plan)

    assert len(results) == 1
    assert results[0].target_field == "contacts"
    # Verify structured output was requested
    call_kwargs = mock_client.async_search.call_args[1]
    assert call_kwargs["output_type"] == "structured"
