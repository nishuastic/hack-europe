"""Tests for enrichment utilities (JSON parsing, etc.)."""

import pytest

from backend.enrichment.claude_enricher import _parse_json_response


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
