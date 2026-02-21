# Stick — CLAUDE.md

## What is this project?
An AI sales agent that takes a product catalog and target companies, enriches companies with deep web research, uses AI to match the best product(s) to each company, and generates personalized pitch decks per match. Built for HackEurope hackathon (24h).

**One-liner:** "Paste companies + products, get matched pitch decks. An AI SDR that researches, matches, and pitches — automatically."

## Stack
- **Backend:** Python 3.12 + FastAPI, managed by `uv`
- **Frontend:** Next.js + TypeScript + AG Grid, managed by `bun`
- **DB:** SQLite via SQLModel
- **Realtime:** WebSocket (cells update live as enrichment streams in)
- **AI:** Claude (reasoning/generation), ElevenLabs (voice briefings)
- **Search:** LinkUp SDK
- **Billing:** Stripe

## Team & Ownership

### Person A — Backend Engineer
**Owns:** `backend/` (all of it)
**Tracker:** `docs/backend-tracker.md`
**Summary:** FastAPI app, all API endpoints, WebSocket, database, enrichment pipeline, agent orchestrator, Stripe integration.

### Person B — Prompt Engineer / Data Quality
**Owns:** `prompts/`
**Tracker:** `docs/linkup-prompts-tracker.md`
**Summary:** LinkUp query optimization, Claude prompt engineering, pitch deck prompt design, quality testing across 20+ companies. Delivers tested prompts that Person A imports.

### Person C + D — Frontend + Pitch Deck + Design + Demo
**Owns:** `frontend/`, `templates/`
**Tracker:** `docs/frontend-pitch-tracker.md`
**Summary:** Next.js app, AG Grid spreadsheet, ActionPanel, PitchDeckViewer, HTML slide template, demo script, judge pitch prep.

## Key Files
- `docs/architecture.md` — System architecture, API contract, data flow, directory structure
- `docs/backend-tracker.md` — Person A's detailed phase-by-phase guide
- `docs/linkup-prompts-tracker.md` — Person B's prompt engineering guide
- `docs/frontend-pitch-tracker.md` — Person C+D's frontend + demo guide
- `backend/models.py` — Shared data models (Lead, PitchDeck, Contact, etc.)

## Conventions
- Backend runs on `localhost:8000`, frontend on `localhost:3000`
- All API routes prefixed with `/api/`
- WebSocket at `ws://localhost:8000/ws/updates`
- Environment variables in `.env` (never committed)
- Person B's prompts live in `prompts/` — Person A imports them, never duplicates them
- AG Grid theme: `ag-theme-alpine-dark`
- **After every backend change, run all three:**
  - `uv run ruff check backend/` (linter) + `uv run ruff check backend/ --fix` (auto-fix)
  - `uv run mypy backend/` (type checker)
  - `uv run pytest backend/tests/ -v` (unit tests)
  - All must pass clean before committing. Config in `pyproject.toml`.

## Phases
1. **Hours 0-8:** Core MVP — paste companies, see enriched spreadsheet fill live
2. **Hours 8-14:** Pitch deck generation + email drafts + agentic orchestrator
3. **Hours 14-20:** Prize integrations (Stripe, agent reasoning UI)
4. **Hours 20-24:** Demo polish, pre-caching, dry runs

## Target Prizes
| Prize | Value | How |
|-------|-------|-----|
| Agentic AI Track | €1,000 | Agent autonomously researches, matches, generates |
| Best Use of Data | €7,000 | Raw web data → structured insights + buying signals + product matching + conversion prediction + analytics dashboard + pitch decks |
| Best Use of Claude | $10,000 credits | Core reasoning: extraction, matching, deck gen, tool-use |
| Best Stripe Integration | €3,000 | Usage-based billing, pay-per-enrichment |
| Autonomous Consulting Agent | Team lunch | Agent behaves like senior SDR consultant |
| Best Use of ElevenLabs | AirPods | Voice call-prep briefing per lead |

## Demo (2 minutes, science-fair format)
0:00 — "Finding clients costs $50k/year per SDR. Matching the RIGHT product to the RIGHT client? Even harder."
0:10 — Add 3 products to catalog (pre-filled for speed)
0:20 — Paste 5 companies → watch enrichment columns fill live
0:45 — Watch "Best Match" column populate as AI matches products to companies
1:00 — Click top lead → see matched product + score + reasoning
1:10 — Generate 7-slide pitch deck for that product-company pair
1:30 — Download PPTX + show drafted email
1:40 — Play voice briefing
1:50 — Show Stripe credits
2:00 — "Stick: your AI sales team. Multiple products, perfect matches, personalized pitches."
