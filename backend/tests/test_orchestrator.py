"""Tests for the agent orchestrator."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_run_agent_endpoint(client: AsyncClient):
    """Test POST /api/agent/run returns 200."""
    with patch("backend.agent.orchestrator.run_agent", new_callable=AsyncMock):
        resp = await client.post("/api/agent/run", json={"task": "Research Stripe"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "agent_started"


async def test_run_agent_missing_task(client: AsyncClient):
    """Test POST /api/agent/run with missing task returns 422."""
    resp = await client.post("/api/agent/run", json={})
    assert resp.status_code == 422
