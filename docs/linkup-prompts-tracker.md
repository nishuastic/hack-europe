# LinkUp & Prompts Tracker — Person B

## Your Role
You are the **data quality gatekeeper**. The entire product is only as good as the data we extract. Your job:
1. Craft and optimize LinkUp search queries for each enrichment field
2. Design Claude prompts that extract structured data reliably
3. Design the pitch deck generation prompt (most important prompt in the app)
4. Test everything across 20+ companies and score quality
5. Deliver tested prompts in `prompts/` that Person A imports directly

## Your Stack
- **Python 3.12** + **uv**
- **linkup-sdk** (`pip install linkup-sdk` / `uv add linkup-sdk`)
- **anthropic** SDK for Claude prompt testing
- Jupyter notebook or Python scripts for rapid iteration

## Setup
```bash
cd /path/to/hack-europe
uv add linkup-sdk anthropic
# Set env vars
export LINKUP_API_KEY="..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

## LinkUp SDK Quick Reference
```python
from linkup import LinkupClient

client = LinkupClient()  # reads LINKUP_API_KEY from env

# Standard search (fast, €0.005/call)
result = client.search(
    query="Stripe funding round 2024",
    depth="standard",
    output_type="sourcedAnswer"  # or "searchResults" or "structured"
)
# result.answer = "Stripe raised..."
# result.sources = [{"name": ..., "url": ..., "snippet": ...}]

# Deep search (thorough, €0.05/call)
result = client.search(
    query="Stripe current customers enterprise case studies",
    depth="deep",
    output_type="sourcedAnswer"
)
```

**Cost awareness:** Standard = €0.005, Deep = €0.05. Use standard for simple lookups, deep for complex research. Budget accordingly.

---

## Phase 1 — Enrichment Queries (Hours 0-8)

### Files to Create
- [ ] `prompts/__init__.py`
- [ ] `prompts/linkup_queries.py` — query templates per field
- [ ] `prompts/claude_prompts.py` — Claude system prompts for extraction
- [ ] `prompts/test_prompts.py` — test harness

### LinkUp Queries to Optimize

For each field, test multiple query variants and pick the best:

| Field | Query Template to Test | Depth |
|-------|----------------------|-------|
| Description | `"{company} what does the company do"` | standard |
| Funding | `"{company} latest funding round amount date investors"` | standard |
| Industry | (derive from description via Claude, no separate query) | — |
| Financials | `"{company} revenue employees company size"` | deep |
| Contacts | `"{company} CEO CTO leadership team linkedin"` | deep |
| Customers | `"{company} customers case studies testimonials clients"` | deep |

### Query Template Format (what Person A will import)
```python
# prompts/linkup_queries.py

def get_queries(company_name: str, company_url: str | None = None) -> dict[str, dict]:
    """Return LinkUp queries for each enrichment field.

    Returns dict of field_name → {query, depth, output_type}
    """
    base = company_url or company_name
    return {
        "description": {
            "query": f"What does {company_name} do? {base} company overview",
            "depth": "standard",
            "output_type": "sourcedAnswer",
        },
        "funding": {
            "query": f"{company_name} latest funding round amount date investors 2023 2024 2025",
            "depth": "standard",
            "output_type": "sourcedAnswer",
        },
        "financials": {
            "query": f"{company_name} revenue employees company size annual report",
            "depth": "deep",
            "output_type": "sourcedAnswer",
        },
        "contacts": {
            "query": f"{company_name} CEO CTO VP leadership team executive",
            "depth": "deep",
            "output_type": "sourcedAnswer",
        },
        "customers": {
            "query": f"{company_name} customers case studies clients testimonials",
            "depth": "deep",
            "output_type": "sourcedAnswer",
        },
    }
```

### Claude Extraction Prompt
```python
# prompts/claude_prompts.py

ENRICHMENT_SYSTEM_PROMPT = """You are a sales research analyst. Given raw web search results about a company,
extract structured data. Return ONLY valid JSON matching this schema:

{
  "description": "200-word summary of what the company does",
  "funding": "Latest round, amount, date, investors. 'Unknown' if not found.",
  "industry": "Primary industry classification",
  "revenue": "Estimated revenue or ARR. 'Unknown' if not found.",
  "employees": number or null,
  "contacts": [{"name": "...", "role": "...", "linkedin": "...or null"}],
  "customers": ["Customer1", "Customer2"],
  "fit_score": 1-10,
  "fit_reasoning": "2-sentence explanation of product-customer fit"
}

Be specific. Use real numbers. If data isn't available, say 'Unknown' — never fabricate.
The product we are selling: {product_description}
Score fit based on how well our product addresses this company's likely needs.
"""
```

### Test Harness
```python
# prompts/test_prompts.py
"""
Run: uv run python -m prompts.test_prompts

Tests LinkUp queries + Claude extraction across N companies.
Outputs completeness score per field.
"""

