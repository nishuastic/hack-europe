"""Tests for Agent 2: Search Executor — single consolidated LinkUp call."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.enrichment.agents.search_executor import SearchResult, execute_single_enrichment_search

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


# ─── Single enrichment search tests (mocked LinkUp) ─────────────────────

@pytest.mark.asyncio
async def test_execute_single_enrichment_search_round1():
    """Round 1: broad search returns structured data for all fields."""
    mock_response = MagicMock()
    mock_response.output = '{"description": "Stripe is a payments company", "industry": "Fintech"}'
    mock_response.sources = []

    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(return_value=mock_response)

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        result = await execute_single_enrichment_search(
            company_name="Stripe",
            company_url="https://stripe.com",
        )

    assert isinstance(result, SearchResult)
    assert result.target_field == "all"
    assert result.depth == "standard"
    assert mock_client.async_search.call_count == 1
    # Verify structured output was requested
    call_kwargs = mock_client.async_search.call_args[1]
    assert call_kwargs["output_type"] == "structured"


@pytest.mark.asyncio
async def test_execute_single_enrichment_search_round2_followup():
    """Round 2: targeted follow-up only queries for gap fields."""
    mock_response = MagicMock()
    mock_response.output = '{"funding": "Series C, $200M", "contacts": []}'
    mock_response.sources = []

    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(return_value=mock_response)

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        result = await execute_single_enrichment_search(
            company_name="Stripe",
            gaps=["funding", "contacts"],
            existing_context={"description": "A payments company", "industry": "Fintech"},
        )

    assert isinstance(result, SearchResult)
    assert mock_client.async_search.call_count == 1
    # Query should mention the gap fields
    query = mock_client.async_search.call_args[1]["query"]
    assert "funding" in query
    assert "contacts" in query


@pytest.mark.asyncio
async def test_execute_single_enrichment_search_handles_errors():
    """Failed search returns error SearchResult instead of crashing."""
    mock_client = MagicMock()
    mock_client.async_search = AsyncMock(side_effect=Exception("API rate limit"))

    with patch("backend.enrichment.agents.search_executor._get_client", return_value=mock_client):
        result = await execute_single_enrichment_search(company_name="Stripe")

    assert isinstance(result, SearchResult)
    assert "error" in result.answer
