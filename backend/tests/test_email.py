"""Tests for email generation."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_create_email_lead_not_found(authed_client: AsyncClient):
    """Test POST /api/leads/{id}/email returns 404 for missing lead."""
    resp = await authed_client.post("/api/leads/999/email", params={"product_id": 1})
    assert resp.status_code == 404


async def test_generate_email():
    """Test email generation with mocked Claude."""
    from backend.actions.email_generator import generate_email
    from backend.models import Lead, Product

    lead = Lead(
        id=1, company_name="TestCorp", industry="Tech",
        description="A tech company", contacts=[{"name": "Alice", "role": "CTO"}],
    )
    product = Product(id=1, name="Widget", description="A widget tool")

    email_json = '{"subject": "Widget for TestCorp", "body": "Hi Alice, ..."}'
    mock_response = AsyncMock()
    mock_response.content = [AsyncMock(text=email_json)]

    with patch("backend.actions.email_generator._get_claude_client") as mock_client:
        mock_client.return_value.messages.create = AsyncMock(return_value=mock_response)
        result = await generate_email(lead, product, "Good fit")
        assert result["subject"] == "Widget for TestCorp"
        assert result["contact_name"] == "Alice"
        assert result["contact_role"] == "CTO"
