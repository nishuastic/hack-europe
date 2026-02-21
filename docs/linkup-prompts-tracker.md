# LinkUp & Prompts Tracker — Person B

## Your Role
You are the **data quality gatekeeper**. The entire product is only as good as the data we extract. Your job:
1. Craft and optimize LinkUp search queries for each enrichment field
2. Design Claude prompts that extract structured data reliably
3. Design the **product-matching prompt** (scores each product's fit per company)
4. Design the pitch deck generation prompt (now product-specific per lead)
5. Test everything across 20+ companies and score quality
6. Deliver tested prompts in `prompts/` that Person A imports directly

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
- [ ] `prompts/claude_prompts.py` — Claude system prompts for extraction + matching
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

### Claude Extraction Prompt (updated — no fit_score, enrichment only)
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
  "customers": ["Customer1", "Customer2"]
}

Be specific. Use real numbers. If data isn't available, say 'Unknown' — never fabricate.

Also extract buying signals — structured indicators of purchase intent:
  "buying_signals": [
    {
      "signal_type": "recent_funding | hiring_surge | competitor_mentioned | expansion | pain_indicator | tech_stack_match",
      "description": "Specific evidence, e.g. 'Raised $45M Series B in Jan 2024'",
      "strength": "strong | moderate | weak"
    }
  ]

Signal types:
- recent_funding: Recent fundraise = budget available
- hiring_surge: Growing headcount = needs tools/infrastructure
- competitor_mentioned: Uses a competitor product = switching opportunity
- expansion: New market, geo, or product launch = needs support
- pain_indicator: Negative press, layoffs, tech debt mentions
- tech_stack_match: Their stack aligns with product's target tech

Extract ALL signals you can find evidence for. Empty array if none found.
"""
```

### Product-Matching Prompt (NEW)
```python
# prompts/claude_prompts.py

PRODUCT_MATCHING_PROMPT = """You are a senior sales strategist. Given an enriched company profile and a catalog of products,
score how well each product fits this company as a potential customer.

Company profile:
{enriched_data}

Product catalog:
{product_catalog}

For EACH product, return a JSON array:
[
  {
    "product_id": <id>,
    "match_score": 1-10,
    "match_reasoning": "2-3 sentence explanation of why this product does or doesn't fit this company"
  }
]

Scoring guide:
- 9-10: Near-perfect fit — company's industry, size, and pain points align exactly with the product
- 7-8: Strong fit — clear use case, minor gaps
- 5-6: Moderate fit — some alignment but not an obvious match
- 3-4: Weak fit — product could theoretically help but it's a stretch
- 1-2: Poor fit — no meaningful alignment

Consider: industry alignment, company size vs. product's target market, likely pain points vs. product features,
geography, stage, and whether the company already uses competing solutions (from their customer/tech data).
Be honest — not every product fits every company. A score of 3 is fine if it's accurate.
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

## Phase 2 — Product Matching + Pitch Deck Prompt (Hours 8-14)

### Product-Matching Prompt (critical new deliverable)
The matching prompt is now a core piece of the pipeline. It runs after enrichment and before any actions.
- Test with 3-5 different products against 10+ companies
- Verify scores are well-distributed (not all 8s — some should be 3s and 4s)
- Verify reasoning is specific and references actual enrichment data
- Edge cases: what if a product has no industry_focus? What if a company has minimal enrichment data?

### The Pitch Deck Prompt (updated — now product-specific)
This is our killer feature. The pitch deck prompt must produce slides that feel like a human consultant wrote them.

### File to Create
- [ ] `prompts/pitch_deck_prompt.py`

