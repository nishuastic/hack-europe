"""Prompt builders for the ICP discovery agent."""

import json
from typing import Any

from backend.models import Product


def build_discovery_prompt(
    products: list[Product],
    selected_products: list[Product] | None = None,
) -> str:
    """Build the system prompt that instructs Claude to derive ICPs and search for companies.

    Args:
        products: Full product catalog (used as fallback if selected_products is not provided).
        selected_products: Subset of products to generate search queries for. If provided,
            only these products will be included in the prompt.
    """
    active_products = selected_products if selected_products is not None else products

    product_descriptions = []
    for i, p in enumerate(active_products, 1):
        parts = [f"### Product {i}: {p.name}"]
        # Embed the product ID so Claude can tag each query back to its product
        if p.id is not None:
            parts.append(f"**Product ID:** {p.id}")
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
        if p.current_clients:
            client_names = [c["name"] if isinstance(c, dict) else str(c) for c in p.current_clients]
            parts.append(f"**Current clients:** {', '.join(client_names)}")
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

1. **Derive Ideal Customer Profiles (ICPs):** Analyze the vendor/product profile(s) above \
describing what they sell, who they sell to, what problems they solve, \
and what makes them different.

   Rules:
   - Use the product details as the ONLY source of truth. Do not assume or invent any constraints.
   - If a detail is not present, do not include it.

   Output format (IMPORTANT):
   - Return exactly TWO paragraphs of plain text per product.
   - Paragraph 1: 1–2 sentence summary of the vendor and its offering.
   - Paragraph 2: The Ideal Customer Profile (ICP) in 3–6 sentences, explicitly covering:
     - Target industries (if specified)
     - Geography served (if specified)
     - Company size/stage (if specified)
     - Primary buyer roles/titles (if specified)
     - The problems/pains they likely have (based only on the offering description)
     - Key success outcome they want (based only on the offering description)


2. **Generate targeted search queries:** For each product's ICP, generate 2-4 web search \
queries that would find real companies matching that profile. Be specific and creative — e.g. \
"Series B fintech startups in Europe", "mid-market SaaS companies hiring for data engineering", \
"healthcare companies using legacy ERP systems".

## Rules

- Aim for diversity: vary company sizes, sub-industries, geographies, and search angles.
- Always use "standard" depth.
- Include a brief `icp_rationale` for each query explaining what ICP it targets.
- Each query MUST include a `product_id` field matching the Product ID shown above.
- Do NOT include the selling company itself as a target.

## Output Format

Return ONLY a JSON object (no markdown, no explanation outside the JSON):
```json
{{"queries": [
  {{"query": "...", "depth": "standard", "icp_rationale": "...", "product_id": 1}},
  ...
]}}
```
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
Each candidate includes `matched_product_ids` (list) indicating which products' search \
queries surfaced it. Use this as a strong signal for `best_product_matches`, but you may \
override if different products are clearly a better fit.

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
- "best_product_matches": list of strings (names of matching products, ordered by best fit)

Return the JSON array now:"""
