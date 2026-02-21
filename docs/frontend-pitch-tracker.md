# Frontend + Pitch Deck Tracker — Person C + D

## Stack
- **Next.js 15** with App Router (TypeScript)
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

## Backend API (localhost:8000)

See full contract in `docs/architecture.md`. Key endpoints:

```
# Auth
POST   /api/auth/register           → register user
POST   /api/auth/login              → login → JWT token
GET    /api/auth/me                 → current user (requires Bearer token)

# Products
POST   /api/products                → bulk import product catalog
GET    /api/products                → list all products

# Discovery
POST   /api/discovery/run           → ICP discovery (find companies from products)

# Leads
POST   /api/leads/import            → paste companies → enrichment starts
GET    /api/leads                   → list all leads with enrichment data
POST   /api/leads/{id}/enrich       → re-trigger enrichment

# Matching
POST   /api/matches/generate        → trigger AI matching
GET    /api/matches                  → list matches (filterable by lead_id, product_id)

# Actions
POST   /api/leads/{id}/pitch-deck?product_id=X  → generate pitch deck
GET    /api/leads/{id}/pitch-deck/download       → download PPTX
POST   /api/leads/{id}/email?product_id=X        → generate outreach email

# Analytics
GET    /api/analytics               → aggregate dashboard data

# WebSocket
WS     ws://localhost:8000/ws/updates → real-time updates
```

## WebSocket Messages to Handle

```typescript
// Discovery flow
msg.type === 'discovery_start'       // Show "discovering..." state
msg.type === 'discovery_thinking'    // Show agent reasoning
msg.type === 'company_discovered'    // Add row to grid
msg.type === 'discovery_complete'    // Done

// Enrichment flow
msg.type === 'enrichment_start'      // Show loading state for lead
msg.type === 'agent_thinking'        // Show pipeline reasoning
msg.type === 'cell_update'           // Update specific cell: {lead_id, field, value}
msg.type === 'enrichment_complete'   // Remove loading state

// Matching flow
msg.type === 'matching_start'        // Show "matching..." state
msg.type === 'match_update'          // Update match columns: {lead_id, product_id, match_score}
msg.type === 'matching_complete'     // Done

// Predictions
msg.type === 'prediction_update'     // Update conversion column
```

---

## Components to Build

### Phase 1 — Spreadsheet + Product Catalog
- [ ] `app/page.tsx` — main layout (header, product catalog, import area, spreadsheet)
- [ ] `app/layout.tsx` — app shell, dark theme
- [ ] `components/SpreadsheetGrid.tsx` — AG Grid with enrichment + match columns
- [ ] `components/LeadImport.tsx` — CSV paste textarea + submit
- [ ] `components/ProductCatalog.tsx` — Multi-product input form
- [ ] `lib/api.ts` — API client + WebSocket connection

### Phase 2 — Actions + Deck Viewer + Analytics
- [ ] `components/ActionPanel.tsx` — slide-in panel when row clicked (deck, email, voice)
- [ ] `components/PitchDeckViewer.tsx` — HTML slide viewer + PPTX download
- [ ] `components/EmailPreview.tsx` — generated email + copy button
- [ ] `components/AnalyticsDashboard.tsx` — charts: industry breakdown, score distribution, top opportunities

### Phase 3 — Prize Features
- [ ] `components/AgentThinking.tsx` — discovery/enrichment reasoning display
- [ ] Audio player for voice briefings
- [ ] Stripe credits in header + checkout flow
- [ ] Auth: login/register screens, token storage

### AG Grid Columns
```typescript
const columnDefs = [
  { field: 'company_name', headerName: 'Company', pinned: 'left' },
  { field: 'description', headerName: 'Description', wrapText: true },
  { field: 'funding', headerName: 'Last Funding' },
  { field: 'industry', headerName: 'Industry' },
  { field: 'revenue', headerName: 'Revenue' },
  { field: 'employees', headerName: 'Employees' },
  { field: 'contacts', headerName: 'Key Contacts', cellRenderer: 'contactsRenderer' },
  { field: 'customers', headerName: 'Customers', cellRenderer: 'tagsRenderer' },
  { field: 'buying_signals', headerName: 'Signals', cellRenderer: 'signalsRenderer' },
  { field: 'best_match_product', headerName: 'Best Match', cellRenderer: 'matchRenderer' },
  { field: 'best_match_score', headerName: 'Score', cellRenderer: 'scoreRenderer', sort: 'desc' },
  { field: 'conversion_likelihood', headerName: 'Conversion', cellRenderer: 'conversionRenderer' },
  { field: 'actions', headerName: 'Actions', cellRenderer: 'actionsRenderer', pinned: 'right' },
];
```

---

## Design Guidelines
- **Theme:** Dark background (#0f172a), blue accents (#3b82f6), green for high scores (#22c55e)
- **Font:** Inter or system-ui
- **Spreadsheet:** `ag-theme-alpine-dark`
- **Key principle:** This should look like a product, not a hackathon project

## Demo Script (2 minutes)
```
<<<<<<< HEAD
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
│  Pitching: Stick Pro → Stripe          │
│─────────────────────────────────────────────│
│                                             │
│     Why Stripe Needs Stick Pro         │
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
│ ✅ Best match: Stick Pro (9/10)       │
│    "Strong alignment: B2B sales at scale"  │
│ 🔄 New info: Stripe just acquired X        │
│    → Re-evaluating product match...        │
│ ✅ Updated: still Stick Pro, adjusted │
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
=======
0:00 — "Finding clients costs $50k/year per SDR. Matching the RIGHT product to the RIGHT client? Even harder."
>>>>>>> 8d9f7ae204225a5c5fe19a72a608e654cc029ff5
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
