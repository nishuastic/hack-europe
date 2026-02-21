# Backend Tracker — Person A

## Your Stack
- **Python 3.12** with **uv** (package manager)
- **FastAPI** + **uvicorn** (API server)
- **SQLModel** + **SQLite** (database)
- **WebSocket** (real-time updates to frontend)
- **anthropic** SDK (Claude API)
- **linkup-sdk** (web search — uses Person B's optimized queries from `prompts/`)
- **elevenlabs** (TTS, Phase 3)
- **stripe** (billing, Phase 3)

## Setup Commands
```bash
cd /path/to/hack-europe
uv add fastapi "uvicorn[standard]" sqlmodel linkup-sdk anthropic websockets python-multipart aiosqlite jinja2 python-pptx weasyprint
uv run uvicorn backend.main:app --reload --port 8000
```

## Lint & Type-Check Workflow
Run after every code change:
```bash
uv run ruff check backend/              # Linter (fast, auto-fixable)
uv run ruff check backend/ --fix        # Auto-fix what it can
uv run mypy backend/ --ignore-missing-imports  # Type checker
```
Run tests:
```bash
uv run pytest backend/tests/ -v          # Unit tests (50 tests)
```
All three must pass clean before committing. Dev deps: `uv add --dev ruff mypy pytest pytest-asyncio httpx`

## Environment Variables (`.env`)
```
ANTHROPIC_API_KEY=sk-ant-...
LINKUP_API_KEY=...
ELEVENLABS_API_KEY=...      # Phase 3
STRIPE_SECRET_KEY=sk_test_... # Phase 3
```

---

## Phase 1 — Core Enrichment + Product Catalog (Hours 0-8)

### Files to Create
- [x] `backend/__init__.py`
- [x] `backend/main.py` — FastAPI app, CORS, WebSocket manager, Product CRUD, Lead import + list + single enrich endpoint
- [x] `backend/config.py` — `Settings` class (pydantic-settings) reading from `.env`
- [x] `backend/models.py` — SQLModel schemas (**see `models.py` already created**)
- [x] `backend/db.py` — Async SQLite engine (aiosqlite) + session dependency + `init_db()`
- [x] `backend/enrichment/__init__.py`
- [x] `backend/enrichment/linkup_search.py` — LinkUp client singleton (lazy init)
- [x] `backend/enrichment/pipeline.py` — Multi-agent orchestrator with iterative follow-up (max 2 rounds)
- [x] `backend/enrichment/agents/__init__.py`
- [x] `backend/enrichment/agents/query_planner.py` — Agent 1: Claude generates tailored search queries per company
- [x] `backend/enrichment/agents/search_executor.py` — Agent 2: LinkUp parallel search (sourcedAnswer + structured modes)
- [x] `backend/enrichment/agents/data_extractor.py` — Agent 3: Claude extracts structured Lead fields + gap analysis
- [x] ~~`backend/enrichment/claude_enricher.py`~~ — **Deleted**: logic moved to `agents/data_extractor.py`
- [x] `backend/discovery/__init__.py`
- [x] `backend/discovery/prompts.py` — ICP discovery system prompt builder
- [x] `backend/discovery/icp_agent.py` — Claude Sonnet tool_use agent (4 tools, iterative search)
- [x] `backend/discovery/discovery_pipeline.py` — Orchestrator: products → agent → leads → auto-enrich

### API Endpoints — DONE
```python
# Product catalog CRUD — all implemented ✅
POST /api/products          # Bulk import: {"products": [{name, description, ...}]}
GET  /api/products          # List all products
GET  /api/products/{id}     # Single product detail
PUT  /api/products/{id}     # Update a product
DELETE /api/products/{id}   # Remove a product

# ICP Discovery — implemented ✅
POST /api/discovery/run     # {product_ids?: int[], max_companies: int} → discovers leads matching ICPs

# Lead management — all implemented ✅
POST /api/leads/import      # {"companies": ["Stripe", "Plaid"]} → creates leads + fires enrichment
GET  /api/leads             # All leads with enrichment data
GET  /api/leads/{id}        # Single lead detail
POST /api/leads/{id}/enrich # Re-trigger enrichment for a single lead

# Real-time — implemented ✅
WS   /ws/updates            # Broadcasts discovery_*, enrichment_start, cell_update, enrichment_complete
```

### WebSocket Protocol
When enrichment completes a field for a lead, push:
```json
{"type": "cell_update", "lead_id": "abc123", "field": "funding", "value": "Series B, $45M", "status": "complete"}
```
When enrichment starts for a lead:
```json
{"type": "enrichment_start", "lead_id": "abc123"}
```
When all fields done:
```json
{"type": "enrichment_complete", "lead_id": "abc123"}
```

### Key Implementation Notes
- Use `asyncio.create_task()` to run enrichment in background after import endpoint returns
- Use Person B's queries from `prompts/linkup_queries.py` — import them, don't hardcode queries
- Claude enricher should return structured JSON matching the Lead model fields (no fit_score — that moves to matching)
- Store enrichment results in SQLite as they come in (partial updates OK)
- Product model now has full profile fields (features, industry_focus, pricing_model, etc.) — see `models.py`

---

## Phase 2 — Product Matching + Pitch Deck + Actions (Hours 8-14)

### Files to Create
- [ ] `backend/actions/__init__.py`
- [ ] `backend/actions/pitch_deck.py` — Claude → JSON slides → HTML (Jinja2) + PPTX (python-pptx)
- [ ] `backend/actions/email_generator.py` — Personalized outreach emails
- [ ] `backend/agent/__init__.py`
- [ ] `backend/agent/orchestrator.py` — Claude tool-use loop (includes matching logic)
- [ ] `templates/pitch_deck.html` — Jinja2 template for 16:9 slides

### API Endpoints
```python
# Matching
POST /api/matches/generate              # Trigger AI matching: all enriched leads × all products
GET  /api/matches                       # List all matches (filterable by lead_id or product_id)

# Actions (now product-aware)
POST /api/leads/{id}/pitch-deck?product_id=X  # Generate deck for specific product-lead pair
GET  /api/leads/{id}/pitch-deck/download       # Return PPTX file
POST /api/leads/{id}/email?product_id=X        # Generate email for specific product-lead pair
```

### Analytics & Prediction Endpoints (Data Prize)
```python
# Analytics
GET  /api/analytics               # Aggregate insights: industry breakdown, signal frequency, score distribution, top opportunities
POST /api/analytics/predict       # Run Claude conversion prediction across all matches → updates ProductMatch records
```

**`GET /api/analytics` returns:**
```json
{
  "total_leads": 25,
  "enriched": 23,
  "industry_breakdown": {"FinTech": 8, "SaaS": 6},
  "avg_match_score_by_product": {"SalesForge Pro": 7.2},
  "top_opportunities": [{"lead": "Stripe", "product": "Pro", "score": 9.5}],
  "signal_frequency": {"recent_funding": 12, "hiring_surge": 8},
  "score_distribution": {"1-3": 4, "4-6": 9, "7-10": 12}
}
```

**`POST /api/analytics/predict`:** Sends all enriched leads + buying signals + match scores to Claude. Claude identifies conversion patterns and returns `conversion_likelihood` ("high"/"medium"/"low") + `conversion_reasoning` per match. Push `prediction_update` WS messages as they come in.

### Matching Pipeline (new step between enrichment and actions)
1. Triggered via `POST /api/matches/generate` (or automatically after all leads enriched)
2. Load all enriched leads + all products from DB
3. For each lead, call Claude with the product-matching prompt (from `prompts/claude_prompts.py`)
   - Input: enriched lead data + full product catalog
   - Output: ranked list of products with match_score (1-10) + match_reasoning per product
4. Save `ProductMatch` records to DB
5. Push `match_update` WebSocket messages to frontend

### Pitch Deck Flow (updated)
1. Receive request with lead_id + product_id
2. Load enriched lead data from DB
3. Load the specific matched product from DB
4. Call Claude with pitch deck prompt (from `prompts/pitch_deck_prompt.py`) — now takes both product profile and lead data
5. Parse JSON response → 7 slides
6. Render HTML via Jinja2 template → return to frontend
7. Generate PPTX via python-pptx → store for download

### Agent Orchestrator (Claude Tool-Use)
Define tools for Claude:
- `search_web(query)` → LinkUp
- `analyze_company(lead_id)` → Claude enrichment
- `match_products(lead_id)` → run matching for a lead against all products
- `generate_pitch_deck(lead_id, product_id)` → pitch deck for specific pair
- `draft_email(lead_id, product_id)` → email for specific pair
- `re_evaluate(lead_id, new_info)` → adaptation (Adaptable Agent prize)

Claude plans the sequence and calls tools autonomously.

---

## Phase 3 — Stripe + ElevenLabs (Hours 14-20)

### Files to Create
- [ ] `backend/actions/voice_summary.py` — ElevenLabs TTS
- [ ] `backend/billing/__init__.py`
- [ ] `backend/billing/stripe_billing.py` — Checkout + metering

### ElevenLabs Voice
- `POST /api/leads/{id}/voice` → generate 30s audio briefing
- Use Claude to write the script, ElevenLabs to speak it
- Return audio URL/blob

### Stripe Integration
- Create Stripe product + price in test mode
- `POST /api/billing/checkout` → create Checkout Session → return URL
- After payment, set credits on user
- Each enrichment/action call decrements credits
- `GET /api/billing/credits` → return remaining

---

## Phase 4 — Polish (Hours 20-24)
- [ ] Pre-cache enrichment + matches for 5 demo companies
- [ ] Error handling: API failures return graceful errors, don't crash
- [ ] WebSocket reconnection handling
- [ ] Rate limiting on enrichment (don't burn all LinkUp credits)
