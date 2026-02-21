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
