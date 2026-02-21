# SalesForge — Architecture Overview

## What We're Building
An AI sales agent that takes a catalog of products and a list of target companies, enriches the companies with deep web research, uses AI to match the best product(s) to each company, and generates personalized pitch decks + outreach emails per match. **Cheaper, specialized Claygent.**

## Stack
```
Backend:  Python 3.12 + FastAPI (managed by uv)
Frontend: Next.js + TypeScript + AG Grid (managed by bun)
DB:       SQLite via SQLModel
Realtime: WebSocket (enrichment + matching streams live to cells)
AI:       Claude (reasoning/generation) + ElevenLabs (voice briefings)
Search:   LinkUp SDK (web research)
Billing:  Stripe (usage-based)
```

## Directory Structure
```
hack-europe/
├── backend/                         # Person A
│   ├── main.py                      # FastAPI app, CORS, route registration
│   ├── config.py                    # Settings from env vars
│   ├── models.py                    # SQLModel schemas (Lead, Product, ProductMatch, PitchDeck, etc.)
│   ├── db.py                        # SQLite init + session
│   ├── enrichment/
│   │   ├── linkup_search.py         # LinkUp SDK wrapper
│   │   ├── claude_enricher.py       # Claude structured extraction
│   │   └── pipeline.py              # Orchestrates enrichment per lead
│   ├── actions/
│   │   ├── pitch_deck.py            # Claude → JSON slides → HTML + PPTX
│   │   ├── email_generator.py       # Personalized outreach emails
│   │   └── voice_summary.py         # ElevenLabs call-prep briefing (Phase 3)
│   ├── billing/
│   │   └── stripe_billing.py        # Stripe Checkout + metered usage (Phase 3)
│   └── agent/
│       └── orchestrator.py          # Claude tool-use agentic loop (Phase 2)
├── prompts/                         # Person B
│   ├── linkup_queries.py            # Optimized LinkUp query templates
│   ├── claude_prompts.py            # Claude system prompts for each step
│   ├── pitch_deck_prompt.py         # The pitch deck generation prompt
│   └── test_prompts.py              # Test harness: run N companies, score quality
├── frontend/                        # Person C + D
│   ├── package.json
│   ├── app/
│   │   ├── page.tsx                 # Main spreadsheet view
│   │   └── layout.tsx               # App shell
│   ├── components/
│   │   ├── SpreadsheetGrid.tsx      # AG Grid with enrichment + match columns
│   │   ├── ActionPanel.tsx          # Side panel: deck, email, voice (product-aware)
│   │   ├── LeadImport.tsx           # CSV paste input
│   │   ├── ProductCatalog.tsx       # Multi-product input form (add/edit/remove products)
│   │   ├── PitchDeckViewer.tsx      # HTML slide viewer + PPTX download
│   │   └── AgentThinking.tsx        # Agent reasoning display (Phase 3)
│   └── lib/
│       └── api.ts                   # Backend API client + WebSocket
├── templates/
│   └── pitch_deck.html              # Jinja2 slide template
├── docs/                            # Coordination
│   ├── architecture.md              # This file
│   ├── backend-tracker.md           # Person A progress
│   ├── linkup-prompts-tracker.md    # Person B progress
│   └── frontend-pitch-tracker.md    # Person C+D progress
├── pyproject.toml
└── .env.example
```

## Data Flow
```
User inputs product catalog + pastes company list
    │
    ▼
POST /api/products ──▶ FastAPI saves products to SQLite
POST /api/leads/import ──▶ FastAPI saves leads to SQLite
    │
    ▼
Enrichment Pipeline (async, per lead):
    1. LinkUp search (company info, funding, contacts, customers)
    2. Claude analysis (structure data, extract pain points)
    │
    ├── WebSocket pushes cell updates to frontend in real-time
    │
    ▼
Matching Pipeline (after enrichment):
    POST /api/matches/generate
    Claude analyzes each enriched lead against ALL products
    → Outputs ranked ProductMatch records (score + reasoning per pair)
    │
    ├── WebSocket pushes match updates to frontend
    │
    ▼
User clicks row → Action Panel (shows best-matched product):
    • Generate Pitch Deck for matched product-lead pair
    • Draft Email referencing the matched product
    │
    ▼
All actions metered via Stripe [Phase 3]
```

