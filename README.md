# SalesForge

An AI sales agent that takes your product catalog and target companies, enriches them with deep web research, matches the best product to each company, and generates personalized pitch decks — automatically.

**Paste companies + products, get matched pitch decks. An AI SDR that researches, matches, and pitches.**

Built at HackEurope 2026 (24h hackathon).

## How It Works

```
Products + Companies  →  Web Research (LinkUp)  →  AI Extraction (Claude)  →  Product Matching  →  Pitch Decks
```

1. Add your products to the catalog
2. Paste a list of target companies
3. Watch the spreadsheet fill in live as AI enriches each company (funding, industry, contacts, buying signals...)
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
uv run pytest backend/tests/ -v           # Unit tests (14 tests)
```

All three must pass before committing.

### Project Structure

```
hack-europe/
├── backend/
│   ├── main.py                 # FastAPI app, all routes, WebSocket
│   ├── config.py               # Settings from .env (pydantic-settings)
│   ├── models.py               # SQLModel schemas (Lead, Product, etc.)
│   ├── db.py                   # Async SQLite engine + sessions
│   ├── enrichment/
│   │   ├── linkup_search.py    # 5 parallel LinkUp searches per company
│   │   ├── claude_enricher.py  # Claude structured JSON extraction
│   │   └── pipeline.py         # Orchestrator: search → extract → save → broadcast
│   └── tests/
│       ├── conftest.py         # Test fixtures (in-memory DB, async client)
│       ├── test_products.py    # Product CRUD tests
│       ├── test_leads.py       # Lead import/list tests
│       └── test_enrichment.py  # JSON parsing tests
├── prompts/                    # Prompt engineering (Person B)
├── frontend/                   # Next.js app (Person C+D)
├── docs/
│   └── architecture.md         # System architecture + Mermaid diagrams
├── pyproject.toml
└── .env.example
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI extraction + generation |
| `LINKUP_API_KEY` | Yes | LinkUp API key for web research |
| `ELEVENLABS_API_KEY` | Phase 3 | ElevenLabs key for voice briefings |
| `STRIPE_SECRET_KEY` | Phase 3 | Stripe test key for billing |

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for detailed diagrams including:
- Phase 1 sequence diagram (what's working now)
- Full system flowchart (Phases 1-3)
- Enrichment pipeline detail
- Agent orchestrator design

## License

Hackathon project — HackEurope 2026.
