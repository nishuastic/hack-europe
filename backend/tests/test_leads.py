"""Tests for Lead import + list endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@patch("backend.main.enrich_leads", new_callable=AsyncMock)
async def test_import_leads(mock_enrich: AsyncMock, client: AsyncClient):
    resp = await client.post("/api/leads/import", json={
        "companies": ["Stripe", "Plaid", "Revolut"]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["leads_created"] == 3
    assert len(data["lead_ids"]) == 3
    assert data["status"] == "enrichment_started"


@pytest.mark.asyncio
@patch("backend.main.enrich_leads", new_callable=AsyncMock)
async def test_list_leads(mock_enrich: AsyncMock, client: AsyncClient):
    await client.post("/api/leads/import", json={
        "companies": ["Acme", "Globex"]
    })

    resp = await client.get("/api/leads")
    assert resp.status_code == 200
    leads = resp.json()["leads"]
    assert len(leads) == 2
    names = {lead["company_name"] for lead in leads}
    assert names == {"Acme", "Globex"}


@pytest.mark.asyncio
@patch("backend.main.enrich_leads", new_callable=AsyncMock)
async def test_get_single_lead(mock_enrich: AsyncMock, client: AsyncClient):
    resp = await client.post("/api/leads/import", json={
        "companies": ["Solo Corp"]
    })
    lid = resp.json()["lead_ids"][0]

    resp = await client.get(f"/api/leads/{lid}")
    assert resp.status_code == 200
    assert resp.json()["company_name"] == "Solo Corp"
    assert resp.json()["enrichment_status"] == "pending"


@pytest.mark.asyncio
async def test_get_missing_lead_404(client: AsyncClient):
    resp = await client.get("/api/leads/9999")
    assert resp.status_code == 404
