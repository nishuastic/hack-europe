"""Discovery prompt test runner — iterate on ICP discovery prompts without touching backend code.

Usage (from project root where .env lives)::

    uv run python -m prompts.test_discovery                      # Dry-run: print prompt only
    uv run python -m prompts.test_discovery --run --max 3        # Run discovery for 3 companies
    uv run python -m prompts.test_discovery --run --max 5        # Run discovery for 5 companies
    uv run python -m prompts.test_discovery --products           # Show loaded products
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_PROJECT_ROOT / ".env")

from backend.discovery.icp_agent import run_discovery_agent  # noqa: E402
from backend.discovery.prompts import build_discovery_prompt  # noqa: E402
from backend.models import Product  # noqa: E402

# ---------------------------------------------------------------------------
# Sample products for testing (used when DB is empty or --sample flag)
# ---------------------------------------------------------------------------

SAMPLE_PRODUCTS = [
    Product(
        id=1,
        name="DataSync Pro",
        description="Real-time data pipeline platform for syncing databases, warehouses, and SaaS tools. "
        "No-code connectors with sub-second latency.",
        features=["CDC replication", "150+ connectors", "schema evolution", "monitoring dashboard"],
        industry_focus="Technology, E-commerce, Finance",
        company_size_target="mid-market to enterprise",
        geography="US, Europe",
        stage="scaling",
        pricing_model="Usage-based (rows synced/month)",
        differentiator="Sub-second latency with zero-downtime schema changes",
        example_clients=["Shopify", "N26"],
        company_name="SyncLabs",
        website="https://synclabs.io",
    ),
    Product(
        id=2,
        name="ComplianceAI",
        description="AI-powered compliance monitoring for financial services. Scans communications, "
        "transactions, and documents for regulatory violations.",
        features=["NLP scanning", "real-time alerts", "audit trail", "multi-jurisdiction"],
        industry_focus="Financial Services, Banking, Insurance",
        company_size_target="enterprise",
        geography="Europe, UK",
        stage="enterprise",
        pricing_model="Per-seat SaaS",
        differentiator="Covers MiFID II, GDPR, and PSD2 in one platform",
        example_clients=["Deutsche Bank", "Revolut"],
        company_name="RegTech Solutions",
        website="https://regtechsolutions.eu",
    ),
]


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _header(title: str, width: int = 70) -> None:
    print()
    print("=" * width)
    print(f"  {title}")
    print("=" * width)


def _print_prompt(products: list[Product]) -> None:
    prompt = build_discovery_prompt(products)
    _header(f"DISCOVERY PROMPT ({len(products)} products)")
    print(prompt)
    print(f"\n  --- Prompt length: {len(prompt)} chars ---")


def _print_results(discovered: list[dict]) -> None:
    _header(f"DISCOVERED COMPANIES ({len(discovered)})")
    for i, co in enumerate(discovered, 1):
        print(f"\n  {i}. {co.get('company_name', 'Unknown')}")
        if co.get("company_url"):
            print(f"     URL: {co['company_url']}")
        if co.get("description"):
            desc = co["description"][:100]
            print(f"     Description: {desc}{'...' if len(co['description']) > 100 else ''}")
        if co.get("industry"):
            print(f"     Industry: {co['industry']}")
        if co.get("funding"):
            print(f"     Funding: {co['funding']}")
        if co.get("employees"):
            print(f"     Employees: {co['employees']}")
        print(f"     Why good fit: {co.get('why_good_fit', 'N/A')}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test ICP discovery prompts.",
    )
    parser.add_argument(
        "--run",
        action="store_true",
        help="Actually run discovery (costs API credits). Default is dry-run (print prompt only).",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=5,
        help="Max companies to discover (default: 5).",
    )
    parser.add_argument(
        "--products",
        action="store_true",
        help="Show loaded products and exit.",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save results to prompts/results/.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = _parse_args()
    products = SAMPLE_PRODUCTS

    if args.products:
        _header("PRODUCTS")
        for p in products:
            print(f"  {p.id}. {p.name}: {p.description[:80]}...")
        return

    _print_prompt(products)

    if not args.run:
        print("\n  Dry run complete. Use --run to actually execute discovery.\n")
        return

    _header(f"RUNNING DISCOVERY (max {args.max} companies)")
    print("  This will call Claude + LinkUp APIs...\n")

    discovered = await run_discovery_agent(products, args.max, ws_manager=None)
    _print_results(discovered)

    if args.save and discovered:
        results_dir = Path(__file__).resolve().parent / "results"
        results_dir.mkdir(parents=True, exist_ok=True)
        from datetime import datetime, timezone
        ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
        path = results_dir / f"{ts}_discovery.json"
        path.write_text(json.dumps(discovered, indent=2, default=str))
        print(f"\n  Saved: {path}")


if __name__ == "__main__":
    asyncio.run(_main())
