"""Customer research — one LinkUp call per customer to gather company data for ICP learning."""

import json
import logging

from backend.enrichment.linkup_search import _get_client

logger = logging.getLogger(__name__)

_CUSTOMER_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {"type": "string", "description": "1-2 sentence company description"},
        "industry": {"type": "string", "description": "Primary industry"},
        "employee_count": {"type": "integer", "description": "Approximate employee count"},
        "revenue": {"type": "string", "description": "Revenue estimate if available"},
        "funding_stage": {"type": "string", "description": "Current funding stage (e.g. Seed, Series A, Series B)"},
        "geography": {"type": "string", "description": "HQ location / primary geography"},
        "tech_stack": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Key technologies used by this company",
        },
    },
}


async def research_customer(customer_name: str, customer_url: str) -> dict:
    """Research a single customer via LinkUp. Returns dict of extracted data."""
    client = _get_client()

    query = (
        f"{customer_name} ({customer_url}) company overview: "
        f"description, industry, employee count, revenue, funding stage, "
        f"headquarters location, technology stack"
    )

    try:
        response = await client.async_search(
            query=query,
            depth="standard",
            output_type="structured",
            structured_output_schema=json.dumps(_CUSTOMER_SCHEMA),
        )
        raw = response.output if hasattr(response, "output") else response
        if isinstance(raw, str):
            data = json.loads(raw)
        elif isinstance(raw, dict):
            data = raw
        else:
            data = json.loads(str(raw))
    except Exception as e:
        logger.warning(f"Customer research failed for '{customer_name}': {e}")
        data = {"error": str(e)}

    logger.info(f"Customer research for {customer_name}: done")
    return data
