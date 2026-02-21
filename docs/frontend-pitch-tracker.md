# Frontend + Pitch Deck Tracker — Person C + D

## Your Stack
- **Next.js 15** with App Router (TypeScript)
- **bun** (package manager + runtime)
- **AG Grid Community** (spreadsheet UI)
- **Tailwind CSS** (styling)
- **WebSocket** (real-time cell + match updates)

## Setup
```bash
cd /path/to/hack-europe
bunx create-next-app@latest frontend --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd frontend
bun add ag-grid-community ag-grid-react
bun dev  # runs on localhost:3000
```

## Backend API (Person A will serve on localhost:8000)
See full API contract in `docs/architecture.md`. Key endpoints:

```
POST   /api/products              → bulk import product catalog
GET    /api/products              → list all products
POST   /api/leads/import          → {"companies": ["Stripe", "Plaid"]}
GET    /api/leads                 → list all leads with enrichment data + matched products
POST   /api/matches/generate      → trigger AI matching after enrichment
GET    /api/matches               → list all product-lead matches with scores
POST   /api/leads/{id}/pitch-deck?product_id=X  → generate pitch deck for product-lead pair
GET    /api/leads/{id}/pitch-deck/download       → download PPTX
POST   /api/leads/{id}/email?product_id=X        → generate email for product-lead pair
POST   /api/leads/{id}/voice      → generate voice briefing (Phase 3)
WS     ws://localhost:8000/ws/updates → real-time cell + match updates
```

---

## Phase 1 — Spreadsheet UI + Product Catalog (Hours 0-8)

### Person C — Core Components
- [ ] `app/page.tsx` — main page layout (header, product catalog area, import area, spreadsheet)
- [ ] `app/layout.tsx` — app shell with dark/light theme base
- [ ] `components/SpreadsheetGrid.tsx` — AG Grid component
- [ ] `components/LeadImport.tsx` — CSV paste textarea + submit
- [ ] `components/ProductCatalog.tsx` — Multi-product input form: add/edit/remove products, each with name + description + optional fields (features, industry_focus, pricing_model, etc.)
- [ ] `lib/api.ts` — API client (fetch wrapper + WebSocket connection)

### Person D — Design + Data
- [ ] Prepare 20-company test dataset (CSV: one company name per line)
- [ ] Prepare 3-5 sample products for testing (different industries/sizes)
- [ ] Design color scheme + branding (suggest: dark theme, blue/green accents)
- [ ] Write demo script v1
- [ ] Test UI flows as Person C builds them

### AG Grid Column Configuration
```typescript
// components/SpreadsheetGrid.tsx
const columnDefs = [
  { field: 'company_name', headerName: 'Company', width: 150, pinned: 'left' },
  { field: 'url', headerName: 'URL', width: 180, cellRenderer: 'linkRenderer' },
  { field: 'description', headerName: 'Description', width: 300, wrapText: true },
  { field: 'funding', headerName: 'Last Funding', width: 180 },
  { field: 'industry', headerName: 'Industry', width: 120 },
  { field: 'revenue', headerName: 'Revenue', width: 120 },
  { field: 'employees', headerName: 'Employees', width: 100 },
  { field: 'contacts', headerName: 'Key Contacts', width: 200, cellRenderer: 'contactsRenderer' },
  { field: 'customers', headerName: 'Customers', width: 200, cellRenderer: 'tagsRenderer' },
  { field: 'best_match_product', headerName: 'Best Match', width: 150, cellRenderer: 'matchRenderer' },
  { field: 'best_match_score', headerName: 'Match Score', width: 100, cellRenderer: 'scoreRenderer',
    sort: 'desc' },
  { field: 'actions', headerName: 'Actions', width: 150, cellRenderer: 'actionsRenderer',
    pinned: 'right' },
];
```

### WebSocket Integration
```typescript
// lib/api.ts
const ws = new WebSocket('ws://localhost:8000/ws/updates');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'cell_update') {
    // Update the specific cell in AG Grid
    const rowNode = gridApi.getRowNode(msg.lead_id);
    rowNode?.setDataValue(msg.field, msg.value);
  }
  if (msg.type === 'match_update') {
    // Update match columns for this lead
    const rowNode = gridApi.getRowNode(msg.lead_id);
    rowNode?.setDataValue('best_match_product', msg.product_name);
    rowNode?.setDataValue('best_match_score', msg.match_score);
  }
};
```

