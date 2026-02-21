# Stick — Architecture Overview

## What We're Building
An AI sales agent that takes a catalog of products, autonomously discovers target companies, enriches them with deep web research, matches the best product(s) to each company, and generates personalized pitch decks + outreach emails. **Cheaper, specialized Claygent.**

## Stack
```
Backend:  Python 3.12 + FastAPI (managed by uv)
Frontend: Next.js + TypeScript + AG Grid (managed by bun)
DB:       SQLite via SQLModel
Realtime: WebSocket (enrichment + matching streams live to cells)
AI:       Claude (reasoning/generation) + ElevenLabs (voice briefings)
Search:   LinkUp SDK (web research)
Billing:  Stripe + Paid.ai (usage-based credits)
```

## Directory Structure
```
hack-europe/
├── backend/
│   ├── main.py                      # FastAPI app, CORS, all routes, WebSocket manager
│   ├── config.py                    # Settings from env vars
│   ├── models.py                    # SQLModel schemas (Lead, Product, ProductMatch, PitchDeck, etc.)
│   ├── db.py                        # SQLite init + session
│   ├── auth.py                      # JWT auth (register, login, refresh, verify)
│   ├── analytics.py                 # SQL aggregations + Claude conversion predictions
│   ├── billing.py                   # Stripe + Paid.ai billing, credit gating
│   ├── enrichment/
│   │   ├── linkup_search.py         # LinkUp client singleton
│   │   ├── pipeline.py              # Multi-agent orchestrator with iterative follow-up
│   │   └── agents/
│   │       ├── query_planner.py     # Agent 1: Claude → tailored search queries
│   │       ├── search_executor.py   # Agent 2: LinkUp parallel search (no Claude)
│   │       └── data_extractor.py    # Agent 3: Claude → structured Lead fields + gap analysis
│   ├── discovery/
│   │   ├── prompts.py               # ICP discovery system prompt builder
│   │   ├── icp_agent.py             # Claude Sonnet tool-use agent
│   │   └── discovery_pipeline.py    # Orchestrator: products → agent → leads → auto-enrich
│   ├── matching/
│   │   └── pipeline.py              # Claude matches all products against each lead
│   ├── actions/
│   │   ├── pitch_deck.py            # Claude → JSON slides → Jinja2 HTML → PPTX
│   │   └── email_generator.py       # Personalized outreach emails
│   └── tests/                       # 69 tests
├── prompts/                         # Prompt engineering (imported by backend with fallbacks)
│   ├── query_planner_prompt.py
│   ├── extraction_prompt.py
│   ├── discovery_prompt.py
│   ├── matching_prompt.py
│   ├── pitch_deck_prompt.py
│   ├── email_prompt.py
│   ├── test_runner.py               # CLI test harness
│   └── test_discovery.py            # Discovery prompt tester
├── frontend/                        # Next.js app
├── templates/
│   └── pitch_deck.html              # Jinja2 slide template (dark, 16:9)
└── docs/
```

## Core Pipelines

### 1. ICP Discovery (Agentic — Claude Sonnet tool-use)
The discovery agent is the "agentic AI" centerpiece.

```
POST /api/discovery/run {product_ids?, max_companies}
  → Load products from DB
  → Build ICP system prompt from product catalog
  → Claude Sonnet generates search queries based on ICPs
  → LinkUp executes queries → returns companies
  → Create Lead rows for each discovered company
  → Auto-trigger enrichment for all discovered leads
  → Broadcasts: discovery_start → discovery_thinking → company_discovered → discovery_complete
```

### 2. Multi-Agent Enrichment (3-agent pipeline)
Each "agent" is an async Python function — no frameworks, just Claude SDK + LinkUp SDK.

```
For each lead (max 3 parallel via Semaphore):
  Round 1 — Broad Research:
    Agent 1 (Query Planner):  Claude generates 5-8 search queries
    Agent 2 (Search Executor): LinkUp parallel search (sourcedAnswer + structured)
    Agent 3 (Data Extractor):  Claude extracts structured Lead fields + gap analysis

  If important gaps remain AND round < 2:
    Round 2 — Targeted Follow-up (2-4 queries, merges with existing data)

  Broadcasts cell_update per field as they're extracted (0.15s apart for UI effect)
```

### 3. Product Matching
```
POST /api/matches/generate
  → Load all enriched leads + all products
  → For each lead: one Claude Haiku call with full product catalog
  → Returns ranked matches with scores (1-10), reasoning, conversion likelihood
  → Saves ProductMatch records, broadcasts match_update per pair
```

