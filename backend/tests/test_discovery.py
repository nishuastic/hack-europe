"""Tests for the ICP discovery pipeline."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.discovery.prompts import build_discovery_prompt
from backend.models import Lead, Product

# ─── Prompt builder tests ────────────────────────────────────────────────

def _make_product(**kwargs) -> Product:
    defaults = {
        "id": 1,
        "name": "TestProduct",
        "description": "A test product for testing",
    }
    defaults.update(kwargs)
    return Product(**defaults)


def test_build_discovery_prompt_basic():
    products = [_make_product()]
    prompt = build_discovery_prompt(products)
    assert "TestProduct" in prompt
    assert "A test product for testing" in prompt
    assert "Ideal Customer Profiles" in prompt
    assert "queries" in prompt  # JSON output format
    assert "search_companies" not in prompt  # No old tool references


def test_build_discovery_prompt_includes_all_fields():
    products = [_make_product(
        industry_focus="Fintech",
        company_size_target="mid-market",
        geography="Europe",
        stage="scaling",
        pricing_model="SaaS",
        differentiator="AI-powered",
        features=["feature1", "feature2"],
        example_clients=["ClientA", "ClientB"],
        company_name="SellerCo",
        website="https://seller.com",
    )]
    prompt = build_discovery_prompt(products)
    assert "Fintech" in prompt
    assert "mid-market" in prompt
    assert "Europe" in prompt
    assert "scaling" in prompt
    assert "SaaS" in prompt
    assert "AI-powered" in prompt
    assert "feature1" in prompt
    assert "ClientA" in prompt
    assert "SellerCo" in prompt
    assert "https://seller.com" in prompt


def test_build_discovery_prompt_multiple_products():
    products = [
        _make_product(id=1, name="Product A", description="First product"),
        _make_product(id=2, name="Product B", description="Second product"),
    ]
    prompt = build_discovery_prompt(products)
    assert "Product A" in prompt
    assert "Product B" in prompt
    assert "Product 1" in prompt
    assert "Product 2" in prompt


# ─── Tool execution tests ───────────────────────────────────────────────

@pytest.mark.asyncio
@patch("backend.discovery.icp_agent._get_client")
async def test_exec_search_companies(mock_get_client):
    from backend.discovery.icp_agent import _exec_search_companies

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.output = {
        "companies": [
            {"name": "Acme Corp", "url": "https://acme.com", "description": "A corp", "industry": "Tech"},
            {"name": "Beta Inc", "url": "https://beta.com", "description": "B corp", "industry": "Finance"},
        ],
    }
    mock_client.async_search = AsyncMock(return_value=mock_response)
    mock_get_client.return_value = mock_client

    product_id, result = await _exec_search_companies("fintech startups", "standard", 1)
    assert product_id == 1
    assert len(result["companies"]) == 2
    assert result["companies"][0]["name"] == "Acme Corp"


@pytest.mark.asyncio
@patch("backend.discovery.icp_agent._plan_discovery_queries")
@patch("backend.discovery.icp_agent._get_client")
async def test_search_all_products_multi_product_mapping(mock_get_client, mock_plan):
    """When two product searches return the same URL, the candidate has both product IDs."""
    from backend.discovery.icp_agent import _search_all_products

    # Return no planned queries so fallback is used
    mock_plan.return_value = []

    mock_client = MagicMock()

    # Both searches return the same company URL
    async def fake_search(**kwargs):
        resp = MagicMock()
        resp.output = {
            "companies": [
                {"name": "Acme Corp", "url": "https://acme.com", "description": "A corp", "industry": "Tech"},
            ],
        }
        return resp

    mock_client.async_search = AsyncMock(side_effect=fake_search)
    mock_get_client.return_value = mock_client

    product_a = _make_product(id=1, name="Product A", description="First product", industry_focus="Tech")
    product_b = _make_product(id=2, name="Product B", description="Second product", industry_focus="Finance")

    candidates = await _search_all_products([product_a, product_b])

    # Should have exactly one candidate (merged), with both product IDs
    acme_candidates = [c for c in candidates if c.get("url") == "https://acme.com"]
    assert len(acme_candidates) == 1
    assert 1 in acme_candidates[0]["matched_product_ids"]
    assert 2 in acme_candidates[0]["matched_product_ids"]
    assert "Product A" in acme_candidates[0]["matched_product_names"]
    assert "Product B" in acme_candidates[0]["matched_product_names"]


# ─── Discovery pipeline integration tests ────────────────────────────────

def _mock_db_session_for_discovery():
    """Create a mocked async DB session for discovery pipeline."""
    mock_session = AsyncMock()
    lead_counter = [0]
    call_counter = [0]

    async def mock_execute(stmt):
        call_counter[0] += 1
        result = MagicMock()
        # First call is select(Product) — return products
        if call_counter[0] == 1:
            result.scalars = lambda: MagicMock(all=lambda: [_make_product()])
        else:
            # Subsequent calls are dedup checks — return None (no duplicates)
            result.scalar_one_or_none = lambda: None
        return result

    mock_session.execute = mock_execute
    mock_session.add = MagicMock()

    async def mock_commit():
        pass

    mock_session.commit = mock_commit

    async def mock_refresh(obj):
        if isinstance(obj, Lead) and obj.id is None:
            lead_counter[0] += 1
            obj.id = lead_counter[0]

    mock_session.refresh = mock_refresh

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_ctx


@pytest.mark.asyncio
@patch("backend.discovery.discovery_pipeline.enrich_leads")
@patch("backend.discovery.discovery_pipeline.run_discovery_agent")
@patch("backend.discovery.discovery_pipeline.async_session")
async def test_discovery_pipeline_creates_leads(mock_async_session, mock_agent, mock_enrich):
    """Discovery pipeline creates Lead rows from agent results."""
    mock_async_session.return_value = _mock_db_session_for_discovery()

    mock_agent.return_value = [
        {
            "company_name": "Acme Corp",
            "company_url": "https://acme.com",
            "description": "A technology company",
            "industry": "Technology",
            "why_good_fit": "Great match for our product",
        },
        {
            "company_name": "Beta Inc",
            "company_url": "https://beta.com",
            "description": "A finance company",
            "industry": "Finance",
            "why_good_fit": "Strong buying signals",
        },
    ]

    ws_manager = AsyncMock()

    from backend.discovery.discovery_pipeline import run_discovery
    await run_discovery(None, 5, ws_manager, 1)

    # Verify agent was called
    mock_agent.assert_called_once()

    # Verify broadcasts
    broadcast_calls = ws_manager.broadcast.call_args_list
    message_types = [call[0][0]["type"] for call in broadcast_calls]
    assert "discovery_start" in message_types
    assert "company_discovered" in message_types
    assert "discovery_complete" in message_types


@pytest.mark.asyncio
@patch("backend.discovery.discovery_pipeline.run_discovery_agent")
@patch("backend.discovery.discovery_pipeline.async_session")
async def test_discovery_pipeline_no_products(mock_async_session, mock_agent):
    """Discovery pipeline handles no products gracefully."""
    mock_session = AsyncMock()
    mock_exec_result = AsyncMock()
    mock_exec_result.scalars = lambda: MagicMock(all=lambda: [])
    mock_session.execute.return_value = mock_exec_result

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_async_session.return_value = mock_ctx

    ws_manager = AsyncMock()

    from backend.discovery.discovery_pipeline import run_discovery
    await run_discovery(None, 5, ws_manager, 1)

    mock_agent.assert_not_called()

    broadcast_calls = ws_manager.broadcast.call_args_list
    message_types = [call[0][0]["type"] for call in broadcast_calls]
    assert "discovery_error" in message_types


@pytest.mark.asyncio
@patch("backend.discovery.discovery_pipeline.enrich_leads")
@patch("backend.discovery.discovery_pipeline.run_discovery_agent")
@patch("backend.discovery.discovery_pipeline.async_session")
async def test_discovery_pipeline_empty_results(mock_async_session, mock_agent, mock_enrich):
    """Discovery pipeline handles empty agent results."""
    mock_async_session.return_value = _mock_db_session_for_discovery()
    mock_agent.return_value = []

    ws_manager = AsyncMock()

    from backend.discovery.discovery_pipeline import run_discovery
    await run_discovery(None, 5, ws_manager, 1)

    broadcast_calls = ws_manager.broadcast.call_args_list
    message_types = [call[0][0]["type"] for call in broadcast_calls]
    assert "discovery_complete" in message_types

    # Should not trigger enrichment for empty results
    mock_enrich.assert_not_called()


# ─── API endpoint test ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_discovery_endpoint(client):
    """POST /api/discovery/run returns 200 with status."""
    with patch("backend.main.run_discovery"):
        response = await client.post("/api/discovery/run", json={"max_companies": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "discovery_started"
    assert data["max_companies"] == 5


@pytest.mark.asyncio
async def test_discovery_endpoint_defaults(client):
    """POST /api/discovery/run works with default max_companies."""
    with patch("backend.main.run_discovery"):
        response = await client.post("/api/discovery/run", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["max_companies"] == 20


# ─── Claude query planning tests ─────────────────────────────────────────

@pytest.mark.asyncio
@patch("backend.discovery.icp_agent._get_claude_client")
async def test_plan_discovery_queries_success(mock_get_client):
    """Claude returns valid JSON queries."""
    from backend.discovery.icp_agent import _plan_discovery_queries

    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.text = (
        '{"queries": [{"query": "fintech startups Europe",'
        ' "depth": "standard", "icp_rationale": "Industry match"}]}'
    )
    mock_response.content = [mock_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)
    mock_get_client.return_value = mock_client

    products = [_make_product(industry_focus="Fintech")]
    result = await _plan_discovery_queries(products)
    assert len(result) == 1
    assert result[0]["query"] == "fintech startups Europe"
    assert result[0]["depth"] == "standard"


@pytest.mark.asyncio
@patch("backend.discovery.icp_agent._get_claude_client")
async def test_plan_discovery_queries_bad_json_falls_back(mock_get_client):
    """Claude returns invalid JSON — function returns empty list."""
    from backend.discovery.icp_agent import _plan_discovery_queries

    mock_response = MagicMock()
    mock_block = MagicMock()
    mock_block.text = "This is not valid JSON at all"
    mock_response.content = [mock_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)
    mock_get_client.return_value = mock_client

    products = [_make_product()]
    result = await _plan_discovery_queries(products)
    assert result == []


def test_build_search_queries_fallback():
    """Fallback query builder returns list of dicts with expected keys."""
    from backend.discovery.icp_agent import _build_search_queries_fallback

    product = _make_product(
        industry_focus="Fintech",
        company_size_target="mid-market",
        geography="Europe",
    )
    queries = _build_search_queries_fallback(product)
    assert len(queries) == 3  # capped at 3
    for q in queries:
        assert "query" in q
        assert "depth" in q
        assert "icp_rationale" in q
