# SalesForge — Architecture Overview

## What We're Building
An AI sales agent that takes your product description, finds ideal client companies via web research, enriches them with deep data, and generates personalized pitch decks + outreach emails. **Cheaper, specialized Claygent.**

## Stack
```
Backend:  Python 3.12 + FastAPI (managed by uv)
Frontend: Next.js + TypeScript + AG Grid (managed by bun)
DB:       SQLite via SQLModel
Realtime: WebSocket (enrichment streams live to cells)
AI:       Claude (reasoning) + Gemini (multimodal) + ElevenLabs (voice)
Search:   LinkUp SDK (web research)
Billing:  Stripe (usage-based)
```

## Directory Structure
```
hack-europe/
├── backend/                         # Person A
│   ├── main.py                      # FastAPI app, CORS, route registration
│   ├── config.py                    # Settings from env vars
│   ├── models.py                    # SQLModel schemas (Lead, PitchDeck, etc.)
│   ├── db.py                        # SQLite init + session
│   ├── enrichment/
│   │   ├── linkup_search.py         # LinkUp SDK wrapper
│   │   ├── claude_enricher.py       # Claude structured extraction
│   │   ├── gemini_enricher.py       # Website screenshot analysis (Phase 3)
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
│   │   ├── SpreadsheetGrid.tsx      # AG Grid with enrichment columns
│   │   ├── ActionPanel.tsx          # Side panel: deck, email, voice
│   │   ├── LeadImport.tsx           # CSV paste input
│   │   ├── ProductConfig.tsx        # "Describe your product" form
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
User describes their product + pastes company list
    │
    ▼
POST /api/leads/import ──▶ FastAPI saves leads to SQLite
    │
    ▼
Enrichment Pipeline (async, per lead):
    1. LinkUp search (company info, funding, contacts, customers)
    2. Claude analysis (structure data, score fit, extract pain points)
    3. Gemini (screenshot website → visual brand analysis) [Phase 3]
    │
    ├── WebSocket pushes cell updates to frontend in real-time
    │
    ▼
User clicks row → Action Panel:
    • Generate Pitch Deck (Claude → 7 slides → HTML + PPTX)
    • Draft Email (personalized outreach)
    • Voice Briefing (ElevenLabs call-prep audio) [Phase 3]
    │
    ▼
All actions metered via Stripe [Phase 3]
```

## API Contract (for frontend ↔ backend coordination)

### Endpoints
```
POST   /api/product              # Save product description
POST   /api/leads/import         # Import CSV of companies
GET    /api/leads                # List all leads with enrichment data
GET    /api/leads/{id}           # Single lead detail
POST   /api/leads/{id}/enrich    # Trigger enrichment for one lead
POST   /api/leads/{id}/pitch-deck  # Generate pitch deck
GET    /api/leads/{id}/pitch-deck  # Get generated deck (HTML)
GET    /api/leads/{id}/pitch-deck/download  # Download PPTX
POST   /api/leads/{id}/email     # Generate outreach email
POST   /api/leads/{id}/voice     # Generate voice briefing [Phase 3]
POST   /api/billing/checkout     # Stripe checkout session [Phase 3]
GET    /api/billing/credits      # Remaining credits [Phase 3]
WS     /ws/updates               # Real-time cell updates
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
  "fit_score": 8.5,
  "fit_reasoning": "Strong alignment because...",
  "enrichment_status": "complete",
  "pitch_deck_generated": false,
  "email_generated": false
}
```

## Prize Strategy
| Prize | How We Win It | Phase |
|-------|--------------|-------|
| Agentic AI Track (€1k) | Agent autonomously researches, enriches, generates decks | 2 |
| Best Use of Data (€7k) | LinkUp raw data → structured insight + fit scores + pitch decks | 1 |
| Best Use of Claude ($10k credits) | Core reasoning engine: extraction, scoring, deck generation, tool-use | 1-2 |
| Best Stripe Integration (€3k) | Usage-based billing, pay-per-enrichment/deck | 3 |
| Autonomous Consulting Agent | Acts like a senior SDR/consultant | 2 |
| Adaptable Agent | Re-scores when new info contradicts initial analysis | 2 |
| Best Use of ElevenLabs (AirPods) | Voice call-prep briefing per lead | 3 |
| Best Use of Gemini (€50k credits) | Website screenshot → multimodal brand/product analysis | 3 |