### Cell Renderers to Build
- **linkRenderer**: clickable URL
- **contactsRenderer**: show "Jane Doe (CEO)" with LinkedIn icon link
- **tagsRenderer**: pill/badge list for customers
- **scoreRenderer**: colored bar (red 1-3, yellow 4-6, green 7-10)
- **matchRenderer**: show matched product name with score badge
- **actionsRenderer**: "Pitch Deck" + "Email" buttons per row
- **loadingRenderer**: spinner while enrichment is in progress for that cell

### Deliverable by Hour 8
- Add products to catalog → see them listed
- Paste companies → see them in AG Grid
- Watch cells fill in real-time via WebSocket (loading spinner → data)
- After enrichment, trigger matching → watch "Best Match" and "Match Score" columns fill
- Sortable by match score
- Looks professional (not a prototype)

---

## Phase 2 — Pitch Deck + Actions (Hours 8-14)

### Person C — Action Panel + Deck Viewer + Analytics
- [ ] `components/ActionPanel.tsx` — slide-in panel from right when row clicked; shows matched product info
- [ ] `components/PitchDeckViewer.tsx` — renders HTML slides, prev/next nav, fullscreen
- [ ] `components/EmailPreview.tsx` — shows generated email, copy button
- [ ] `components/AnalyticsDashboard.tsx` — aggregate data insights (see below)

### Person D — Pitch Deck HTML Template + Design
- [ ] Design the slide template (16:9 aspect ratio, clean typography)
- [ ] `templates/pitch_deck.html` — Jinja2 template (Person A renders server-side, but D designs it)
- [ ] Color scheme for slides (match app branding)
- [ ] Help C with ActionPanel layout

### ActionPanel Behavior
```
User clicks row in grid
  → ActionPanel slides in from right (60% width)
  → Shows company summary at top
  → Shows best-matched product with score + reasoning
  → Option to select different product from matches dropdown
  → Three action buttons:
    [Generate Pitch Deck]  [Draft Email]  [Voice Briefing]
  → Clicking "Generate Pitch Deck":
    - Uses the selected/best-matched product_id
    - Shows loading animation
    - POST /api/leads/{id}/pitch-deck?product_id=X
    - Renders returned slides in PitchDeckViewer
    - "Download PPTX" button appears
  → Clicking "Draft Email":
    - POST /api/leads/{id}/email?product_id=X
    - Shows email in EmailPreview with subject line + body
    - "Copy to Clipboard" button
```

### PitchDeckViewer Component
```
┌─────────────────────────────────────────────┐
│  ◀  Slide 3 of 7  ▶          [Fullscreen]  │
│─────────────────────────────────────────────│
│  Pitching: SalesForge Pro → Stripe          │
│─────────────────────────────────────────────│
│                                             │
│     Why Stripe Needs SalesForge Pro         │
│                                             │
│     • Payment processing at scale           │
│       creates complex sales cycles          │
│     • 75% of SDR time spent on              │
│       research, not selling                 │
│     • Our AI reduces research               │
│       time by 90%                           │
│                                             │
│─────────────────────────────────────────────│
│  Speaker Notes: "Open with their scale..."  │
│─────────────────────────────────────────────│
│           [Download PPTX]                   │
└─────────────────────────────────────────────┘
```

### New AG Grid Columns (Data Prize)
Add to `SpreadsheetGrid.tsx` column defs:
```typescript
{ field: 'buying_signals', headerName: 'Signals', width: 200, cellRenderer: 'signalsRenderer' },
  // Colored chips: green=strong, yellow=moderate, gray=weak
{ field: 'conversion_likelihood', headerName: 'Conversion', width: 120, cellRenderer: 'conversionRenderer' },
  // Badge: green "High" / yellow "Medium" / red "Low"
```

### AnalyticsDashboard Component (Data Prize)
**Dependency:** `bun add recharts` (lightweight React chart lib)

**Endpoint:** `GET /api/analytics` — returns aggregate data after enrichment + matching.

