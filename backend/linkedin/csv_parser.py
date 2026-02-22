"""Parse LinkedIn data exports (ZIP or raw CSV) into connection dicts."""

import csv
import io
import zipfile


def parse_linkedin_zip(zip_bytes: bytes) -> list[dict]:
    """Extract Connections.csv from a LinkedIn data export ZIP and parse it."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # LinkedIn exports have Connections.csv at the root or in a subdirectory
        csv_name = None
        for name in zf.namelist():
            if name.lower().endswith("connections.csv"):
                csv_name = name
                break
        if csv_name is None:
            raise ValueError("No Connections.csv found in ZIP archive")
        csv_text = zf.read(csv_name).decode("utf-8-sig")
    return parse_connections_csv(csv_text)


def parse_connections_csv(csv_text: str) -> list[dict]:
    """Parse raw LinkedIn Connections CSV text into a list of connection dicts.

    Handles LinkedIn quirks: possible blank/notes lines before the real header,
    missing columns, and empty rows.
    """
    lines = csv_text.strip().splitlines()

    # Find the header line (contains "First Name")
    header_idx = None
    for i, line in enumerate(lines):
        if "First Name" in line:
            header_idx = i
            break

    if header_idx is None:
        raise ValueError("Could not find header row with 'First Name' in CSV")

    # Parse from the header line onward
    reader = csv.DictReader(lines[header_idx:])
    connections: list[dict] = []
    for row in reader:
        first = (row.get("First Name") or "").strip()
        last = (row.get("Last Name") or "").strip()
        if not first and not last:
            continue  # skip empty rows
        connections.append({
            "first_name": first,
            "last_name": last,
            "email": (row.get("Email Address") or row.get("Email") or "").strip() or None,
            "company": (row.get("Company") or "").strip() or None,
            "position": (row.get("Position") or "").strip() or None,
            "connected_on": (row.get("Connected On") or "").strip() or None,
        })
    return connections
