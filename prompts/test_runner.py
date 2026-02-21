"""Prompt test runner for Person B — iterate on enrichment prompts without touching backend code.

Usage (from project root where .env lives)::

    uv run python -m prompts.test_runner "Stripe"                 # One company, full pipeline
    uv run python -m prompts.test_runner "Stripe" "Plaid"         # Multiple companies
    uv run python -m prompts.test_runner                          # 5 default companies
    uv run python -m prompts.test_runner --all                    # All 20 test companies
    uv run python -m prompts.test_runner "Stripe" --stage plan    # Query planner only (free)
    uv run python -m prompts.test_runner "Stripe" --stage search  # Plan + search (no extraction)
    uv run python -m prompts.test_runner --no-save                # Don't save JSON results
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path so ``backend.*`` imports work
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Load .env before any backend imports (which read settings at import time)
from dotenv import load_dotenv  # noqa: E402

load_dotenv(_PROJECT_ROOT / ".env")

from backend.enrichment.agents.data_extractor import ExtractionResult, extract_lead_data  # noqa: E402
from backend.enrichment.agents.query_planner import SearchPlan, plan_queries  # noqa: E402
from backend.enrichment.agents.search_executor import SearchResult, execute_searches  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_COMPANIES = ["Stripe", "Datadog", "Figma", "Anthropic", "Revolut"]

ALL_COMPANIES = [
    "Stripe", "Plaid", "Revolut", "Monzo", "Wise",
    "Datadog", "Snowflake", "Figma", "Notion", "Linear",
    "Vercel", "Supabase", "Retool", "Airtable", "Zapier",
    "Anthropic", "OpenAI", "Mistral", "Cohere", "HuggingFace",
]

ENRICHMENT_FIELDS = [
    "description", "funding", "industry", "revenue",
    "employees", "contacts", "customers", "buying_signals",
]

RESULTS_DIR = Path(__file__).resolve().parent / "results"

# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _header(title: str, width: int = 60) -> None:
    print()
    print("=" * width)
    print(f"  {title}")
    print("=" * width)


def _depth_tag(depth: str) -> str:
    return "[D]" if depth == "deep" else "[S]"


def _print_plan(company: str, plan: SearchPlan) -> None:
    _header(f"QUERY PLAN for {company}  ({len(plan)} queries)")
    for q in plan.queries:
        print(f"  {_depth_tag(q.depth)} {q.target_field:<20s} | {q.query}")


def _field_display(value: object) -> str:
    """Compact display of a field value."""
    if value is None:
        return "---"
    if isinstance(value, list):
        if len(value) == 0:
            return "---"
        return f"[{len(value)} items]"
    text = str(value)
    if len(text) > 70:
        return text[:67] + "..."
    return text


def _print_extraction(company: str, result: ExtractionResult) -> dict[str, object]:
    """Print extraction table and return scoring dict."""
    data = result.data
    conf_map: dict[str, str] = {
        fc.field: fc.confidence for fc in result.field_confidences
    }

    filled = 0
    total = len(ENRICHMENT_FIELDS)
    high_conf = 0

    for field in ENRICHMENT_FIELDS:
        value = data.get(field)
        is_filled = value is not None and value != [] and value != "" and value != {}
        if is_filled:
            filled += 1
        conf = conf_map.get(field, "low")
        if conf == "high" and is_filled:
            high_conf += 1

    pct = round(100 * filled / total) if total else 0
    _header(f"EXTRACTION for {company}  ({filled}/{total} fields filled, {pct}%)")

    for field in ENRICHMENT_FIELDS:
        value = data.get(field)
        is_filled = value is not None and value != [] and value != "" and value != {}
        conf = conf_map.get(field, "low")
        tag = "[OK  ]" if is_filled else "[MISS]"
        print(f"  {tag} {field:<20s} conf={conf:<7s} | {_field_display(value)}")

    if result.gaps:
        print(f"\n  GAPS: {', '.join(result.gaps)}")

    return {
        "company": company,
        "filled": filled,
        "total": total,
        "pct": pct,
        "gaps": len(result.gaps),
        "high_conf": high_conf,
    }


def _print_search_results(company: str, results: list[SearchResult]) -> None:
    _header(f"SEARCH RESULTS for {company}  ({len(results)} results)")
    for sr in results:
        answer_preview = sr.answer[:80].replace("\n", " ") if sr.answer else "---"
        print(f"  [{sr.target_field:<20s}] {answer_preview}...")


def _print_summary(scores: list[dict[str, object]]) -> None:
    width = 70
    print()
    print("=" * width)
    print(f"  SUMMARY ({len(scores)} companies)")
    print("=" * width)
    print(f"  {'Company':<22s} | {'Completeness':>12s} | {'Gaps':>5s} | {'High-Conf Fields':>16s}")
    print(f"  {'-' * 22}+-{'-' * 12}-+-{'-' * 5}-+-{'-' * 16}")
    for s in scores:
        print(
            f"  {str(s['company']):<22s} | {str(s['pct']):>11s}% | {str(s['gaps']):>5s} | {str(s['high_conf']):>16s}"
        )
    print()


# ---------------------------------------------------------------------------
# Saving results
# ---------------------------------------------------------------------------

def _save_result(
    company: str,
    plan: SearchPlan | None,
    search_results: list[SearchResult] | None,
    extraction: ExtractionResult | None,
    scores: dict[str, object] | None,
) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    slug = company.lower().replace(" ", "_")
    path = RESULTS_DIR / f"{ts}_{slug}.json"

    payload: dict[str, object] = {"company": company, "timestamp": ts}
    if plan is not None:
        payload["queries"] = [q.to_dict() for q in plan.queries]
    if search_results is not None:
        payload["search_results"] = [sr.to_dict() for sr in search_results]
    if extraction is not None:
        payload["extraction"] = extraction.to_dict()
    if scores is not None:
        payload["scores"] = scores

    path.write_text(json.dumps(payload, indent=2, default=str))
    return path


# ---------------------------------------------------------------------------
# Cost estimate
# ---------------------------------------------------------------------------

def _estimate_cost(plan: SearchPlan) -> str:
    standard = sum(1 for q in plan.queries if q.depth == "standard")
    deep = sum(1 for q in plan.queries if q.depth == "deep")
    cost = standard * 0.005 + deep * 0.05
    return f"{standard} standard + {deep} deep ≈ €{cost:.3f} LinkUp"


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

async def _run_one(company: str, stage: str, save: bool) -> dict[str, object] | None:
    print(f"\n  Testing: {company}...")

    # Stage 1: Query planning (Claude Haiku only — free-ish)
    plan = await plan_queries(company)
    _print_plan(company, plan)

    if stage == "plan":
        if save:
            p = _save_result(company, plan, None, None, None)
            print(f"\n  Saved: {p}")
        return None

    # Stage 2: Search execution (costs LinkUp credits)
    print(f"\n  Cost estimate: {_estimate_cost(plan)}")
    search_results = await execute_searches(plan)
    _print_search_results(company, search_results)

    if stage == "search":
        if save:
            p = _save_result(company, plan, search_results, None, None)
            print(f"\n  Saved: {p}")
        return None

    # Stage 3: Extraction (Claude Haiku)
    extraction = await extract_lead_data(company, search_results)
    scores = _print_extraction(company, extraction)

    if save:
        p = _save_result(company, plan, search_results, extraction, scores)
        print(f"\n  Saved: {p}")

    return scores


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test enrichment prompts against real companies.",
    )
    parser.add_argument(
        "companies",
        nargs="*",
        help="Company names to test. Omit for 5 defaults.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="all_companies",
        help="Test all 20 companies.",
    )
    parser.add_argument(
        "--stage",
        choices=["plan", "search", "all"],
        default="all",
        help="Pipeline stage to run up to (default: all).",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save JSON results to prompts/results/.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = _parse_args()

    if args.all_companies:
        companies = ALL_COMPANIES
    elif args.companies:
        companies = args.companies
    else:
        companies = DEFAULT_COMPANIES

    save = not args.no_save
    all_scores: list[dict[str, object]] = []

    for company in companies:
        scores = await _run_one(company, args.stage, save)
        if scores is not None:
            all_scores.append(scores)

    if len(all_scores) > 1:
        _print_summary(all_scores)


if __name__ == "__main__":
    asyncio.run(_main())