### Prompt Structure
```python
# prompts/pitch_deck_prompt.py

PITCH_DECK_SYSTEM_PROMPT = """You are an elite sales consultant creating a personalized pitch deck.

Given:
- Our product: {product_profile}  (name, description, features, differentiator, etc.)
- Target company enrichment data: {enriched_data}
- Match analysis: {match_reasoning}

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

4. OUR SOLUTION: How {product_name} maps to their challenges
   - Feature → pain point mapping (use actual product features)
   - Quantify impact where possible (save X hours, reduce Y cost)

5. FIT ANALYSIS: Why they're an ideal customer for this specific product
   - Reference the match reasoning
   - Industry-specific alignment

6. SOCIAL PROOF: Companies like them already benefiting
   - Reference product's example_clients if available
   - If we have data on similar customers, reference them

7. NEXT STEPS: Clear CTA
   - Suggested meeting agenda
   - "Let's explore how {product_name} can help {company_name} with {specific_challenge}"

RULES:
- Every claim must trace back to the enrichment data or product profile
- No generic filler — if you don't have data, say something specific about the industry
- Body HTML should be clean: use <p>, <ul>, <li>, <strong> only
- Speaker notes should be conversational, 2-3 sentences
"""

EMAIL_SYSTEM_PROMPT = """You are writing a cold outreach email to {contact_name}, {contact_role} at {company_name}.

Context: {enriched_data}
Product being pitched: {product_profile}
Why this product fits them: {match_reasoning}

Write a short (5-7 sentences) personalized email that:
- Opens with something specific about THEIR company (recent funding, product launch, challenge)
- Connects it to what {product_name} does in ONE sentence
- Proposes a specific value ("save X", "improve Y")
- Ends with low-friction CTA (15-min call, not a demo)
- Tone: professional but human, not salesy

Return JSON: {{"subject": "...", "body": "..."}}
"""
```

### Conversion Prediction Prompt (NEW — Data Prize)
```python
# prompts/claude_prompts.py

CONVERSION_PREDICTION_PROMPT = """You are a senior sales analytics expert. Given a dataset of enriched leads with their buying signals, product match scores, and product details, predict which leads are most likely to convert into customers.

Dataset:
{dataset}

For EACH lead-product match, return:
[
  {{
    "lead_id": <id>,
    "product_id": <id>,
    "conversion_likelihood": "high" | "medium" | "low",
    "conversion_reasoning": "1-2 sentence explanation of why"
  }}
]

Pattern analysis guidelines:
- Companies with recent_funding + hiring_surge signals are high-intent buyers
- Companies already using competitor products (competitor_mentioned) are switching opportunities
- High match_score (7+) + strong buying signals = "high" conversion likelihood
- Look for clusters: "companies in fintech with 50-200 employees that recently raised tend to convert"
- Companies with pain_indicator signals + strong product fit = urgent need
- Consider the product's example_clients — similar companies to existing clients convert better

Be data-driven. Reference specific signals and scores in your reasoning.
"""
```

### Testing the Pitch Deck Prompt
- Generate decks for 5 very different companies × 2-3 different products
- Score each slide: specific (1-5) + actionable (1-5) + accurate (1-5)
- Iterate until average > 4.0 per slide
- Test edge cases: what if we have minimal data? Does the prompt degrade gracefully?
- Test: does the deck feel different when pitching Product A vs Product B to the same company?

### Deliverable by Hour 14
- Product-matching prompt producing well-distributed, specific scores
- Pitch deck prompt producing high-quality, product-specific slides for any company type
- Email prompt producing personalized, product-specific outreach
- All tested across 10+ companies × multiple products

---

## Phase 3 — Voice Script Prompt (Hours 14-20)

### ElevenLabs Voice Script Prompt
```python
VOICE_BRIEFING_PROMPT = """Create a 30-second spoken briefing to prepare a salesperson for a call with {company_name}.

Data: {enriched_data}
Product to pitch: {product_name}
Match reasoning: {match_reasoning}

Format: conversational, like a colleague briefing you in the elevator.
Include: key decision maker name, what the company does, their main pain point, which product to pitch and why, your opening angle.
Keep under 80 words (≈30 seconds spoken).
"""
```

---

## Multi-Agent Prompt Specs (NEW — for Person B)

The backend now uses a **3-agent pipeline** instead of the old flat search → extract flow. Each agent has an inline fallback prompt, but Person B should create proper prompts that the agents import.

### 1. `prompts/query_planner_prompt.py`

**What the agent does:** Takes a company name and generates 5-8 tailored search queries (not hardcoded templates). On follow-up rounds, takes gap info and generates 2-4 targeted queries.

**What to create:**
```python
def build_prompt() -> tuple[str, str]:
    """Return (system_prompt, follow_up_addendum).

    system_prompt: Main prompt for Claude to generate search queries.
    follow_up_addendum: Appended when doing follow-up rounds.
        Must contain {gaps}, {hints}, {existing_context} format placeholders.
    """
```