**Layout:**
```
┌─ Analytics Dashboard ──────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Industry     │  │ Score Dist.  │  │ Buying Signals   │ │
│  │ Breakdown    │  │ Histogram    │  │ Frequency        │ │
│  │ (pie chart)  │  │ (bar chart)  │  │ (bar chart)      │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
│  ┌──────────────────────┐  ┌───────────────────────────┐  │
│  │ Avg Score by Product │  │ Top 5 Opportunities       │  │
│  │ (bar chart)          │  │ (leaderboard table)       │  │
│  └──────────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

Add an "Analytics" tab in the main page (next to spreadsheet view). Switch to it after enrichment + matching completes.

### WebSocket: Prediction Updates
Handle new message type in `lib/api.ts`:
```typescript
if (msg.type === 'prediction_update') {
  const rowNode = gridApi.getRowNode(msg.lead_id);
  rowNode?.setDataValue('conversion_likelihood', msg.conversion_likelihood);
}
```

### Deliverable by Hour 14
- Click any enriched lead → see matched product + 7-slide personalized pitch deck
- Switch product in ActionPanel → regenerate deck for different product
- Download as PPTX
- Email draft ready to copy
- Smooth transitions, professional feel

---

## Phase 3 — Prize Features (Hours 14-20)

### Person C
- [ ] `components/AgentThinking.tsx` — shows agent reasoning steps (stream from WS)
- [ ] Audio player in ActionPanel for ElevenLabs voice briefings
- [ ] Stripe credits display in header bar
- [ ] Stripe checkout integration (redirect to Stripe, handle return)

### Person D
- [ ] Set up Stripe test account + products/prices
- [ ] Test full billing flow
- [ ] Update demo script for all features
- [ ] Prepare judge Q&A talking points per prize

### Agent Thinking Panel (important for Agentic AI prize)
```
┌─ Agent Reasoning ──────────────────────────┐
│ 🔍 Searching for Stripe company info...    │
│ ✅ Found: B2B payments, $95B valuation     │
│ 🔍 Looking up key contacts...              │
│ ✅ Found CEO, CTO, VP Sales                │
│ 🔍 Matching products to Stripe...          │
│ ✅ Best match: SalesForge Pro (9/10)       │
│    "Strong alignment: B2B sales at scale"  │
│ 🔄 New info: Stripe just acquired X        │
│    → Re-evaluating product match...        │
│ ✅ Updated: still SalesForge Pro, adjusted │
│    pitch angle to reference M&A            │
│ 📊 Generating pitch deck...               │
│ ✅ 7 slides ready                          │
└────────────────────────────────────────────┘
```
This is key for "Adaptable Agent" prize — visibly shows the agent changing its mind.

---

## Phase 4 — Demo Polish (Hours 20-24)

### Person C
- [ ] Dark mode (toggle or default dark)
- [ ] Loading skeletons for cells (not just spinners)
- [ ] Smooth animations (slide panel, cell population)
- [ ] "Powered by" footer: Claude, LinkUp, Stripe, ElevenLabs logos
- [ ] Responsive (just don't break on smaller screens)

### Person D
- [ ] Final demo script timed to 2:00 exactly
- [ ] 5 full dry runs, fix any hiccups
- [ ] Prepare 30-second elevator pitch
- [ ] Q&A prep doc: anticipated judge questions + answers
- [ ] Backup: screen recording of perfect demo run
- [ ] The meta-pitch: our app generates pitch decks, and we'll USE a generated deck in our pitch

---

## Demo Script (2 minutes, updated for multi-product matching)
```
0:00 — "Finding clients costs $50k/year per SDR. And matching the RIGHT product to the RIGHT client? That's even harder."
0:10 — Add 3 products to catalog (pre-filled for speed)
0:20 — Paste 5 companies → watch enrichment columns fill live
0:45 — Watch "Best Match" column populate as AI matches products to companies
1:00 — Click top lead → see matched product + score + reasoning
1:10 — Generate 7-slide pitch deck for that product-company pair
1:30 — Download PPTX + show drafted email
1:40 — Play voice briefing
1:50 — Show Stripe credits
2:00 — "SalesForge: your AI sales team. Multiple products, perfect matches, personalized pitches."
```

---

## Design Guidelines
- **Theme:** Dark background (#0f172a), blue accents (#3b82f6), green for high scores (#22c55e)
- **Font:** Inter or system-ui (clean, modern)
- **Spreadsheet:** AG Grid's `ag-theme-alpine-dark`
- **Slides:** White background, dark text, accent color for highlights
- **Key principle:** This should look like a product, not a hackathon project
