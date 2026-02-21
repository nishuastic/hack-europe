# Backend Tracker

## Stack
- **Python 3.12** with **uv** (package manager)
- **FastAPI** + **uvicorn** (API server)
- **SQLModel** + **SQLite** (database)
- **WebSocket** (real-time updates)
- **anthropic** SDK (Claude API)
- **linkup-sdk** (web search)
- **bcrypt** + **python-jose** (auth)
- **stripe** + **paid-python** (billing)

## Setup
```bash
cd /path/to/hack-europe
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

## Lint & Test
```bash
uv run ruff check backend/ --fix
uv run mypy backend/
uv run pytest backend/tests/ -v    # 69 tests
```

## Environment Variables (`.env`)
```
ANTHROPIC_API_KEY=sk-ant-...
LINKUP_API_KEY=...
JWT_SECRET_KEY=...
ELEVENLABS_API_KEY=...             # Not yet used
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAID_API_KEY=...
```

---

## What's Built (All Implemented)

### Auth (`backend/auth.py`)
- JWT-based authentication: register, login, token refresh, verification
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`
- Password hashing via bcrypt, tokens via python-jose
- `get_current_user` FastAPI dependency for protected routes

### Product CRUD
- `POST /api/products` — bulk import
- `GET /api/products`, `GET /api/products/{id}`, `PUT /api/products/{id}`, `DELETE /api/products/{id}`

### ICP Discovery (`backend/discovery/`)
- Claude Sonnet tool-use agent: derives ICPs from products → generates search queries → LinkUp search → creates leads
- Auto-triggers enrichment after discovery
- `POST /api/discovery/run`
- WebSocket: `discovery_start`, `discovery_thinking`, `company_discovered`, `discovery_complete`

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

### Billing (`backend/billing.py`)
- Stripe checkout sessions for tier subscriptions + PAYG credit packs
- Paid.ai usage signal emission for metering
- Credit system: 100 free SC on signup, deduct per action
- Credit costs: Enrichment=5, Matching=2, Pitch Deck=10, Email=1, Voice=3
- Stripe webhook: `checkout.session.completed`, `invoice.paid` → adds credits
- UsageEvent audit trail
- `GET /api/billing/credits`, `POST /api/billing/subscribe`, `POST /api/billing/buy-credits`
- `POST /api/billing/webhook`, `GET /api/billing/usage`

### WebSocket (`ws://localhost:8000/ws/updates`)
- Live cell updates during enrichment
- Discovery agent thinking steps
- Matching updates
- Conversion prediction updates

---

## API Endpoints (All Implemented)

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

---

## Remaining Work

### Voice Briefing (ElevenLabs)
- [ ] `backend/actions/voice_summary.py` — ElevenLabs TTS voice briefing
- [ ] `POST /api/leads/{id}/voice` endpoint
- [ ] Voice prompt in `prompts/voice_prompt.py`

### Polish
- [ ] Pre-cache enrichment + matches for 5 demo companies
- [ ] Error handling: graceful API failure responses
- [ ] Rate limiting on enrichment (don't burn LinkUp credits)
