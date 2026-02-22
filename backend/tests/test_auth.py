"""Tests for auth: register, login, /me."""

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


@pytest.fixture
async def raw_client():
    """Unauthenticated client for auth tests."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_register(raw_client: AsyncClient):
    resp = await raw_client.post("/api/auth/register", json={"email": "a@b.com", "password": "secret", "name": "Alice"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "a@b.com"
    assert data["user"]["name"] == "Alice"


@pytest.mark.asyncio
async def test_register_duplicate(raw_client: AsyncClient):
    await raw_client.post("/api/auth/register", json={"email": "dup@b.com", "password": "pw"})
    resp = await raw_client.post("/api/auth/register", json={"email": "dup@b.com", "password": "pw"})
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login(raw_client: AsyncClient):
    await raw_client.post("/api/auth/register", json={"email": "login@b.com", "password": "pass123"})
    resp = await raw_client.post("/api/auth/login", json={"email": "login@b.com", "password": "pass123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(raw_client: AsyncClient):
    await raw_client.post("/api/auth/register", json={"email": "wrong@b.com", "password": "correct"})
    resp = await raw_client.post("/api/auth/login", json={"email": "wrong@b.com", "password": "incorrect"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_valid_token(raw_client: AsyncClient):
    resp = await raw_client.post("/api/auth/register", json={"email": "me@b.com", "password": "pw"})
    token = resp.json()["access_token"]
    resp = await raw_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@b.com"


@pytest.mark.asyncio
async def test_me_invalid_token(raw_client: AsyncClient):
    resp = await raw_client.get("/api/auth/me", headers={"Authorization": "Bearer bad-token"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_no_token(raw_client: AsyncClient):
    resp = await raw_client.get("/api/auth/me")
    assert resp.status_code == 401
