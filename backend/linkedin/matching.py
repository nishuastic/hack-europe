"""Fuzzy company name matching between LinkedIn connections and leads."""

import difflib
import re

# Common suffixes to strip for normalization
_SUFFIXES = re.compile(
    r"\b(inc|llc|ltd|corp|corporation|gmbh|ag|sa|s\.a\.|co|company|group|holdings|plc|pty|limited)\b",
    re.IGNORECASE,
)
_PUNCTUATION = re.compile(r"[^\w\s]")
_WHITESPACE = re.compile(r"\s+")


def normalize_company_name(name: str) -> str:
    """Lowercase, strip legal suffixes, punctuation, and extra whitespace."""
    name = name.lower()
    name = _SUFFIXES.sub("", name)
    name = _PUNCTUATION.sub(" ", name)
    name = _WHITESPACE.sub(" ", name).strip()
    return name


def find_matches(
    connections: list[dict],
    leads: list[dict],
) -> list[tuple[int, int, str]]:
    """Match connections to leads by company name.

    Args:
        connections: list of dicts with at least 'id' and 'company' keys
        leads: list of dicts with at least 'id' and 'company_name' keys

    Returns:
        list of (connection_id, lead_id, confidence) tuples.
        confidence is "exact" or "fuzzy".
    """
    matches: list[tuple[int, int, str]] = []

    # Pre-normalize lead names
    lead_normed = [(lead["id"], normalize_company_name(lead["company_name"])) for lead in leads]

    for conn in connections:
        company = conn.get("company")
        if not company:
            continue
        conn_normed = normalize_company_name(company)
        if not conn_normed:
            continue

        for lead_id, lead_name in lead_normed:
            if not lead_name:
                continue

            # Tier 1: exact normalized match
            if conn_normed == lead_name:
                matches.append((conn["id"], lead_id, "exact"))
                continue

            # Tier 2: one contains the other
            if conn_normed in lead_name or lead_name in conn_normed:
                matches.append((conn["id"], lead_id, "fuzzy"))
                continue

            # Tier 3: high similarity ratio
            ratio = difflib.SequenceMatcher(None, conn_normed, lead_name).ratio()
            if ratio > 0.85:
                matches.append((conn["id"], lead_id, "fuzzy"))

    return matches
