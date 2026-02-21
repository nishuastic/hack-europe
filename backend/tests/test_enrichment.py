"""Tests for enrichment utilities (JSON parsing, data extractor models)."""

import pytest

from backend.enrichment.agents.data_extractor import (
    ExtractionResult,
    FieldConfidence,
    _infer_gaps,
    _parse_json_response,
)

# ─── JSON parsing tests (migrated from claude_enricher) ──────────────────

def test_parse_plain_json():
    raw = '{"description": "A fintech company", "employees": 150}'
    result = _parse_json_response(raw)
    assert result["description"] == "A fintech company"
    assert result["employees"] == 150


def test_parse_fenced_json():
    raw = '```json\n{"industry": "SaaS", "revenue": "$10M"}\n```'
    result = _parse_json_response(raw)
    assert result["industry"] == "SaaS"


def test_parse_fenced_no_lang():
    raw = '```\n{"funding": "Series A"}\n```'
    result = _parse_json_response(raw)
    assert result["funding"] == "Series A"


def test_parse_invalid_json_raises():
    with pytest.raises(ValueError, match="Could not parse JSON"):
        _parse_json_response("This is not JSON at all")


def test_parse_json_with_surrounding_text():
    raw = 'Here is the data:\n```json\n{"description": "test"}\n```\nDone!'
    result = _parse_json_response(raw)
    assert result["description"] == "test"


# ─── ExtractionResult model tests ─────────────────────────────────────────

def test_extraction_result_to_dict():
    result = ExtractionResult(
        data={"description": "A company", "funding": "Series A"},
        field_confidences=[
            FieldConfidence(field="description", confidence="high", reason="Multiple sources"),
        ],
        gaps=["contacts"],
        follow_up_hints=["Search for CEO name"],
    )
    d = result.to_dict()
    assert d["data"]["description"] == "A company"
    assert len(d["field_confidences"]) == 1
    assert d["field_confidences"][0]["field"] == "description"
    assert d["gaps"] == ["contacts"]
    assert d["follow_up_hints"] == ["Search for CEO name"]


def test_field_confidence_to_dict():
    fc = FieldConfidence(field="funding", confidence="medium", reason="Single source only")
    d = fc.to_dict()
    assert d == {"field": "funding", "confidence": "medium", "reason": "Single source only"}


# ─── Gap inference tests ──────────────────────────────────────────────────

def test_infer_gaps_all_present():
    data = {
        "description": "A company",
        "funding": "Series A",
        "industry": "SaaS",
        "contacts": [{"name": "Alice", "role": "CEO"}],
        "buying_signals": [{"signal_type": "recent_funding", "description": "Raised $10M", "strength": "strong"}],
    }
    gaps = _infer_gaps(data)
    assert gaps == []


def test_infer_gaps_missing_fields():
    data = {"description": "A company", "industry": "SaaS"}
    gaps = _infer_gaps(data)
    assert "funding" in gaps
    assert "contacts" in gaps
    assert "buying_signals" in gaps
    assert "description" not in gaps


def test_infer_gaps_empty_lists():
    data = {"description": "A company", "funding": "Series A", "industry": "SaaS", "contacts": [], "buying_signals": []}
    gaps = _infer_gaps(data)
    assert "contacts" in gaps
    assert "buying_signals" in gaps


def test_infer_gaps_null_values():
    data = {"description": None, "funding": None, "industry": None, "contacts": None, "buying_signals": None}
    gaps = _infer_gaps(data)
    assert len(gaps) == 5
