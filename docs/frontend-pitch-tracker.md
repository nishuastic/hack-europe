# Frontend + Pitch Deck Tracker — Person C + D

## Your Stack
- **Next.js 15** with App Router (TypeScript)
- **bun** (package manager + runtime)
- **AG Grid Community** (spreadsheet UI)
- **Tailwind CSS** (styling)
- **WebSocket** (real-time cell updates from backend)

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
POST   /api/product              → save product description
POST   /api/leads/import         → {"companies": ["Stripe", "Plaid"]}
GET    /api/leads                → list all leads with enrichment data
POST   /api/leads/{id}/pitch-deck  → generate pitch deck (returns HTML slides JSON)
GET    /api/leads/{id}/pitch-deck/download  → download PPTX
POST   /api/leads/{id}/email     → generate email draft
POST   /api/leads/{id}/voice     → generate voice briefing (Phase 3)
WS     ws://localhost:8000/ws/updates → real-time cell updates
```

---

## Phase 1 — Spreadsheet UI (Hours 0-8)

### Person C — Core Components
- [ ] `app/page.tsx` — main page layout (header, import area, spreadsheet)
- [ ] `app/layout.tsx` — app shell with dark/light theme base
- [ ] `components/SpreadsheetGrid.tsx` — AG Grid component
- [ ] `components/LeadImport.tsx` — CSV paste textarea + submit
- [ ] `components/ProductConfig.tsx` — "Describe your product" text input
- [ ] `lib/api.ts` — API client (fetch wrapper + WebSocket connection)

### Person D — Design + Data
- [ ] Prepare 20-company test dataset (CSV: one company name per line)
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
  { field: 'fit_score', headerName: 'Fit Score', width: 100, cellRenderer: 'scoreRenderer',
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
};
```

### Cell Renderers to Build
- **linkRenderer**: clickable URL
- **contactsRenderer**: show "Jane Doe (CEO)" with LinkedIn icon link
- **tagsRenderer**: pill/badge list for customers
- **scoreRenderer**: colored bar (red 1-3, yellow 4-6, green 7-10)
- **actionsRenderer**: "Pitch Deck" + "Email" buttons per row
- **loadingRenderer**: spinner while enrichment is in progress for that cell

### Deliverable by Hour 8
- Paste companies → see them in AG Grid
- Watch cells fill in real-time via WebSocket (loading spinner → data)
- Sortable by fit score
- Looks professional (not a prototype)

---

## Phase 2 — Pitch Deck + Actions (Hours 8-14)

### Person C — Action Panel + Deck Viewer
- [ ] `components/ActionPanel.tsx` — slide-in panel from right when row clicked
- [ ] `components/PitchDeckViewer.tsx` — renders HTML slides, prev/next nav, fullscreen
- [ ] `components/EmailPreview.tsx` — shows generated email, copy button

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
  → Three action buttons:
    [Generate Pitch Deck]  [Draft Email]  [Voice Briefing]
  → Clicking "Generate Pitch Deck":
    - Shows loading animation
    - POST /api/leads/{id}/pitch-deck
    - Renders returned slides in PitchDeckViewer
    - "Download PPTX" button appears
  → Clicking "Draft Email":
    - POST /api/leads/{id}/email
    - Shows email in EmailPreview with subject line + body
    - "Copy to Clipboard" button
```

### PitchDeckViewer Component
```
┌─────────────────────────────────────────────┐
│  ◀  Slide 3 of 7  ▶          [Fullscreen]  │
│─────────────────────────────────────────────│
│                                             │
│     Why Stripe Needs SalesForge             │
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

### Deliverable by Hour 14
- Click any enriched lead → see 7-slide personalized pitch deck
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
│ 🔍 Analyzing product-customer fit...       │
│ ✅ Fit score: 9/10 — strong alignment      │
│ 🔄 New info: Stripe just acquired X        │
│    → Re-evaluating approach...             │
│ ✅ Updated pitch angle to reference M&A    │
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
- [ ] "Powered by" footer: Claude, LinkUp, Stripe, ElevenLabs, Gemini logos
- [ ] Responsive (just don't break on smaller screens)

### Person D
- [ ] Final demo script timed to 2:00 exactly
- [ ] 5 full dry runs, fix any hiccups
- [ ] Prepare 30-second elevator pitch
- [ ] Q&A prep doc: anticipated judge questions + answers
- [ ] Backup: screen recording of perfect demo run
- [ ] The meta-pitch: our app generates pitch decks, and we'll USE a generated deck in our pitch

---

## Design Guidelines
- **Theme:** Dark background (#0f172a), blue accents (#3b82f6), green for high scores (#22c55e)
- **Font:** Inter or system-ui (clean, modern)
- **Spreadsheet:** AG Grid's `ag-theme-alpine-dark`
- **Slides:** White background, dark text, accent color for highlights
- **Key principle:** This should look like a product, not a hackathon project
