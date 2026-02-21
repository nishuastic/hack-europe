"""Tests for Agent 1: Query Planner."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.enrichment.agents.query_planner import (
    SearchPlan,
    SearchQuery,
    _parse_plan_response,
    plan_queries,
)

# ─── SearchQuery / SearchPlan model tests ─────────────────────────────────

def test_search_query_to_dict():
    q = SearchQuery(query="Stripe overview", depth="standard", target_field="description", rationale="Get company info")
    d = q.to_dict()
    assert d["query"] == "Stripe overview"
    assert d["depth"] == "standard"
    assert d["target_field"] == "description"


def test_search_plan_len_and_texts():
    queries = [
        SearchQuery("q1", "standard", "description", "r1"),
        SearchQuery("q2", "deep", "funding", "r2"),
    ]
    plan = SearchPlan(queries=queries)
    assert len(plan) == 2
    assert plan.query_texts == ["q1", "q2"]


# ─── Response parsing tests ──────────────────────────────────────────────

def test_parse_plan_response_with_queries_key():
    raw = json.dumps({
        "queries": [
            {"query": "Stripe overview", "depth": "standard", "target_field": "description", "rationale": "overview"},
            {"query": "Stripe funding", "depth": "deep", "target_field": "funding", "rationale": "funding info"},
        ]
    })
    result = _parse_plan_response(raw)
    assert len(result) == 2
    assert result[0]["query"] == "Stripe overview"


def test_parse_plan_response_as_list():
    raw = json.dumps([
        {"query": "Stripe overview", "depth": "standard", "target_field": "description", "rationale": "overview"},
    ])
    result = _parse_plan_response(raw)
    assert len(result) == 1


def test_parse_plan_response_fenced():
    inner = '{"queries": [{"query": "q1", "depth": "standard", '
    inner += '"target_field": "description", "rationale": "r1"}]}'
    raw = f"```json\n{inner}\n```"
    result = _parse_plan_response(raw)
    assert len(result) == 1


def test_parse_plan_response_invalid():
    with pytest.raises(ValueError, match="Could not parse JSON"):
        _parse_plan_response("not json at all")


# ─── Integration test (mocked Claude) ────────────────────────────────────

@pytest.mark.asyncio
async def test_plan_queries_calls_claude():
    mock_response = MagicMock()
    mock_content = MagicMock()
    mock_content.text = json.dumps({"queries": [
        {"query": "Stripe overview", "depth": "standard",
         "target_field": "description", "rationale": "Get overview"},
        {"query": "Stripe funding", "depth": "standard",
         "target_field": "funding", "rationale": "Funding info"},
        {"query": "Stripe leadership", "depth": "deep",
         "target_field": "contacts", "rationale": "Find leaders"},
    ]})
    mock_response.content = [mock_content]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.enrichment.agents.query_planner._get_claude_client", return_value=mock_client):
        plan = await plan_queries("Stripe")

    assert isinstance(plan, SearchPlan)
    assert len(plan) == 3
    assert plan.queries[0].target_field == "description"
    assert plan.queries[2].depth == "deep"

    mock_client.messages.create.assert_called_once()


@pytest.mark.asyncio
async def test_plan_queries_follow_up():
    """Follow-up queries should be fewer and targeted."""
    mock_response = MagicMock()
    mock_content = MagicMock()
    mock_content.text = json.dumps({"queries": [
        {"query": "Stripe key contacts", "depth": "deep",
         "target_field": "contacts", "rationale": "Fill gap"},
        {"query": "Stripe buying signals", "depth": "deep",
         "target_field": "buying_signals", "rationale": "Fill gap"},
    ]})
    mock_response.content = [mock_content]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("backend.enrichment.agents.query_planner._get_claude_client", return_value=mock_client):
        plan = await plan_queries(
            "Stripe",
            existing_context={"description": "Payments company"},
            gaps=["contacts", "buying_signals"],
            follow_up_hints=["Try searching for VP of Sales"],
        )

    assert len(plan) == 2
    assert plan.queries[0].target_field == "contacts"
