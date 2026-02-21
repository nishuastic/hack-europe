"""System prompt builder for the ICP discovery agent."""

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
