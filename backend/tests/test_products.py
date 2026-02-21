"""Tests for Product CRUD endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_products(client: AsyncClient):
    resp = await client.post("/api/products", json={
        "products": [
            {"name": "Widget Pro", "description": "Best widget"},
            {"name": "Gadget X", "description": "Top gadget"},
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["products"]) == 2
    assert data["products"][0]["name"] == "Widget Pro"

    resp = await client.get("/api/products")
    assert resp.status_code == 200
    assert len(resp.json()["products"]) == 2


@pytest.mark.asyncio
async def test_get_single_product(client: AsyncClient):
    resp = await client.post("/api/products", json={
        "products": [{"name": "Solo", "description": "Only one"}]
    })
    pid = resp.json()["products"][0]["id"]

    resp = await client.get(f"/api/products/{pid}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Solo"


@pytest.mark.asyncio
async def test_get_missing_product_404(client: AsyncClient):
    resp = await client.get("/api/products/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_product(client: AsyncClient):
    resp = await client.post("/api/products", json={
        "products": [{"name": "Old Name", "description": "desc"}]
    })
    pid = resp.json()["products"][0]["id"]

    resp = await client.put(f"/api/products/{pid}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["description"] == "desc"  # unchanged


@pytest.mark.asyncio
async def test_delete_product(client: AsyncClient):
    resp = await client.post("/api/products", json={
        "products": [{"name": "Doomed", "description": "bye"}]
    })
    pid = resp.json()["products"][0]["id"]

    resp = await client.delete(f"/api/products/{pid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True

    resp = await client.get(f"/api/products/{pid}")
    assert resp.status_code == 404
