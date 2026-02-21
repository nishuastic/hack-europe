# SalesForge — CLAUDE.md

## What is this project?
An AI sales agent that finds ideal client companies, enriches them with deep web research, and generates personalized pitch decks so you can call them. Built for HackEurope hackathon (24h).

**One-liner:** "Paste companies, get pitch decks. An AI SDR that researches, scores, and pitches — automatically."

## Stack
- **Backend:** Python 3.12 + FastAPI, managed by `uv`
- **Frontend:** Next.js + TypeScript + AG Grid, managed by `bun`
- **DB:** SQLite via SQLModel
- **Realtime:** WebSocket (cells update live as enrichment streams in)
- **AI:** Claude (reasoning/generation), Gemini (multimodal), ElevenLabs (voice)
- **Search:** LinkUp SDK
- **Billing:** Stripe

## Team & Ownership

### Person A — Backend Engineer
**Owns:** `backend/` (all of it)
**Tracker:** `docs/backend-tracker.md`
**Summary:** FastAPI app, all API endpoints, WebSocket, database, enrichment pipeline, agent orchestrator, Stripe/ElevenLabs/Gemini integrations.

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

## Phases
1. **Hours 0-8:** Core MVP — paste companies, see enriched spreadsheet fill live
2. **Hours 8-14:** Pitch deck generation + email drafts + agentic orchestrator
3. **Hours 14-20:** Prize integrations (Stripe, ElevenLabs, Gemini, agent reasoning UI)
4. **Hours 20-24:** Demo polish, pre-caching, dry runs

## Target Prizes
| Prize | Value | How |
|-------|-------|-----|
| Agentic AI Track | €1,000 | Agent autonomously researches + acts |
| Best Use of Data | €7,000 | Raw web data → structured insights + pitch decks |
| Best Use of Claude | $10,000 credits | Core reasoning: extraction, scoring, deck gen, tool-use |
| Best Stripe Integration | €3,000 | Usage-based billing, pay-per-enrichment |
| Autonomous Consulting Agent | Team lunch | Agent behaves like senior SDR consultant |
| Adaptable Agent | Gift bags | Re-evaluates when new info contradicts initial analysis |
| Best Use of ElevenLabs | AirPods | Voice call-prep briefing per lead |
| Best Use of Gemini | €50,000 credits | Website screenshot → multimodal brand analysis |

## Demo (2 minutes, science-fair format)
0:00 — "Finding clients costs $50k/year per SDR."
0:10 — Describe product in text box
0:20 — Paste 5 companies → watch columns fill live
0:45 — Click top lead → Generate 7-slide pitch deck
1:15 — Download PPTX + show drafted email
1:30 — Play voice briefing
1:45 — Show Stripe credits
2:00 — "SalesForge: your AI sales team."
