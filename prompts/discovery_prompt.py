"""Discovery prompt — Phase 1 query generation for ICP discovery.

The backend imports this module and calls ``build_prompt(products)`` to get the
system prompt used by Claude to generate targeted web search queries for each
product's Ideal Customer Profile.

To customize: edit ``build_prompt()`` below. The backend's fallback prompt in
``backend/discovery/prompts.py`` is used if this import fails, so this file is
optional but recommended for prompt iteration.

The prompt instructs Claude to return a JSON object::

    {"queries": [{"query": "...", "depth": "standard", "icp_rationale": "..."}]}

Test with::

    uv run python -m prompts.test_discovery --products  # Uses DB products
    uv run python -m prompts.test_discovery --dry-run   # Print prompt only
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.models import Product


def build_prompt(products: list[Product]) -> str:
    """Build the Phase 1 query-generation prompt.

    Called by ``backend.discovery.icp_agent._get_query_gen_prompt()`` when this
    module is importable. Return the full system prompt string.

    The prompt instructs Claude to:
    1. Analyze the product catalog and derive ICPs
    2. Generate 2-4 targeted web search queries per product/ICP
    3. Return a JSON object with queries, depth, and ICP rationale
    """
    # Default: delegate to backend's built-in prompt
    from backend.discovery.prompts import build_discovery_prompt
    return build_discovery_prompt(products)
