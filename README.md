# Stick

An AI sales agent that takes your product catalog and target companies, enriches them with deep web research, matches the best product to each company, and generates personalized pitch decks — automatically.

**Paste companies + products, get matched pitch decks. An AI SDR that researches, matches, and pitches.**

Built at HackEurope 2026 (24h hackathon).

## How It Works

```
Company Name
    ↓
[Query Planner] ← Claude generates tailored search queries
    ↓
[Search Executor] ← LinkUp runs queries in parallel
    ↓
[Data Extractor] ← Claude extracts structured data + identifies gaps
    ↓
[Orchestrator] ← If important fields are missing, loops back (max 2 rounds)
    ↓
Enriched Lead → Product Matching → Pitch Deck
```

1. Add your products to the catalog
2. Paste a list of target companies
3. Watch the spreadsheet fill in live as the multi-agent pipeline enriches each company
4. AI matches the best product to each company with a score + reasoning
5. Generate a personalized pitch deck + outreach email for any match

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 + FastAPI |
| Frontend | Next.js + TypeScript + AG Grid |
| Database | SQLite via SQLModel |
| Realtime | WebSocket (live cell updates) |
| AI | Claude (reasoning/extraction/generation) |
| Search | LinkUp SDK (web research) |
| Voice | ElevenLabs (call-prep briefings) |
| Billing | Stripe (usage-based) |

## Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** — Python package manager
- **[Bun](https://bun.sh/)** — JS runtime (for frontend)
- API keys for: Anthropic (Claude), LinkUp

## Quick Start

### 1. Clone and set up environment

```bash
git clone <repo-url>
cd hack-europe
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Backend

```bash
# Install dependencies (uv handles the venv automatically)
uv sync

# Run the server
uv run uvicorn backend.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`. Open `http://localhost:8000/docs` for the interactive Swagger UI.

### 3. Frontend

```bash
cd frontend
bun install
bun dev
```

Opens at `http://localhost:3000`.

## API Quickstart

Once the backend is running, try these:

```bash
# Add a product
curl -X POST http://localhost:8000/api/products \
  -H "Content-Type: application/json" \
  -d '{"products": [{"name": "My SaaS", "description": "CRM for startups"}]}'

# Import companies (enrichment starts automatically)
curl -X POST http://localhost:8000/api/leads/import \
  -H "Content-Type: application/json" \
  -d '{"companies": ["Stripe", "Plaid", "Revolut"]}'

# Check enrichment results
curl http://localhost:8000/api/leads

# Re-trigger enrichment for a single lead
curl -X POST http://localhost:8000/api/leads/1/enrich

# Watch live updates via WebSocket
# (use websocat, Postman, or the frontend)
# ws://localhost:8000/ws/updates
```

## Development

### Lint, type-check, and test

```bash
uv run ruff check backend/                # Lint
uv run ruff check backend/ --fix          # Auto-fix
uv run mypy backend/                      # Type check
uv run pytest backend/tests/ -v           # Unit tests (69 tests)
```

All three must pass before committing.

### Project Structure

```
hack-europe/
├── backend/
│   ├── main.py                 # FastAPI app, all routes, WebSocket
│   ├── billing.py              # Paid.ai + Stripe billing, credit gating
│   ├── config.py               # Settings from .env (pydantic-settings)
│   ├── models.py               # SQLModel schemas (Lead, Product, etc.)
│   ├── db.py                   # Async SQLite engine + sessions
│   ├── enrichment/
│   │   ├── linkup_search.py    # LinkUp client singleton
│   │   ├── pipeline.py         # Multi-agent orchestrator (iterative follow-up)
│   │   └── agents/
│   │       ├── query_planner.py    # Agent 1: Claude generates search queries
│   │       ├── search_executor.py  # Agent 2: LinkUp parallel search
│   │       └── data_extractor.py   # Agent 3: Claude extracts structured data
│   └── tests/
│       ├── conftest.py             # Test fixtures (in-memory DB, async client)
│       ├── test_products.py        # Product CRUD tests
│       ├── test_leads.py           # Lead import/list tests
│       ├── test_enrichment.py      # JSON parsing + extraction model tests
│       ├── test_query_planner.py   # Query planner agent tests
│       ├── test_search_executor.py # Search executor agent tests
│       └── test_pipeline.py        # Multi-round pipeline tests
├── prompts/                    # Prompt engineering (Person B)
├── frontend/                   # Next.js app (Person C+D)
├── docs/
│   ├── architecture.md         # System architecture + Mermaid diagrams
│   ├── backend-tracker.md      # Person A progress
│   ├── linkup-prompts-tracker.md  # Person B prompt specs
│   └── frontend-pitch-tracker.md  # Person C+D progress
├── pyproject.toml
└── .env.example
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI extraction + generation |
| `LINKUP_API_KEY` | Yes | LinkUp API key for web research |
| `ELEVENLABS_API_KEY` | Later | ElevenLabs key for voice briefings |
| `STRIPE_API_KEY` | Yes | Stripe secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes* | Stripe webhook signing secret (`whsec_...`) — see below |
| `PAID_API_KEY` | Yes | Paid.ai API key for usage tracking + invoicing |

\* Only required if processing credit purchases.

## Billing Setup (Stripe + Paid.ai)

Stick uses **Stick Credits (SC)** as its internal currency. Users get 100 free SC on signup and can buy more via Stripe (subscriptions or one-time packs). Usage is tracked via Paid.ai.

### Credit costs per action

| Action | Cost |
|--------|------|
| Enrich Lead | 5 SC |
| Matching | 2 SC |
| Pitch Deck | 10 SC |
| Email | 1 SC |
| Voice Summary | 3 SC |

### Stripe webhook (required for credit purchases)

The webhook endpoint at `/api/billing/webhook` listens for `checkout.session.completed` and `invoice.paid` events to add credits after payment.

**Local development — use the Stripe CLI:**

```bash
# Install (macOS)
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:8000/api/billing/webhook
```

This prints a signing secret like `whsec_abc123...`. Add it to your `.env`:

```
STRIPE_WEBHOOK_SECRET=whsec_abc123...
```

> Note: The secret changes every time you restart `stripe listen`. Update `.env` accordingly.

**Production — use the Stripe Dashboard:**

1. Go to **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. Set URL to `https://yourdomain.com/api/billing/webhook`
3. Select events: `checkout.session.completed`, `invoice.paid`
4. Copy the signing secret into your env vars

### Billing API routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/billing/credits` | Get balance, costs, available plans + packs |
| `POST` | `/api/billing/subscribe` | Subscribe to a tier (`{"tier": "starter"}`) |
| `POST` | `/api/billing/buy-credits` | Buy a PAYG pack (`{"pack": "500"}`) |
| `POST` | `/api/billing/webhook` | Stripe webhook handler |
| `GET` | `/api/billing/usage` | Usage history for current user |

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for detailed diagrams including:
- Multi-agent enrichment pipeline (3 agents + follow-up loop)
- Full system flowchart
- Agent orchestrator design
- API contract

## License

Hackathon project — HackEurope 2026.
