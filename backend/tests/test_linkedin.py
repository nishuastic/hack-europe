"""Tests for the LinkedIn import feature — CSV parsing, matching, and API endpoints."""

import io
import zipfile
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from backend.linkedin.csv_parser import parse_connections_csv, parse_linkedin_zip
from backend.linkedin.matching import find_matches, normalize_company_name

# ─── CSV Parser ──────────────────────────────────────────────────────


class TestParseConnectionsCsv:
    def test_basic_csv(self):
        csv_text = (
            "First Name,Last Name,Email Address,Company,Position,Connected On\n"
            "Alice,Smith,alice@example.com,Stripe,Engineer,01 Jan 2023\n"
            "Bob,Jones,bob@example.com,Plaid,PM,15 Mar 2022\n"
        )
        result = parse_connections_csv(csv_text)
        assert len(result) == 2
        assert result[0]["first_name"] == "Alice"
        assert result[0]["company"] == "Stripe"
        assert result[1]["email"] == "bob@example.com"

    def test_blank_lines_before_header(self):
        csv_text = (
            "Notes:\n"
            "\n"
            "First Name,Last Name,Email Address,Company,Position,Connected On\n"
            "Alice,Smith,,Stripe,Engineer,01 Jan 2023\n"
        )
        result = parse_connections_csv(csv_text)
        assert len(result) == 1
        assert result[0]["email"] is None

    def test_empty_rows_skipped(self):
        csv_text = (
            "First Name,Last Name,Email Address,Company,Position,Connected On\n"
            ",,,,\n"
            "Alice,Smith,,Stripe,Engineer,\n"
            ",,,,\n"
        )
        result = parse_connections_csv(csv_text)
        assert len(result) == 1

    def test_no_header_raises(self):
        csv_text = "foo,bar,baz\n1,2,3\n"
        with pytest.raises(ValueError, match="Could not find header"):
            parse_connections_csv(csv_text)


class TestParseLinkedinZip:
    def test_zip_with_connections_csv(self):
        csv_text = (
            "First Name,Last Name,Email Address,Company,Position,Connected On\n"
            "Alice,Smith,alice@example.com,Stripe,Engineer,01 Jan 2023\n"
        )
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("Connections.csv", csv_text)
        result = parse_linkedin_zip(buf.getvalue())
        assert len(result) == 1
        assert result[0]["first_name"] == "Alice"

    def test_zip_without_connections_csv_raises(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("other.csv", "data")
        with pytest.raises(ValueError, match="No Connections.csv"):
            parse_linkedin_zip(buf.getvalue())


# ─── Company Name Matching ───────────────────────────────────────────


class TestNormalizeCompanyName:
    def test_lowercase_and_strip_suffix(self):
        assert normalize_company_name("Stripe Inc") == "stripe"
        assert normalize_company_name("Plaid, LLC") == "plaid"
        assert normalize_company_name("SAP GmbH") == "sap"

    def test_strips_punctuation(self):
        assert normalize_company_name("Checkout.com") == "checkout com"

    def test_empty_string(self):
        assert normalize_company_name("") == ""


class TestFindMatches:
    def test_exact_match(self):
        connections = [{"id": 1, "company": "Stripe Inc"}]
        leads = [{"id": 10, "company_name": "Stripe"}]
        result = find_matches(connections, leads)
        assert len(result) == 1
        assert result[0] == (1, 10, "exact")

    def test_fuzzy_contains(self):
        connections = [{"id": 1, "company": "Stripe Payments"}]
        leads = [{"id": 10, "company_name": "Stripe"}]
        result = find_matches(connections, leads)
        assert len(result) == 1
        assert result[0][2] == "fuzzy"

    def test_no_match(self):
        connections = [{"id": 1, "company": "Google"}]
        leads = [{"id": 10, "company_name": "Stripe"}]
        result = find_matches(connections, leads)
        assert len(result) == 0

    def test_skips_empty_company(self):
        connections = [{"id": 1, "company": None}]
        leads = [{"id": 10, "company_name": "Stripe"}]
        result = find_matches(connections, leads)
        assert len(result) == 0


# ─── API Endpoints ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_import_csv(client: AsyncClient):
    """Upload a CSV file and verify connections are imported."""
    csv_text = (
        "First Name,Last Name,Email Address,Company,Position,Connected On\n"
        "Alice,Smith,alice@example.com,TestCorp,Engineer,01 Jan 2023\n"
    )
    files = {"file": ("connections.csv", csv_text.encode(), "text/csv")}

    async def noop(*args, **kwargs):
        pass

    with patch("backend.linkedin.pipeline.process_linkedin_import", side_effect=noop):
        resp = await client.post("/api/linkedin/import", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "import_started"
    assert data["connections_found"] == 1


@pytest.mark.asyncio
async def test_import_demo(client: AsyncClient):
    """Test the demo import endpoint."""

    async def noop(*args, **kwargs):
        pass

    with patch("backend.linkedin.pipeline.process_linkedin_import", side_effect=noop):
        resp = await client.post("/api/linkedin/demo")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "demo_import_started"
    assert data["connections_found"] == 20


@pytest.mark.asyncio
async def test_list_connections_empty(client: AsyncClient):
    """List connections when none exist."""
    resp = await client.get("/api/linkedin/connections")
    assert resp.status_code == 200
    assert resp.json()["connections"] == []


@pytest.mark.asyncio
async def test_list_matches_empty(client: AsyncClient):
    """List matches when none exist."""
    resp = await client.get("/api/linkedin/matches")
    assert resp.status_code == 200
    assert resp.json()["matches"] == []


@pytest.mark.asyncio
async def test_clear_connections(client: AsyncClient):
    """Clear connections endpoint works on empty state."""
    resp = await client.delete("/api/linkedin/connections")
    assert resp.status_code == 200
    data = resp.json()
    assert data["deleted"] is True


@pytest.mark.asyncio
async def test_import_invalid_file(client: AsyncClient):
    """Upload a non-CSV/ZIP file should fail."""
    files = {"file": ("data.txt", b"hello world", "text/plain")}
    resp = await client.post("/api/linkedin/import", files=files)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_pipeline_matching():
    """Test the matching logic with mock data through the pipeline."""
    from backend.linkedin.matching import find_matches

    connections = [
        {"id": 1, "company": "Stripe Inc"},
        {"id": 2, "company": "Random Corp"},
        {"id": 3, "company": "Plaid"},
    ]
    leads = [
        {"id": 100, "company_name": "Stripe"},
        {"id": 101, "company_name": "Plaid Technologies"},
    ]
    matches = find_matches(connections, leads)
    # Stripe Inc -> Stripe (exact after normalization)
    # Plaid -> Plaid Technologies (fuzzy, contains)
    assert len(matches) == 2
    conn_ids = [m[0] for m in matches]
    assert 1 in conn_ids
    assert 3 in conn_ids
