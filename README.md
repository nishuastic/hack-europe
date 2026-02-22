# Stick

An AI sales agent that takes your product catalog, discovers target companies, enriches them with deep web research, matches the best product to each company, and generates personalized pitch decks + outreach emails — automatically.

> Built at HackEurope 2026 (24h hackathon).

See [`docs/architecture.md`](docs/architecture.md) for system design, flow diagrams, and API reference.

---

## Prerequisites

- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** — Python package manager
- **[Bun](https://bun.sh/)** — JavaScript runtime
- API keys: Anthropic (Claude), LinkUp, Stripe

---

## Setup

```bash
git clone <repo-url>
cd hack-europe
cp .env.example .env
# Fill in your API keys
```

`.env` variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `LINKUP_API_KEY` | Yes | LinkUp web research |
| `STRIPE_SECRET_KEY` | Yes | Stripe billing |
| `JWT_SECRET_KEY` | Yes | Auth token signing |

---

## Running

### Backend

```bash
# Install dependencies
uv sync

# Start the server (http://localhost:8000)
uv run uvicorn backend.main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
bun install
bun dev
```

Opens at `http://localhost:3000`.

---

## Managing Dependencies

### Python (uv)

```bash
# Add a package
uv add <package>

# Remove a package
uv remove <package>

# Sync after pulling changes
uv sync
```

### JavaScript (bun)

```bash
cd frontend

# Add a package
bun add <package>

# Remove a package
bun remove <package>

# Sync after pulling changes
bun install
```

---

## Tests

### Backend

```bash
# Run all tests
uv run pytest backend/tests/ -v

# Run a specific test file
uv run pytest backend/tests/test_enrichment.py -v

# Run a specific test
uv run pytest backend/tests/test_enrichment.py::test_extraction_model -v
```

### Frontend

```bash
cd frontend
bun test
```

### Prompt test harnesses

```bash
# Test full enrichment pipeline for a single company
uv run python -m prompts.test_runner "Stripe"

# Test all companies
uv run python -m prompts.test_runner --all

# Test discovery agent (live)
uv run python -m prompts.test_discovery --run --max 5
```

---

## Lint & Type Check (backend)

Run these before every commit — all must pass:

```bash
uv run ruff check backend/              # Lint
uv run ruff check backend/ --fix        # Auto-fix
uv run mypy backend/                    # Type check
uv run pytest backend/tests/ -v        # Tests
```

---

## Contributing

1. Branch off `main` — use descriptive names (`feat/pitch-deck-download`, `fix/ws-reconnect`)
2. Make your changes
3. Pass lint + type check + tests (see above)
4. Open a PR against `main`

Keep PRs small and focused. One feature or fix per PR.