### 4. Pitch Deck Generation (3-stage)
```
POST /api/leads/{id}/pitch-deck?product_id=X
  Stage 1: Claude → 7 JSON slides (title, company snapshot, challenge, solution, fit, proof, CTA)
  Stage 2: Jinja2 → HTML (templates/pitch_deck.html, 1280x720 dark theme)
  Stage 3: python-pptx → PPTX file (saved to generated/pitchdecks/)
```

### 5. Email Generation
```
POST /api/leads/{id}/email?product_id=X
  → Single Claude call with lead profile + product + match reasoning + best contact
  → Returns subject + body
```

### 6. Analytics & Predictions
```
GET /api/analytics
  → SQL aggregations: industry breakdown, signal frequency, score distribution,
    avg match score by product, top 5 opportunities

POST /api/analytics/predict
  → Claude analyzes enriched leads + buying signals + match scores
  → Returns conversion_likelihood (high/medium/low) + reasoning per match
  → Broadcasts prediction_update via WebSocket
```

### 7. Billing (Stripe + Paid.ai)
```
Credit system: 100 free SC on signup
Costs: Enrichment=5, Matching=2, Pitch Deck=10, Email=1, Voice=3

GET  /api/billing/credits      → balance + plans + packs
POST /api/billing/subscribe    → tier checkout URL (Starter/Growth/Scale)
POST /api/billing/buy-credits  → PAYG pack checkout URL (100/500/2000/5000 SC)
POST /api/billing/webhook      → Stripe webhook (adds credits after payment)
GET  /api/billing/usage        → usage history audit trail
```

## API Contract

### All Endpoints (Implemented)
```
# Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me

# Products
POST   /api/products
GET    /api/products
GET    /api/products/{id}
PUT    /api/products/{id}
DELETE /api/products/{id}

# Discovery
POST   /api/discovery/run

# Leads
POST   /api/leads/import
GET    /api/leads
GET    /api/leads/{id}
POST   /api/leads/{id}/enrich

# Matching
POST   /api/matches/generate
GET    /api/matches

# Actions
POST   /api/leads/{id}/pitch-deck?product_id=X
GET    /api/leads/{id}/pitch-deck
GET    /api/leads/{id}/pitch-deck/download
POST   /api/leads/{id}/email?product_id=X

# Analytics
GET    /api/analytics
POST   /api/analytics/predict

# Billing
GET    /api/billing/credits
POST   /api/billing/subscribe
POST   /api/billing/buy-credits
POST   /api/billing/webhook
GET    /api/billing/usage

# WebSocket
WS     /ws/updates
```

### Not Yet Implemented
```
POST   /api/leads/{id}/voice   # ElevenLabs voice briefing
```

### WebSocket Message Types
```json
// Discovery
{"type": "discovery_start", "product_count": 2, "max_companies": 20}
{"type": "discovery_thinking", "iteration": 1, "detail": "..."}
{"type": "company_discovered", "lead_id": 5, "company_name": "Acme Corp", "why_good_fit": "..."}
{"type": "discovery_complete", "companies_found": 15, "lead_ids": [5, 6, 7]}
{"type": "discovery_error", "error": "No products found"}

// Enrichment
{"type": "enrichment_start", "lead_id": 1, "company_name": "Stripe"}
{"type": "agent_thinking", "lead_id": 1, "round": 1, "action": "planning_queries", "detail": "..."}
{"type": "cell_update", "lead_id": 1, "field": "funding", "value": "Series B, $45M"}
{"type": "enrichment_complete", "lead_id": 1, "company_name": "Stripe", "rounds": 2}
{"type": "enrichment_error", "lead_id": 1, "error": "..."}

// Matching
{"type": "matching_start", "total_leads": 5, "total_products": 3}
{"type": "match_update", "lead_id": 1, "product_id": 2, "match_score": 8.5, "match_reasoning": "..."}
{"type": "matching_complete"}

// Predictions
{"type": "prediction_update", "lead_id": 1, "product_id": 2, "conversion_likelihood": "high"}
```

## Prize Strategy
| Prize | How We Win It |
|-------|--------------|
| Agentic AI Track (€1k) | ICP discovery agent: Claude Sonnet tool-use, autonomous company search |
| Best Use of Data (€7k) | LinkUp raw data → structured insights + buying signals + product matching + analytics dashboard |
| Best Use of Claude ($10k credits) | Core reasoning: query planning, extraction, ICP discovery, matching, deck gen, predictions |
| Best Stripe Integration (€3k) | Usage-based billing with Stick Credits, checkout sessions, webhook metering, Paid.ai signals |
| Autonomous Consulting Agent | Discovery agent acts like a senior SDR/consultant |
| Best Use of ElevenLabs (AirPods) | Voice call-prep briefing per lead |
