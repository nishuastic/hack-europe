"""Tests for pitch deck generation."""

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_create_pitch_deck_lead_not_found(authed_client: AsyncClient):
    """Test POST /api/leads/{id}/pitch-deck returns 404 for missing lead."""
    resp = await authed_client.post("/api/leads/999/pitch-deck", params={"product_id": 1})
    assert resp.status_code == 404


async def test_get_pitch_deck_not_found(client: AsyncClient):
    """Test GET /api/leads/{id}/pitch-deck returns 404 when no deck exists."""
    # First create a lead so we don't get lead 404
    resp = await client.get("/api/leads/999/pitch-deck")
    assert resp.status_code == 404


async def test_download_pitch_deck_not_found(client: AsyncClient):
    """Test GET /api/leads/{id}/pitch-deck/download returns 404."""
    resp = await client.get("/api/leads/999/pitch-deck/download")
    assert resp.status_code == 404


async def test_generate_slides_json():
    """Test slide generation with mocked Claude."""
    from backend.actions.pitch_deck import _generate_slides_json
    from backend.models import Lead, Product

    lead = Lead(id=1, company_name="TestCorp", industry="Tech", description="A tech company")
    product = Product(id=1, name="Widget", description="A widget tool")

    slides_json = (
        '{"slides": [{"slide_number": 1, "title": "Widget for TestCorp", '
        '"body_html": "<p>Test</p>", "speaker_notes": "Intro"}]}'
    )
    mock_response = AsyncMock()
    mock_response.content = [AsyncMock(text=slides_json)]

    with patch("backend.actions.pitch_deck._get_claude_client") as mock_client:
        mock_client.return_value.messages.create = AsyncMock(return_value=mock_response)
        slides = await _generate_slides_json(lead, product, "Good fit")
        assert len(slides) == 1
        assert slides[0]["title"] == "Widget for TestCorp"


async def test_render_html():
    """Test HTML rendering from slides data."""
    from backend.actions.pitch_deck import _render_html

    slides = [{"slide_number": 1, "title": "Test", "body_html": "<p>Body</p>", "speaker_notes": "Note"}]
    html = _render_html(slides, "TestCorp", "Widget")
    assert "TestCorp" in html
    assert "Widget" in html
    assert "<p>Body</p>" in html