## API Contract (for frontend ↔ backend coordination)

### Endpoints
```
POST   /api/products              # Bulk import product catalog
GET    /api/products              # List all products
GET    /api/products/{id}         # Single product detail
PUT    /api/products/{id}         # Update a product
DELETE /api/products/{id}         # Remove a product
POST   /api/leads/import          # Import CSV of companies
GET    /api/leads                 # List all leads with enrichment data
GET    /api/leads/{id}            # Single lead detail
POST   /api/leads/{id}/enrich     # Trigger enrichment for one lead
POST   /api/matches/generate      # Trigger AI matching (all leads × all products)
GET    /api/matches               # List all product-lead matches with scores
GET    /api/matches?lead_id=X     # Matches for a specific lead
GET    /api/matches?product_id=X  # Matches for a specific product
POST   /api/leads/{id}/pitch-deck?product_id=X  # Generate pitch deck for product-lead pair
GET    /api/leads/{id}/pitch-deck  # Get generated deck (HTML)
GET    /api/leads/{id}/pitch-deck/download  # Download PPTX
POST   /api/leads/{id}/email?product_id=X  # Generate outreach email for product-lead pair
POST   /api/leads/{id}/voice      # Generate voice briefing [Phase 3]
GET    /api/analytics              # Aggregate analytics across all leads
POST   /api/analytics/predict     # Run Claude conversion prediction on all matches
POST   /api/billing/checkout      # Stripe checkout session [Phase 3]
GET    /api/billing/credits       # Remaining credits [Phase 3]
WS     /ws/updates                # Real-time cell + match updates
```

### WebSocket Message Format
```json
{
  "type": "cell_update",
  "lead_id": "abc123",
  "field": "funding",
  "value": "Series B, $45M (2024)",
  "status": "complete"
}
```

Match update:
```json
{
  "type": "match_update",
  "lead_id": "abc123",
  "product_id": "prod456",
  "match_score": 8.5,
  "match_reasoning": "Strong alignment because...",
  "product_name": "SalesForge Pro"
}
```

Prediction update:
```json
{
  "type": "prediction_update",
  "lead_id": "abc123",
  "product_id": "prod456",
  "conversion_likelihood": "high",
  "conversion_reasoning": "Similar profile to known converters: recent funding + fintech + 50-200 employees"
}
```

### Lead Schema (what the frontend renders)
```json
{
  "id": "abc123",
  "company_name": "Acme Corp",
  "url": "https://acme.com",
  "description": "200-word AI-generated summary...",
  "funding": "Series B, $45M (Jan 2024)",
  "industry": "FinTech",
  "revenue": "$12M ARR",
  "employees": 150,
  "contacts": [
    {"name": "Jane Doe", "role": "CEO", "linkedin": "https://linkedin.com/in/janedoe"}
  ],
  "customers": ["Stripe", "Plaid", "Revolut"],
  "buying_signals": [
    {"signal_type": "recent_funding", "description": "Raised $45M Series B in Jan 2024", "strength": "strong"},
    {"signal_type": "hiring_surge", "description": "Headcount grew 40% in 6 months", "strength": "moderate"}
  ],
  "enrichment_status": "complete",
  "matched_products": [
    {
      "product_id": "prod456",
      "product_name": "SalesForge Pro",
      "match_score": 8.5,
      "match_reasoning": "Strong alignment because...",
      "conversion_likelihood": "high",
      "conversion_reasoning": "Similar profile to known converters..."
    }
  ],
  "pitch_deck_generated": false,
  "email_generated": false
}
```

## Prize Strategy
| Prize | How We Win It | Phase |
|-------|--------------|-------|
| Agentic AI Track (€1k) | Agent autonomously researches, matches products, generates decks | 2 |
| Best Use of Data (€7k) | LinkUp raw data → structured insight + buying signals + product matching + conversion prediction + analytics dashboard + pitch decks | 1-2 |
| Best Use of Claude ($10k credits) | Core reasoning engine: extraction, matching, deck generation, tool-use | 1-2 |
| Best Stripe Integration (€3k) | Usage-based billing, pay-per-enrichment/deck | 3 |
| Autonomous Consulting Agent | Acts like a senior SDR/consultant, recommends which product to pitch | 2 |
| Best Use of ElevenLabs (AirPods) | Voice call-prep briefing per lead | 3 |
