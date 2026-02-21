"""Pitch deck generator — 3-stage pipeline: Claude → JSON slides → Jinja2 HTML → PPTX."""

import json
import logging
import os
import re

import anthropic
from jinja2 import Environment, FileSystemLoader

from backend.config import settings
from backend.matching.pipeline import _build_lead_profile

logger = logging.getLogger(__name__)

_aclient: anthropic.AsyncAnthropic | None = None

# Paths
_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "generated", "pitchdecks")


def _get_claude_client() -> anthropic.AsyncAnthropic:
    global _aclient
    if _aclient is None:
        _aclient = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _aclient


# ─── Prompt (inline fallback) ────────────────────────────────────────────

_FALLBACK_SYSTEM_PROMPT = """\
You are a sales presentation designer. Given a company profile, product, and match reasoning, \
create a 7-slide pitch deck as JSON.

Return ONLY valid JSON:
{
  "slides": [
    {"slide_number": 1, "title": "...", "body_html": "<p>...</p>", "speaker_notes": "..."}
  ]
}

Slides: 1=Title, 2=Company snapshot, 3=The challenge, 4=The solution, 5=Why this fits, \
6=Social proof, 7=Next steps. Use <h3>, <p>, <ul>/<li>, <strong> in body_html.
"""


def _try_import_prompt() -> str | None:
    """Try to import Person B's prompt from prompts/pitch_deck_prompt.py."""
    try:
        from prompts.pitch_deck_prompt import build_prompt  # type: ignore[import-not-found]

        return build_prompt()
    except (ImportError, ModuleNotFoundError):
        return None


def _parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON from Claude response."""
    try:
        return json.loads(text)  # type: ignore[no-any-return]
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())  # type: ignore[no-any-return]

    raise ValueError(f"Could not parse JSON from Claude response: {text[:200]}")


def _build_product_summary(product) -> str:
    """Build text summary of a product for the prompt."""
    parts = [f"Product: {product.name}", f"Description: {product.description}"]
    if product.features:
        parts.append(f"Features: {', '.join(product.features)}")
    if product.differentiator:
        parts.append(f"Differentiator: {product.differentiator}")
    if product.example_clients:
        parts.append(f"Example clients: {', '.join(product.example_clients)}")
    if product.pricing_model:
        parts.append(f"Pricing: {product.pricing_model}")
    if product.company_name:
        parts.append(f"Sold by: {product.company_name}")
    return "\n".join(parts)


# ─── Stage 1: Claude → JSON slides ──────────────────────────────────────

async def _generate_slides_json(lead, product, match_reasoning: str) -> list[dict]:
    """Generate 7 slides as JSON using Claude."""
    system_prompt = _try_import_prompt() or _FALLBACK_SYSTEM_PROMPT

    lead_profile = _build_lead_profile(lead)
    product_summary = _build_product_summary(product)

    message = await _get_claude_client().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=3000,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": (
                f"## Target Company\n{lead_profile}\n\n"
                f"## Product\n{product_summary}\n\n"
                f"## Match Reasoning\n{match_reasoning}\n\n"
                f"Generate a 7-slide pitch deck for selling this product to this company."
            ),
        }],
    )

    response_text: str = message.content[0].text  # type: ignore[union-attr]
    parsed = _parse_json_response(response_text)
    return parsed.get("slides", [])  # type: ignore[no-any-return]


# ─── Stage 2: Jinja2 → HTML ─────────────────────────────────────────────

def _render_html(slides: list[dict], company_name: str, product_name: str) -> str:
    """Render slides into an HTML document using the Jinja2 template."""
    env = Environment(loader=FileSystemLoader(_TEMPLATE_DIR), autoescape=False)
    template = env.get_template("pitch_deck.html")
    return template.render(slides=slides, company_name=company_name, product_name=product_name)


# ─── Stage 3: python-pptx → PPTX ────────────────────────────────────────

def _generate_pptx(slides: list[dict], lead_id: int, product_id: int) -> str:
    """Generate a PPTX file from slides data. Returns file path."""
    from pptx import Presentation
    from pptx.util import Inches, Pt

    prs = Presentation()
    prs.slide_width = Inches(13.333)  # 16:9
    prs.slide_height = Inches(7.5)

    for slide_data in slides:
        slide_layout = prs.slide_layouts[5]  # Blank layout
        slide = prs.slides.add_slide(slide_layout)

        # Title

        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.5), Inches(1.2))
        title_frame = title_box.text_frame
        title_frame.word_wrap = True
        title_p = title_frame.paragraphs[0]
        title_p.text = slide_data.get("title", "")
        title_p.font.size = Pt(32)
        title_p.font.bold = True

        # Body — strip HTML tags for PPTX (plain text fallback)
        body_html = slide_data.get("body_html", "")
        body_text = re.sub(r"<[^>]+>", "", body_html).strip()
        body_text = re.sub(r"\n{3,}", "\n\n", body_text)

        body_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.5), Inches(5.0))
        body_frame = body_box.text_frame
        body_frame.word_wrap = True
        body_p = body_frame.paragraphs[0]
        body_p.text = body_text
        body_p.font.size = Pt(18)

        # Speaker notes
        notes_slide = slide.notes_slide
        notes_slide.notes_text_frame.text = slide_data.get("speaker_notes", "")

    os.makedirs(_OUTPUT_DIR, exist_ok=True)
    file_path = os.path.join(_OUTPUT_DIR, f"{lead_id}_{product_id}.pptx")
    prs.save(file_path)
    return file_path


# ─── Public API ──────────────────────────────────────────────────────────

async def generate_pitch_deck(lead, product, match_reasoning: str) -> dict:
    """Full 3-stage pipeline: Claude → HTML → PPTX. Returns slides + pptx_path."""
    # Stage 1: Generate slides JSON
    slides = await _generate_slides_json(lead, product, match_reasoning)

    # Stage 2: Render HTML (for preview)
    _render_html(slides, lead.company_name, product.name)

    # Stage 3: Generate PPTX
    pptx_path = _generate_pptx(slides, lead.id, product.id)

    return {"slides": slides, "pptx_path": pptx_path}