**System prompt should instruct Claude to:**
- Generate JSON: `{"queries": [{"query": "...", "depth": "standard|deep", "target_field": "...", "rationale": "..."}]}`
- Target fields: description, funding, industry, revenue, employees, contacts, customers, buying_signals
- Use "standard" for simple lookups, "deep" for contacts/customers/revenue
- Make queries specific to the company (not generic templates)
- For follow-up: only generate queries for missing fields

**Imported by:** `backend/enrichment/agents/query_planner.py`

### 2. `prompts/extraction_prompt.py`

**What the agent does:** Takes search results and extracts structured Lead fields. Also returns confidence per field, list of gaps, and follow-up hints. On follow-up rounds, merges new data with existing.

**What to create:**
```python
def build_prompt() -> tuple[str, str]:
    """Return (system_prompt, merge_addendum).

    system_prompt: Main prompt for Claude to extract structured data.
    merge_addendum: Appended when merging with existing data.
        Must contain {existing_data} format placeholder.
    """
```

**System prompt should instruct Claude to return JSON:**
```json
{
  "data": {
    "description": "...", "funding": "...", "industry": "...",
    "revenue": "...", "employees": 123,
    "contacts": [{"name": "...", "role": "...", "linkedin": "..."}],
    "customers": ["..."],
    "buying_signals": [{"signal_type": "...", "description": "...", "strength": "..."}]
  },
  "field_confidences": [{"field": "...", "confidence": "high|medium|low", "reason": "..."}],
  "gaps": ["field names that are missing"],
  "follow_up_hints": ["specific search suggestions"]
}
```

**Merge rules for follow-up:**
- Keep existing values if new data doesn't contradict
- Replace if new data is higher-confidence
- Append to lists (deduplicate by name)

**Imported by:** `backend/enrichment/agents/data_extractor.py`

### 3. Contract Summary

| File | Function | Returns | Imported By |
|------|----------|---------|-------------|
| `prompts/query_planner_prompt.py` | `build_prompt()` | `tuple[str, str]` (system, follow_up) | `agents/query_planner.py` |
| `prompts/extraction_prompt.py` | `build_prompt()` | `tuple[str, str]` (system, merge) | `agents/data_extractor.py` |

Both agents fall back to inline placeholder prompts if the import fails — so the system works even before Person B delivers. But the inline prompts are basic; Person B's versions should be much more detailed and tested.

### 4. Test Runner — Iterating on Prompts

The test runner lets you run the full 3-agent pipeline (or individual stages) from the CLI without starting the server. Results are saved as JSON for comparison.

**Quick start:**
```bash
# From project root (where .env lives):

# Free: iterate on query planner prompt (Claude Haiku only, no LinkUp)
uv run python -m prompts.test_runner "Stripe" --stage plan

# Run plan + search (costs LinkUp credits, no extraction)
uv run python -m prompts.test_runner "Stripe" --stage search

# Full pipeline: plan + search + extract (shows completeness table)
uv run python -m prompts.test_runner "Stripe"

# Multiple companies
uv run python -m prompts.test_runner "Stripe" "Plaid" "Datadog"

# 5 default companies
uv run python -m prompts.test_runner

# All 20 test companies
uv run python -m prompts.test_runner --all

# Don't save results to prompts/results/
uv run python -m prompts.test_runner "Stripe" --no-save
```

**Workflow for iterating on query planner prompt:**
1. Edit `prompts/query_planner_prompt.py`
2. Run `uv run python -m prompts.test_runner "Stripe" --stage plan`
3. Check query quality — are they specific? Do they cover all fields?
4. Repeat until satisfied, then run full pipeline

**Workflow for iterating on extraction prompt:**
1. Edit `prompts/extraction_prompt.py`
2. Run `uv run python -m prompts.test_runner "Stripe"` (full pipeline)
3. Check the extraction table — completeness %, confidence levels, gaps
4. Compare JSON results in `prompts/results/` across prompt versions

**Comparing prompt versions:**
Results are saved to `prompts/results/<timestamp>_<company>.json`. To compare two versions, diff the JSON files or look at the `scores` section.

---

## Phase 4 — Quality Pass (Hours 20-24)
- [ ] Run all prompts against 5 demo companies x 3 demo products, fix any issues
- [ ] Ensure product matches are well-calibrated for demo data
- [ ] Ensure pitch decks are flawless for demo companies
- [ ] Prepare 3 backup pitch decks (pre-generated) in case API is slow during demo
- [ ] Review all Claude outputs for hallucination — flag any and add guardrails
