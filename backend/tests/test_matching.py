"""Tests for product matching pipeline."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from backend.models import EnrichmentStatus


@pytest.fixture
async def seeded_data(client: AsyncClient):
    """Create products and an enriched lead for matching tests."""
    # Create products
    await client.post("/api/products", json={
        "products": [
            {"name": "CloudSync", "description": "Cloud sync platform for enterprises"},
            {"name": "DataPipe", "description": "Real-time data pipeline tool"},
        ]
    })

    # Create a lead
    resp = await client.post("/api/leads/import", json={"companies": ["TestCorp"]})
    lead_id = resp.json()["lead_ids"][0]

    # Manually set lead as enriched (skip actual enrichment)
    from backend.tests.conftest import TestSession

    async with TestSession() as session:
        from sqlmodel import select

        from backend.models import Lead

        lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one()
        lead.enrichment_status = EnrichmentStatus.COMPLETE
        lead.industry = "Technology"
        lead.description = "A test company"
        lead.funding = "Series B, $50M"
        session.add(lead)
        await session.commit()

    return lead_id


async def test_generate_matches_endpoint(client: AsyncClient, seeded_data: int):
    """Test POST /api/matches/generate returns 200."""
    with patch("backend.matching.pipeline.generate_all_matches", new_callable=AsyncMock):
        resp = await client.post("/api/matches/generate")
        assert resp.status_code == 200
        assert resp.json()["status"] == "matching_started"


async def test_list_matches_empty(client: AsyncClient):
    """Test GET /api/matches returns empty list when no matches exist."""
    resp = await client.get("/api/matches")
    assert resp.status_code == 200
    assert resp.json()["matches"] == []


async def test_list_matches_with_filters(client: AsyncClient):
    """Test GET /api/matches with lead_id and product_id filters."""
    resp = await client.get("/api/matches", params={"lead_id": 1, "product_id": 1})
    assert resp.status_code == 200
    assert resp.json()["matches"] == []


async def test_match_lead_to_products():
    """Test the core matching function with mocked Claude."""
    from backend.matching.pipeline import match_lead_to_products
    from backend.models import Lead, Product

    lead = Lead(id=1, company_name="TestCorp", industry="Tech", description="A tech company")
    products = [Product(id=1, name="Widget", description="A widget tool")]

    mock_response = AsyncMock()
    mock_json = (
        '{"matches": [{"product_id": 1, "match_score": 7.5, '
        '"match_reasoning": "Good fit", "conversion_likelihood": "medium", '
        '"conversion_reasoning": "Moderate fit"}]}'
    )
    mock_response.content = [AsyncMock(text=mock_json)]

    with patch("backend.matching.pipeline._get_claude_client") as mock_client:
        mock_client.return_value.messages.create = AsyncMock(return_value=mock_response)
        matches = await match_lead_to_products(lead, products)
        assert len(matches) == 1
        assert matches[0]["match_score"] == 7.5
        assert matches[0]["product_id"] == 1
