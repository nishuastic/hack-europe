"""Prompt builders for the ICP discovery agent."""

import json
from typing import Any

from backend.models import Product


def build_discovery_prompt(products: list[Product]) -> str:
    """Build the system prompt that instructs Claude to derive ICPs and search for companies."""
    product_descriptions = []
    for i, p in enumerate(products, 1):
        parts = [f"### Product {i}: {p.name}"]
        parts.append(f"**Description:** {p.description}")
        if p.features:
            parts.append(f"**Features:** {', '.join(p.features)}")
        if p.industry_focus:
            parts.append(f"**Industry focus:** {p.industry_focus}")
        if p.company_size_target:
            parts.append(f"**Target company size:** {p.company_size_target}")
        if p.geography:
            parts.append(f"**Geography:** {p.geography}")
        if p.stage:
            parts.append(f"**Stage:** {p.stage}")
        if p.pricing_model:
            parts.append(f"**Pricing model:** {p.pricing_model}")
        if p.differentiator:
            parts.append(f"**Differentiator:** {p.differentiator}")
        if p.example_clients:
            parts.append(f"**Example clients:** {', '.join(p.example_clients)}")
        if p.company_name:
            parts.append(f"**Selling company:** {p.company_name}")
        if p.website:
            parts.append(f"**Website:** {p.website}")
        product_descriptions.append("\n".join(parts))

    products_block = "\n\n".join(product_descriptions)

    return f"""\
You are an expert B2B sales development agent. Your job is to discover companies that \
would be ideal customers for the products below.

## Product Catalog

{products_block}

## Your Task

1. **Derive Ideal Customer Profiles (ICPs):** Analyze the products above and determine \
what types of companies would benefit most from each product. Consider industry, company \
size, stage, geography, pain points, and technology usage.

2. **Search for matching companies:** Use the `search_companies` tool to find real \
companies matching each ICP. Generate specific, targeted search queries — e.g. \
"Series B fintech startups in Europe", "mid-market SaaS companies hiring for data engineering", \
"healthcare companies using legacy ERP systems".

3. **Validate promising companies:** For companies that look like good fits, use \
`fetch_company_website` to read their website and `get_company_details` to extract \
structured information. This helps you confirm they're a real match, not just a name.

4. **Iterate for coverage:** If you haven't found enough companies, try different ICP \
angles, industries, geographies, or search strategies. The `search_companies` tool will \
automatically exclude companies you've already found.

5. **Submit results:** When you have enough companies (or have exhausted search strategies), \
call `submit_discovered_companies` with your final list.

## Rules

- Only submit companies you found via actual search results. NEVER hallucinate or make up \
company names.
- Include a `why_good_fit` explanation for every company, referencing specific product \
features and company characteristics.
- Aim for diversity: mix of company sizes, sub-industries, and geographies (where applicable).
- For each company, try to get at least: name, URL, description, and industry. Funding, \
revenue, and employee count are valuable bonuses.
- If a search returns no useful results, try rephrasing or a different ICP angle.
- Do NOT submit the selling company itself as a lead.
"""


def _format_product_summary(products: list[Product]) -> str:
    """Short product summary for the evaluation prompt."""
    lines = []
    for p in products:
        parts = [f"- **{p.name}**: {p.description}"]
        if p.industry_focus:
            parts.append(f"  Industry: {p.industry_focus}")
        if p.company_size_target:
            parts.append(f"  Target size: {p.company_size_target}")
        lines.append("\n".join(parts))
    return "\n".join(lines)


def build_evaluation_prompt(
    products: list[Product],
    candidates: list[dict[str, Any]],
    max_companies: int,
) -> str:
    """Build a prompt for Claude to evaluate and rank candidate companies."""
    products_block = _format_product_summary(products)
    candidates_json = json.dumps(candidates, indent=2, default=str)

    # Collect selling company names to exclude
    seller_names = [p.company_name.lower() for p in products if p.company_name]

    exclude_note = ""
    if seller_names:
        exclude_note = (
            f"\n- Do NOT include the selling companies themselves: "
            f"{', '.join(seller_names)}"
        )

    return f"""\
You are an expert B2B sales analyst. Evaluate these candidate companies and select \
the best {max_companies} that would be ideal customers for the products below.

## Products
{products_block}

## Candidate Companies (from web search)
{candidates_json}

## Instructions
- Select up to {max_companies} companies that are the best fit as CUSTOMERS for the products above.
- For each selected company, explain why it's a good fit.
- Remove duplicates, irrelevant results, and companies that clearly don't match.{exclude_note}
- Return ONLY a JSON array (no markdown, no explanation outside the JSON).

Each object in the array must have:
- "company_name": string
- "company_url": string (if available)
- "description": string (what the company does)
- "industry": string
- "why_good_fit": string (reference specific product features and company characteristics)
- "best_product_match": string (name of the best-matching product)

Return the JSON array now:"""
