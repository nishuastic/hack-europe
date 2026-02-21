"""Agent orchestrator — Claude tool-use loop that autonomously researches, matches, and pitches."""

import json
import logging

import anthropic

from backend.config import settings
from backend.db import async_session
from backend.models import EnrichmentStatus, Lead, Product

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Tool definitions for Claude ─────────────────────────────────────────

TOOLS: list[dict] = [
    {
        "name": "search_web",
        "description": "Search the web for information about a company or topic using LinkUp.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "depth": {"type": "string", "enum": ["standard", "deep"], "description": "Search depth"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "analyze_company",
        "description": "Create a new lead for a company and trigger enrichment. Returns the lead ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string", "description": "Name of the company to analyze"},
            },
            "required": ["company_name"],
        },
    },
    {
        "name": "match_products",
        "description": "Run AI product matching for a specific lead against all products in the catalog.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "integer", "description": "ID of the lead to match"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "generate_pitch_deck",
        "description": "Generate a pitch deck for a specific lead-product match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "integer", "description": "ID of the lead"},
                "product_id": {"type": "integer", "description": "ID of the product"},
            },
            "required": ["lead_id", "product_id"],
        },
    },
    {
        "name": "draft_email",
        "description": "Draft a personalized outreach email for a lead-product match.",
        "input_schema": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "integer", "description": "ID of the lead"},
                "product_id": {"type": "integer", "description": "ID of the product"},
            },
            "required": ["lead_id", "product_id"],
        },
    },
]

SYSTEM_PROMPT = """\
You are an autonomous AI sales agent. Your job is to research companies, match them with products \
from the catalog, generate pitch decks, and draft outreach emails.

You have these tools:
- search_web: Search for information about companies
- analyze_company: Create a lead and trigger enrichment research
- match_products: Run AI matching for a lead against the product catalog
- generate_pitch_deck: Create a slide deck for a lead-product pair
- draft_email: Write an outreach email for a lead-product pair

Work autonomously. When given a task:
1. Research companies if needed (search_web or analyze_company)
2. Wait for enrichment, then match products
3. Generate deliverables (pitch decks, emails) for the best matches

Think step by step. After each tool result, decide what to do next. \
Stop when you've completed the task or have no more useful actions to take.
"""

MAX_TURNS = 15


# ─── Tool execution ─────────────────────────────────────────────────────

async def _execute_tool(tool_name: str, tool_input: dict, ws_manager) -> str:
    """Execute a tool call and return the result as a string."""
    try:
        if tool_name == "search_web":
            return await _tool_search_web(tool_input)
        elif tool_name == "analyze_company":
            return await _tool_analyze_company(tool_input, ws_manager)
        elif tool_name == "match_products":
            return await _tool_match_products(tool_input, ws_manager)
        elif tool_name == "generate_pitch_deck":
            return await _tool_generate_pitch_deck(tool_input)
        elif tool_name == "draft_email":
            return await _tool_draft_email(tool_input)
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
    except Exception as e:
        logger.exception(f"Tool {tool_name} failed")
        return json.dumps({"error": str(e)})


async def _tool_search_web(tool_input: dict) -> str:
    """Execute a LinkUp search."""
    from backend.enrichment.linkup_search import _get_client

    client = _get_client()
    result = client.search(
        query=tool_input["query"],
        depth=tool_input.get("depth", "standard"),
        output_type="sourcedAnswer",
    )
    return json.dumps({"answer": result.output, "sources": [s.name for s in result.sources[:3]]})


async def _tool_analyze_company(tool_input: dict, ws_manager) -> str:
    """Create a lead and trigger enrichment."""
    from sqlmodel import select

    from backend.enrichment.pipeline import enrich_lead

    async with async_session() as session:
        # Check if lead already exists
        existing = (await session.execute(
            select(Lead).where(Lead.company_name == tool_input["company_name"])
        )).scalar_one_or_none()
        if existing:
            return json.dumps({
                "lead_id": existing.id,
                "status": existing.enrichment_status.value,
                "message": "Lead already exists",
            })

        lead = Lead(company_name=tool_input["company_name"], enrichment_status=EnrichmentStatus.PENDING)
        session.add(lead)
        await session.commit()
        await session.refresh(lead)

    # Fire enrichment (don't await — it runs in background)
    import asyncio

    asyncio.create_task(enrich_lead(lead.id, ws_manager))  # type: ignore[arg-type]
    return json.dumps({"lead_id": lead.id, "status": "enrichment_started"})


