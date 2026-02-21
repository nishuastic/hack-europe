# Frontend + Pitch Deck Tracker

## Stack
- **Next.js 14** with App Router (TypeScript)
- **bun** (package manager + runtime)
- **AG Grid Community** (spreadsheet UI)
- **Tailwind CSS** (styling)
- **WebSocket** (real-time cell + match updates)

## Setup
```bash
cd frontend
bun install
bun dev  # runs on localhost:3000
```

---

## What's Built

### Components (Implemented)
- `app/page.tsx` — main router: switches between views (dashboard, onboard, lead detail, etc.)
- `app/layout.tsx` — app shell, dark theme
- `components/Dashboard.tsx` — AG Grid spreadsheet with live WebSocket updates
- `components/LeadDetail.tsx` — lead detail view (enrichment data + matches)
- `components/PitchDeckEditor.tsx` — slide viewer
- `components/Products.tsx` — product catalog manager
- `components/ProductEdit.tsx` — product editor form
- `components/AuthPage.tsx` — login/register screens
- `components/AuthContext.tsx` — auth state management
- `components/Header.tsx` — top bar with user info
- `components/Sidebar.tsx` — left nav view switcher
- `lib/api.ts` — API client + WebSocket connection
- `lib/types.ts` — TypeScript interfaces

### WebSocket Messages Handled
```typescript
msg.type === 'discovery_start'       // Show "discovering..." state
msg.type === 'discovery_thinking'    // Show agent reasoning
msg.type === 'company_discovered'    // Add row to grid
msg.type === 'discovery_complete'    // Done

msg.type === 'enrichment_start'      // Show loading state for lead
msg.type === 'agent_thinking'        // Show pipeline reasoning
msg.type === 'cell_update'           // Update specific cell: {lead_id, field, value}
msg.type === 'enrichment_complete'   // Remove loading state

msg.type === 'matching_start'        // Show "matching..." state
msg.type === 'match_update'          // Update match columns
msg.type === 'matching_complete'     // Done

msg.type === 'prediction_update'     // Update conversion column
```

---

## Remaining Work

### High Priority (Demo-Critical)

#### 1. Analytics Dashboard (€7k Data Prize)
- [ ] `bun add recharts`
- [ ] `components/AnalyticsDashboard.tsx` — 5 charts from `GET /api/analytics`:
  - Industry breakdown (pie chart)
  - Score distribution histogram (bar chart)
  - Buying signals frequency (bar chart)
  - Avg score by product (bar chart)
  - Top 5 opportunities (leaderboard table)
- [ ] Add "Analytics" tab in sidebar/main view

#### 2. Action Panel (Demo Flow)
- [ ] `components/ActionPanel.tsx` — slide-in panel when row clicked:
  - Company summary at top
  - Best-matched product with score + reasoning
  - Product selector dropdown (if multiple matches)
  - Buttons: [Generate Pitch Deck] [Draft Email] [Voice Briefing]
- [ ] Wire pitch deck generation + PPTX download
- [ ] Wire email generation + copy to clipboard

#### 3. Agent Thinking Display (€1k Agentic Prize)
- [ ] `components/AgentThinking.tsx` — visual display of agent reasoning steps
- [ ] Stream from WebSocket `agent_thinking` + `discovery_thinking` messages
- [ ] Show iterative decision-making (key for judges)

### Medium Priority

#### 4. Billing UI (€3k Stripe Prize)
- [ ] Credits display in header
- [ ] Stripe checkout flow (redirect + return)
- [ ] Usage history view

#### 5. Frontend Polish
- [ ] Auth token persistence (localStorage)
- [ ] Loading skeletons for cells
- [ ] Smooth animations (slide panel, cell population)
- [ ] "Powered by" footer: Claude, LinkUp, Stripe, ElevenLabs logos

---

## AG Grid Columns
```typescript
const columnDefs = [
  { field: 'company_name', headerName: 'Company', pinned: 'left' },
  { field: 'description', headerName: 'Description', wrapText: true },
  { field: 'funding', headerName: 'Last Funding' },
  { field: 'industry', headerName: 'Industry' },
  { field: 'revenue', headerName: 'Revenue' },
  { field: 'employees', headerName: 'Employees' },
  { field: 'contacts', headerName: 'Key Contacts' },
  { field: 'customers', headerName: 'Customers' },
  { field: 'buying_signals', headerName: 'Signals' },
  { field: 'best_match_product', headerName: 'Best Match' },
  { field: 'best_match_score', headerName: 'Score', sort: 'desc' },
  { field: 'conversion_likelihood', headerName: 'Conversion' },
  { field: 'actions', headerName: 'Actions', pinned: 'right' },
];
```

## Design Guidelines
- **Theme:** Dark background (#0f172a), blue accents (#3b82f6), green for high scores (#22c55e)
- **Font:** Inter or system-ui
- **Spreadsheet:** `ag-theme-alpine-dark`
- **Key principle:** This should look like a product, not a hackathon project

## Demo Script (2 minutes)
```
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
```
