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

1. **Derive Ideal Customer Profiles (ICPs):** Analyze the vendor/product profile(s) above (provided in JSON) describing what they sell, who they sell to, what problems they solve, and what makes them different.

   Rules:
   - Use the vendor JSON as the ONLY source of truth. Do not assume or invent any constraints.
   - If a detail is not present in the JSON, do not include it.

   Output format (IMPORTANT):
   - Return exactly TWO paragraphs of plain text.
   - Paragraph 1: 1–2 sentence summary of the vendor and its offering.
   - Paragraph 2: The Ideal Customer Profile (ICP) in 3–6 sentences, explicitly covering:
     - Target industries (if specified)
     - Geography served (if specified)
     - Company size/stage (if specified)
     - Primary buyer roles/titles (if specified)
     - The problems/pains they likely have (based only on the offering description)
     - Key success outcome they want (based only on the offering description)


2. **Generate targeted search queries:** For each ICP, generate 2-4 web search queries \
that would find real companies matching that profile. Be specific and creative — e.g. \
"Series B fintech startups in Europe", "mid-market SaaS companies hiring for data engineering", \
"healthcare companies using legacy ERP systems".

## Rules

- Aim for diversity: vary company sizes, sub-industries, geographies, and search angles.
- Use "deep" depth for broad or exploratory queries, "standard" for specific/narrow ones.
- Include a brief `icp_rationale` for each query explaining what ICP it targets.
- Do NOT include the selling company itself as a target.

## Output Format

Return ONLY a JSON object (no markdown, no explanation outside the JSON):
```json
{{"queries": [{{"query": "...", "depth": "standard", "icp_rationale": "..."}}, ...]}}
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