TEST_COMPANIES = [
    "Stripe", "Plaid", "Revolut", "Monzo", "Wise",
    "Datadog", "Snowflake", "Figma", "Notion", "Linear",
    "Vercel", "Supabase", "Retool", "Airtable", "Zapier",
    "Anthropic", "OpenAI", "Mistral", "Cohere", "HuggingFace",
]

# For each company:
# 1. Run all LinkUp queries
# 2. Feed results to Claude
# 3. Check: is each field populated? Is it accurate?
# 4. Score: % fields filled, quality rating
```

### Deliverable by Hour 8
- All queries tested across 20 companies
- Completeness rate > 80% for description, industry, contacts
- Completeness rate > 60% for funding, financials, customers
- All prompts in `prompts/` directory, importable by Person A

---

## Phase 2 — Pitch Deck Prompt (Hours 8-14)

### The Most Important Prompt
This is our killer feature. The pitch deck prompt must produce slides that feel like a human consultant wrote them.

### File to Create
- [ ] `prompts/pitch_deck_prompt.py`

### Prompt Structure
```python
# prompts/pitch_deck_prompt.py

PITCH_DECK_SYSTEM_PROMPT = """You are an elite sales consultant creating a personalized pitch deck.

Given:
- Our product: {product_description}
- Target company enrichment data: {enriched_data}

Generate a 7-slide pitch deck as JSON. Each slide:
{{
  "slide_number": 1,
  "title": "Slide title",
  "body_html": "<p>HTML content with <strong>bold</strong> for emphasis</p>",
  "speaker_notes": "What to say when presenting this slide"
}}

SLIDES:
1. TITLE: "Why {company_name} Needs {product_name}"
   - Hook: specific pain point or opportunity from their data

2. COMPANY OVERVIEW: Their business, market position, recent milestones
   - Use real numbers (funding, employees, revenue if known)

3. THEIR CHALLENGES: 2-3 specific pain points
   - Derived from industry analysis + company specifics
   - Be precise, not generic

4. OUR SOLUTION: How our product maps to their challenges
   - Feature → pain point mapping
   - Quantify impact where possible (save X hours, reduce Y cost)

5. FIT ANALYSIS: Why they're an ideal customer
   - Reference similar companies using our type of product
   - Industry-specific alignment

6. SOCIAL PROOF: Companies like them already benefiting
   - If we have data on similar customers, reference them

7. NEXT STEPS: Clear CTA
   - Suggested meeting agenda
   - "Let's explore how we can help {company_name} with {specific_challenge}"

RULES:
- Every claim must trace back to the enrichment data
- No generic filler — if you don't have data, say something specific about the industry
- Body HTML should be clean: use <p>, <ul>, <li>, <strong> only
- Speaker notes should be conversational, 2-3 sentences
"""

EMAIL_SYSTEM_PROMPT = """You are writing a cold outreach email to {contact_name}, {contact_role} at {company_name}.

Context: {enriched_data}
Our product: {product_description}

Write a short (5-7 sentences) personalized email that:
- Opens with something specific about THEIR company (recent funding, product launch, challenge)
- Connects it to what we do in ONE sentence
- Proposes a specific value ("save X", "improve Y")
- Ends with low-friction CTA (15-min call, not a demo)
- Tone: professional but human, not salesy

Return JSON: {{"subject": "...", "body": "..."}}
"""
```

### Testing the Pitch Deck Prompt
- Generate decks for 5 very different companies (startup, enterprise, different industries)
- Score each slide: specific (1-5) + actionable (1-5) + accurate (1-5)
- Iterate until average > 4.0 per slide
- Test edge cases: what if we have minimal data? Does the prompt degrade gracefully?

### Deliverable by Hour 14
- Pitch deck prompt producing high-quality slides for any company type
- Email prompt producing personalized, non-generic outreach
- Both tested across 10+ companies

---

## Phase 3 — Voice Script + Gemini Prompts (Hours 14-20)

### ElevenLabs Voice Script Prompt
```python
VOICE_BRIEFING_PROMPT = """Create a 30-second spoken briefing to prepare a salesperson for a call with {company_name}.

Data: {enriched_data}

Format: conversational, like a colleague briefing you in the elevator.
Include: key decision maker name, what the company does, their main pain point, your opening angle.
Keep under 80 words (≈30 seconds spoken).
"""
```

### Gemini Website Analysis Prompt
```python
GEMINI_WEBSITE_PROMPT = """Analyze this screenshot of {company_name}'s website ({url}).

Extract:
1. Brand positioning: how do they present themselves?
2. Target audience: who is this website designed for?
3. Product maturity: startup/growth/enterprise feel?
4. Technology signals: any tech stack indicators visible?
5. Design quality: professional/amateur/enterprise grade?

Return JSON with these 5 fields. Be specific and observational.
"""
```

---

## Phase 4 — Quality Pass (Hours 20-24)
- [ ] Run all prompts against 5 demo companies, fix any issues
- [ ] Ensure pitch decks are flawless for demo companies
- [ ] Prepare 3 backup pitch decks (pre-generated) in case API is slow during demo
- [ ] Review all Claude outputs for hallucination — flag any and add guardrails
