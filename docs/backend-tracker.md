# Backend Tracker — Person A

## Your Stack
- **Python 3.12** with **uv** (package manager)
- **FastAPI** + **uvicorn** (API server)
- **SQLModel** + **SQLite** (database)
- **WebSocket** (real-time updates to frontend)
- **anthropic** SDK (Claude API)
- **linkup-sdk** (web search — uses Person B's optimized queries from `prompts/`)
- **google-generativeai** (Gemini, Phase 3)
- **elevenlabs** (TTS, Phase 3)
- **stripe** (billing, Phase 3)

## Setup Commands
```bash
cd /path/to/hack-europe
uv add fastapi "uvicorn[standard]" sqlmodel linkup-sdk anthropic websockets python-multipart aiosqlite jinja2 python-pptx weasyprint
uv run uvicorn backend.main:app --reload --port 8000
```

## Environment Variables (`.env`)
```
ANTHROPIC_API_KEY=sk-ant-...
LINKUP_API_KEY=...
GOOGLE_API_KEY=...          # Phase 3
ELEVENLABS_API_KEY=...      # Phase 3
STRIPE_SECRET_KEY=sk_test_... # Phase 3
```

---

## Phase 1 — Core Enrichment (Hours 0-8)

### Files to Create
- [x] `backend/__init__.py`
- [ ] `backend/main.py` — FastAPI app, CORS (allow localhost:3000), route registration
- [ ] `backend/config.py` — `Settings` class reading from env
- [ ] `backend/models.py` — SQLModel schemas (**see `models.py` already created**)
- [ ] `backend/db.py` — SQLite engine + session dependency
- [ ] `backend/enrichment/__init__.py`
- [ ] `backend/enrichment/linkup_search.py` — wrapper around `LinkupClient`
- [ ] `backend/enrichment/claude_enricher.py` — takes raw search results, returns structured Lead fields
- [ ] `backend/enrichment/pipeline.py` — orchestrates: for each lead → LinkUp → Claude → save → WS push

### API Endpoints to Implement
```python
POST /api/product           # {"description": "We sell..."} → save to DB/memory
POST /api/leads/import      # {"companies": ["Stripe", "Plaid"]} → create leads, kick off enrichment
GET  /api/leads             # Return all leads with current enrichment data
GET  /api/leads/{id}        # Single lead detail
WS   /ws/updates            # Push cell updates as enrichment completes
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
- Claude enricher should return structured JSON matching the Lead model fields
- Store enrichment results in SQLite as they come in (partial updates OK)

---

## Phase 2 — Pitch Deck + Actions (Hours 8-14)

### Files to Create
- [ ] `backend/actions/__init__.py`
- [ ] `backend/actions/pitch_deck.py` — Claude → slide JSON → HTML (Jinja2) + PPTX (python-pptx)
- [ ] `backend/actions/email_generator.py` — Claude drafts personalized outreach
- [ ] `backend/agent/__init__.py`
- [ ] `backend/agent/orchestrator.py` — Claude tool-use loop
- [ ] `templates/pitch_deck.html` — Jinja2 template for 16:9 slides

### API Endpoints
```python
POST /api/leads/{id}/pitch-deck        # Generate deck → return HTML
GET  /api/leads/{id}/pitch-deck/download  # Return PPTX file
POST /api/leads/{id}/email              # Generate email draft
```

### Pitch Deck Flow
1. Receive request with lead_id
2. Load enriched lead data from DB
3. Load product description
4. Call Claude with pitch deck prompt (from `prompts/pitch_deck_prompt.py`)
5. Parse JSON response → 7 slides
6. Render HTML via Jinja2 template → return to frontend
7. Generate PPTX via python-pptx → store for download

### Agent Orchestrator (Claude Tool-Use)
Define tools for Claude:
- `search_web(query)` → LinkUp
- `analyze_company(lead_id)` → Claude enrichment
- `generate_pitch_deck(lead_id)` → pitch deck
- `draft_email(lead_id)` → email
- `re_evaluate(lead_id, new_info)` → adaptation (Adaptable Agent prize)

Claude plans the sequence and calls tools autonomously.

---

## Phase 3 — Prize Integrations (Hours 14-20)

### Files to Create
- [ ] `backend/enrichment/gemini_enricher.py` — screenshot website → Gemini analysis
- [ ] `backend/actions/voice_summary.py` — ElevenLabs TTS
- [ ] `backend/billing/__init__.py`
- [ ] `backend/billing/stripe_billing.py` — Checkout + metering

### Stripe Integration
- Create Stripe product + price in test mode
- `POST /api/billing/checkout` → create Checkout Session → return URL
- After payment, set credits on user
- Each enrichment/action call decrements credits
- `GET /api/billing/credits` → return remaining

### ElevenLabs Voice
- `POST /api/leads/{id}/voice` → generate 30s audio briefing
- Use Claude to write the script, ElevenLabs to speak it
- Return audio URL/blob

### Gemini Multimodal
- Use Playwright to screenshot company website
- Send to Gemini → analyze brand, product, UX, visual quality
- Add results to enrichment data

---

## Phase 4 — Polish (Hours 20-24)
- [ ] Pre-cache enrichment for 5 demo companies
- [ ] Error handling: API failures return graceful errors, don't crash
- [ ] WebSocket reconnection handling
- [ ] Rate limiting on enrichment (don't burn all LinkUp credits)
