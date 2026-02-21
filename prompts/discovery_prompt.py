"""Discovery prompt — Person B can override the ICP discovery system prompt here.

The backend imports this module and calls ``build_prompt(products)`` to get the
system prompt used by the ICP discovery agent (Claude Sonnet with tool_use).

To customize: edit ``build_prompt()`` below. The backend's fallback prompt in
``backend/discovery/prompts.py`` is used if this import fails, so this file is
optional but recommended for prompt iteration.

Test with::

    uv run python -m prompts.test_discovery --products  # Uses DB products
    uv run python -m prompts.test_discovery --dry-run   # Print prompt only
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.models import Product


def build_prompt(products: list[Product]) -> str:
    """Build the ICP discovery system prompt.

    Called by ``backend.discovery.prompts.build_discovery_prompt()`` when this
    module is importable. Return the full system prompt string.

    The prompt should instruct Claude to:
    1. Analyze the product catalog and derive ICPs
    2. Use search_companies tool to find matching companies
    3. Use fetch_company_website / get_company_details to validate
    4. Iterate with different ICP angles if needed
    5. Call submit_discovered_companies with final list

    Available tools (defined in backend/discovery/icp_agent.py):
    - search_companies(query, depth) -> {companies: [{name, url, description, industry}]}
    - fetch_company_website(url) -> {content, sources}
    - get_company_details(company_name, company_url?) -> {company_name, website, description, industry, employees, funding, revenue}
    - submit_discovered_companies(companies) -> terminal, ends loop
    """
    # Default: delegate to backend's built-in prompt
    from backend.discovery.prompts import build_discovery_prompt
    return build_discovery_prompt(products)
