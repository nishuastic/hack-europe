"""Tests for the multi-agent enrichment pipeline."""

from unittest.mock import AsyncMock, patch

import pytest

from backend.enrichment.agents.data_extractor import ExtractionResult, FieldConfidence
from backend.enrichment.agents.query_planner import SearchPlan, SearchQuery
from backend.enrichment.agents.search_executor import SearchResult
from backend.enrichment.pipeline import _should_follow_up

# ─── Follow-up decision tests ─────────────────────────────────────────────

def test_should_follow_up_with_important_gaps():
    extraction = ExtractionResult(
        data={"description": "A company"},
        field_confidences=[],
        gaps=["funding", "contacts"],
        follow_up_hints=["Search for funding info"],
    )
    assert _should_follow_up(extraction, round_num=1) is True


def test_should_not_follow_up_at_max_rounds():
    extraction = ExtractionResult(
        data={"description": "A company"},
        field_confidences=[],
        gaps=["funding", "contacts"],
        follow_up_hints=[],
    )
    assert _should_follow_up(extraction, round_num=2) is False


def test_should_not_follow_up_no_important_gaps():
    extraction = ExtractionResult(
        data={"description": "A company", "funding": "Series A", "industry": "SaaS"},
        field_confidences=[],
        gaps=["revenue"],  # revenue is not in _IMPORTANT_FIELDS
        follow_up_hints=[],
    )
    assert _should_follow_up(extraction, round_num=1) is False


def test_should_not_follow_up_no_gaps():
    extraction = ExtractionResult(
        data={"description": "ok", "funding": "ok", "industry": "ok"},
        field_confidences=[],
        gaps=[],
        follow_up_hints=[],
    )
    assert _should_follow_up(extraction, round_num=1) is False


# ─── Pipeline integration tests (all agents mocked) ───────────────────────

def _make_plan(n_queries: int = 3) -> SearchPlan:
    return SearchPlan(queries=[
        SearchQuery(f"q{i}", "standard", "description", f"r{i}")
        for i in range(n_queries)
    ])


def _make_search_results(n: int = 3) -> list[SearchResult]:
    return [
        SearchResult(f"field_{i}", f"q{i}", f"answer {i}", [], "standard")
        for i in range(n)
    ]


def _make_extraction(gaps: list[str] | None = None) -> ExtractionResult:
    return ExtractionResult(
        data={
            "description": "A payments company",
            "funding": "Series H, $600M",
            "industry": "Fintech",
            "revenue": "$14B",
            "employees": 8000,
            "contacts": [{"name": "Patrick Collison", "role": "CEO"}],
            "customers": ["Amazon", "Google"],
            "buying_signals": [{"signal_type": "expansion", "description": "Expanding to Asia", "strength": "strong"}],
        },
        field_confidences=[FieldConfidence("description", "high", "Multiple sources")],
        gaps=gaps or [],
        follow_up_hints=["Search for more contacts"] if gaps else [],
    )


def _mock_db_session(mock_lead):
    """Create a properly mocked async DB session context manager."""
    mock_session = AsyncMock()
    mock_exec_result = AsyncMock()
    mock_exec_result.scalar_one_or_none = lambda: mock_lead
    mock_session.execute.return_value = mock_exec_result
    mock_session.add = lambda x: None
    mock_session.commit = AsyncMock()

    mock_ctx = AsyncMock()
    mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_ctx


@pytest.mark.asyncio
@patch("backend.enrichment.pipeline.extract_lead_data")
@patch("backend.enrichment.pipeline.execute_searches")
@patch("backend.enrichment.pipeline.plan_queries")
async def test_pipeline_single_round(mock_plan, mock_search, mock_extract):
    """Pipeline completes in 1 round when no important gaps."""
    mock_plan.return_value = _make_plan()
    mock_search.return_value = _make_search_results()
    mock_extract.return_value = _make_extraction(gaps=[])

    ws_manager = AsyncMock()

    from backend.models import EnrichmentStatus, Lead
    mock_lead = Lead(
        id=1, company_name="Stripe",
        enrichment_status=EnrichmentStatus.PENDING,
    )

    with patch(
        "backend.enrichment.pipeline.async_session",
        return_value=_mock_db_session(mock_lead),
    ):
        from backend.enrichment.pipeline import enrich_lead
        await enrich_lead(1, ws_manager)

    mock_plan.assert_called_once()
    mock_search.assert_called_once()
    mock_extract.assert_called_once()

    broadcast_calls = ws_manager.broadcast.call_args_list
    message_types = [call[0][0]["type"] for call in broadcast_calls]
    assert "enrichment_start" in message_types
    assert "enrichment_complete" in message_types
    assert "agent_thinking" in message_types


@pytest.mark.asyncio
@patch("backend.enrichment.pipeline.extract_lead_data")
@patch("backend.enrichment.pipeline.execute_searches")
@patch("backend.enrichment.pipeline.plan_queries")
async def test_pipeline_two_rounds(mock_plan, mock_search, mock_extract):
    """Pipeline does 2 rounds when first round has important gaps."""
    mock_plan.return_value = _make_plan()
    mock_search.return_value = _make_search_results()

    extraction_with_gaps = _make_extraction(
        gaps=["contacts", "buying_signals"],
    )
    extraction_complete = _make_extraction(gaps=[])
    mock_extract.side_effect = [extraction_with_gaps, extraction_complete]

    ws_manager = AsyncMock()

    from backend.models import EnrichmentStatus, Lead
    mock_lead = Lead(
        id=1, company_name="Stripe",
        enrichment_status=EnrichmentStatus.PENDING,
    )

    with patch(
        "backend.enrichment.pipeline.async_session",
        return_value=_mock_db_session(mock_lead),
    ):
        from backend.enrichment.pipeline import enrich_lead
        await enrich_lead(1, ws_manager)

    assert mock_plan.call_count == 2
    assert mock_search.call_count == 2
    assert mock_extract.call_count == 2

    broadcast_calls = ws_manager.broadcast.call_args_list
    thinking_actions = [
        call[0][0].get("action") for call in broadcast_calls
        if call[0][0]["type"] == "agent_thinking"
    ]
    assert "follow_up_needed" in thinking_actions
