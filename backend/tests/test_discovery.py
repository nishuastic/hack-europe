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

    result = await _exec_search_companies("fintech startups", "standard", set())
    assert len(result["companies"]) == 2
    assert result["companies"][0]["name"] == "Acme Corp"


@pytest.mark.asyncio
@patch("backend.discovery.icp_agent._get_client")
async def test_exec_search_companies_excludes_urls(mock_get_client):
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

    result = await _exec_search_companies("fintech startups", "standard", {"https://acme.com"})
    assert len(result["companies"]) == 1
    assert result["companies"][0]["name"] == "Beta Inc"


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
    await run_discovery(None, 5, ws_manager)

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
    await run_discovery(None, 5, ws_manager)

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
    await run_discovery(None, 5, ws_manager)

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
