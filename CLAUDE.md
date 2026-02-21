# Stick — CLAUDE.md

## What is this project?
An AI sales agent that takes a product catalog, autonomously discovers target companies via ICP-based search, enriches them with deep web research, matches the best product(s) to each company, and generates personalized pitch decks + outreach emails per match. Built for HackEurope hackathon (24h).

**One-liner:** "Add products, discover or paste companies, get matched pitch decks. An AI SDR that discovers, researches, matches, and pitches — automatically."

## Stack
- **Backend:** Python 3.12 + FastAPI, managed by `uv`
- **Frontend:** Next.js + TypeScript + AG Grid, managed by `bun`
- **DB:** SQLite via SQLModel
- **Realtime:** WebSocket (cells update live as enrichment streams in)
- **AI:** Claude (reasoning/generation)
- **Search:** LinkUp SDK
- **Billing:** Stripe

## Key Files
- `docs/architecture.md` — System architecture, API contract, data flow
- `docs/backend-tracker.md` — Backend status and remaining work
- `docs/linkup-prompts-tracker.md` — Prompt engineering guide
- `docs/frontend-pitch-tracker.md` — Frontend + demo guide
- `backend/models.py` — Shared data models (Lead, Product, ProductMatch, PitchDeck, etc.)

## Conventions
- Backend runs on `localhost:8000`, frontend on `localhost:3000`
- All API routes prefixed with `/api/`
- WebSocket at `ws://localhost:8000/ws/updates`
- Environment variables in `.env` (never committed)
- Prompts live in `prompts/` — backend imports them with inline fallbacks
- AG Grid theme: `ag-theme-alpine-dark`
- **After every backend change, run all three:**
  - `uv run ruff check backend/` (linter) + `uv run ruff check backend/ --fix` (auto-fix)
  - `uv run mypy backend/` (type checker)
  - `uv run pytest backend/tests/ -v` (unit tests)
  - All must pass clean before committing. Config in `pyproject.toml`.

## Target Prizes
| Prize | Value | How |
|-------|-------|-----|
| Agentic AI Track | €1,000 | ICP discovery agent autonomously finds companies via Claude tool-use loop |
| Best Use of Data | €7,000 | Raw web data → structured insights + buying signals + product matching + analytics + pitch decks |
| Best Use of Claude | $10,000 credits | Core reasoning: query planning, extraction, ICP discovery, matching, deck gen |
| Best Stripe Integration | €3,000 | Usage-based billing, pay-per-enrichment |
| Autonomous Consulting Agent | Team lunch | Discovery agent behaves like senior SDR consultant |

## Demo (2 minutes, science-fair format)
0:00 — "Finding clients costs $50k/year per SDR. Matching the RIGHT product to the RIGHT client? Even harder."
0:10 — Add 3 products to catalog (pre-filled for speed)
0:20 — Paste 5 companies → watch enrichment columns fill live
0:45 — Watch "Best Match" column populate as AI matches products to companies
1:00 — Click top lead → see matched product + score + reasoning
1:10 — Generate 7-slide pitch deck for that product-company pair
1:30 — Download PPTX + show drafted email
1:40 — Show Stripe credits
2:00 — "Stick: your AI sales team. Multiple products, perfect matches, personalized pitches."