async def _tool_match_products(tool_input: dict, ws_manager) -> str:
    """Run matching for a specific lead."""
    from sqlmodel import select

    from backend.matching.pipeline import match_lead_to_products

    lead_id = tool_input["lead_id"]
    async with async_session() as session:
        lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
        if not lead:
            return json.dumps({"error": f"Lead {lead_id} not found"})
        if lead.enrichment_status != EnrichmentStatus.COMPLETE:
            return json.dumps({"error": f"Lead not yet enriched (status: {lead.enrichment_status.value})"})

        products = list((await session.execute(select(Product))).scalars().all())
        if not products:
            return json.dumps({"error": "No products in catalog"})

        matches = await match_lead_to_products(lead, products)

        # Save matches
        from backend.models import ProductMatch

        for m in matches:
            product_id = m.get("product_id")
            if product_id is None:
                continue
            match_record = ProductMatch(
                lead_id=lead_id,
                product_id=product_id,
                match_score=float(m.get("match_score", 0)),
                match_reasoning=m.get("match_reasoning", ""),
                conversion_likelihood=m.get("conversion_likelihood"),
                conversion_reasoning=m.get("conversion_reasoning"),
            )
            session.add(match_record)

        await session.commit()
        return json.dumps({"matches": matches})


async def _tool_generate_pitch_deck(tool_input: dict) -> str:
    """Generate a pitch deck for a lead-product pair."""
    from sqlmodel import select

    from backend.actions.pitch_deck import generate_pitch_deck
    from backend.models import PitchDeck, ProductMatch

    lead_id = tool_input["lead_id"]
    product_id = tool_input["product_id"]

    async with async_session() as session:
        lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
        product = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
        match_obj = (await session.execute(
            select(ProductMatch).where(
                ProductMatch.lead_id == lead_id, ProductMatch.product_id == product_id
            )
        )).scalar_one_or_none()

        if not lead or not product:
            return json.dumps({"error": "Lead or product not found"})

        reasoning = match_obj.match_reasoning if match_obj else "No prior matching — generate general pitch."
        result = await generate_pitch_deck(lead, product, reasoning)

        deck = PitchDeck(
            lead_id=lead_id, product_id=product_id,
            slides=result["slides"], pptx_path=result["pptx_path"],
        )
        session.add(deck)
        lead.pitch_deck_generated = True
        session.add(lead)
        await session.commit()

        return json.dumps({"slides_count": len(result["slides"]), "pptx_path": result["pptx_path"]})


async def _tool_draft_email(tool_input: dict) -> str:
    """Draft an email for a lead-product pair."""
    from sqlmodel import select

    from backend.actions.email_generator import generate_email
    from backend.models import GeneratedEmail, ProductMatch

    lead_id = tool_input["lead_id"]
    product_id = tool_input["product_id"]

    async with async_session() as session:
        lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
        product = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
        match_obj = (await session.execute(
            select(ProductMatch).where(
                ProductMatch.lead_id == lead_id, ProductMatch.product_id == product_id
            )
        )).scalar_one_or_none()

        if not lead or not product:
            return json.dumps({"error": "Lead or product not found"})

        reasoning = match_obj.match_reasoning if match_obj else ""
        result = await generate_email(lead, product, reasoning)

        email_record = GeneratedEmail(
            lead_id=lead_id, product_id=product_id,
            contact_name=result["contact_name"], contact_role=result["contact_role"],
            subject=result["subject"], body=result["body"],
        )
        session.add(email_record)
        lead.email_generated = True
        session.add(lead)
        await session.commit()

        return json.dumps({"subject": result["subject"], "body": result["body"][:200] + "..."})


# ─── Main orchestrator loop ─────────────────────────────────────────────

async def run_agent(task: str, ws_manager) -> list[dict]:
    """Run the agentic loop. Returns the conversation messages for debugging."""
    messages: list[dict] = [{"role": "user", "content": task}]

    await ws_manager.broadcast({
        "type": "agent_thinking",
        "action": "starting",
        "detail": f"Agent received task: {task[:100]}",
    })

    for turn in range(MAX_TURNS):
        response = await _get_claude_client().messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,  # type: ignore[arg-type]
            messages=messages,  # type: ignore[arg-type]
        )

        # Check if Claude wants to use tools
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        text_blocks = [b for b in response.content if b.type == "text"]

        # Broadcast any text reasoning
        for tb in text_blocks:
            await ws_manager.broadcast({
                "type": "agent_thinking",
                "action": "reasoning",
                "detail": tb.text[:500],  # type: ignore[union-attr]
            })

        if not tool_use_blocks:
            # No more tools — agent is done
            final_text = " ".join(tb.text for tb in text_blocks)  # type: ignore[union-attr]
            messages.append({"role": "assistant", "content": final_text})
            await ws_manager.broadcast({
                "type": "agent_complete",
                "detail": final_text[:500],
            })
            break

        # Build assistant message with all content blocks
        assistant_content: list[dict] = []
        for block in response.content:
            if block.type == "text":
                assistant_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                assistant_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
        messages.append({"role": "assistant", "content": assistant_content})

        # Execute all tool calls
        tool_results = []
        for tool_block in tool_use_blocks:
            await ws_manager.broadcast({
                "type": "agent_thinking",
                "action": f"calling_{tool_block.name}",
                "detail": f"Using tool: {tool_block.name}({json.dumps(tool_block.input)[:200]})",
            })

            result = await _execute_tool(tool_block.name, tool_block.input, ws_manager)  # type: ignore[arg-type]
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_block.id,
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})

    return messages
