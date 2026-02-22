# Backend Tracker

## Stack
- **Python 3.12** with **uv** (package manager)
- **FastAPI** + **uvicorn** (API server)
- **SQLModel** + **SQLite** (database)
- **WebSocket** (real-time updates)
- **anthropic** SDK (Claude API)
- **linkup-sdk** (web search)
- **bcrypt** + **python-jose** (auth)

## Setup
```bash
cd /path/to/hack-europe
uv run uvicorn backend.main:app --reload --port 8000
```

## Lint & Test
```bash
uv run ruff check backend/ --fix
uv run mypy backend/
uv run pytest backend/tests/ -v    # 60+ tests
```

## Environment Variables (`.env`)
```
ANTHROPIC_API_KEY=sk-ant-...
LINKUP_API_KEY=...
JWT_SECRET_KEY=...                 # For auth tokens
STRIPE_SECRET_KEY=sk_test_...      # Phase 3
```

---

## What's Built

### Auth (`backend/auth.py`)
- JWT-based authentication: register, login, token verification
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Password hashing via bcrypt, tokens via python-jose
- `get_current_user` FastAPI dependency for protected routes

### Product CRUD
- `POST /api/products` — bulk import
- `GET /api/products`, `GET /api/products/{id}`, `PUT /api/products/{id}`, `DELETE /api/products/{id}`

### ICP Discovery (`backend/discovery/`)
- Claude Sonnet tool-use agent with 4 tools: `search_companies`, `fetch_company_website`, `get_company_details`, `submit_discovered_companies`
- Takes product catalog → derives ICPs → autonomously searches → creates leads → auto-enriches
- `POST /api/discovery/run`

### Multi-Agent Enrichment (`backend/enrichment/`)
- 3-agent pipeline: Query Planner → Search Executor → Data Extractor
- Up to 2 rounds (broad + targeted follow-up based on gaps)
- Semaphore(3) concurrency limit
- Broadcasts `cell_update` per field via WebSocket
- `POST /api/leads/import`, `POST /api/leads/{id}/enrich`

### Product Matching (`backend/matching/`)
- One Claude Haiku call per lead with full product catalog
- Returns ranked matches with scores (1-10), reasoning, conversion likelihood
- `POST /api/matches/generate`, `GET /api/matches`

### Pitch Deck Generator (`backend/actions/pitch_deck.py`)
- 3-stage: Claude → 7 JSON slides → Jinja2 HTML → python-pptx PPTX
- `POST /api/leads/{id}/pitch-deck?product_id=X`
- `GET /api/leads/{id}/pitch-deck`, `GET /api/leads/{id}/pitch-deck/download`

### Email Generator (`backend/actions/email_generator.py`)
- Single Claude call → subject + body
- `POST /api/leads/{id}/email?product_id=X`

### Analytics (`backend/analytics.py`)
- SQL aggregations: industry breakdown, avg score by product, top opportunities, signal frequency, score distribution
- Claude conversion predictions for matches missing `conversion_likelihood`
- `GET /api/analytics`, `POST /api/analytics/predict`

---

## Remaining Work

### Phase 3 — Integrations
- [ ] Stripe billing: checkout session, credit metering, credits endpoint
- [ ] `POST /api/billing/checkout`, `GET /api/billing/credits`

<<<<<<< HEAD
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
  "avg_match_score_by_product": {"Stick Pro": 7.2},
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

## Phase 3 — Stripe (Hours 14-20)

### Files to Create
- [ ] `backend/billing/__init__.py`
- [ ] `backend/billing/stripe_billing.py` — Checkout + metering

### Stripe Integration
- Create Stripe product + price in test mode
- `POST /api/billing/checkout` → create Checkout Session → return URL
- After payment, set credits on user
- Each enrichment/action call decrements credits
- `GET /api/billing/credits` → return remaining

---

## Phase 4 — Polish (Hours 20-24)
=======
### Phase 4 — Polish
>>>>>>> 8d9f7ae204225a5c5fe19a72a608e654cc029ff5
- [ ] Pre-cache enrichment + matches for 5 demo companies
- [ ] Error handling: graceful API failure responses
- [ ] Rate limiting on enrichment (don't burn LinkUp credits)
