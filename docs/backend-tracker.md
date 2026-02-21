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
ELEVENLABS_API_KEY=...             # Phase 3
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
- [ ] `backend/actions/voice_summary.py` — ElevenLabs TTS voice briefing
- [ ] `POST /api/leads/{id}/voice` endpoint
- [ ] Stripe billing: checkout session, credit metering, credits endpoint
- [ ] `POST /api/billing/checkout`, `GET /api/billing/credits`

### Phase 4 — Polish
- [ ] Pre-cache enrichment + matches for 5 demo companies
- [ ] Error handling: graceful API failure responses
- [ ] Rate limiting on enrichment (don't burn LinkUp credits)
