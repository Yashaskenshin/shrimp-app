# Shrimp Cost Sheet — web app

Web replacement for `Cost sheet format - Shrimps.xlsx`. Built with **Next.js 16** (App Router), TypeScript, Tailwind CSS, Prisma ORM, and **PostgreSQL**.

**Formula inventory:** [`docs/Formula-summary-Shrimps.md`](docs/Formula-summary-Shrimps.md) — how Excel formulas map to `lib/calc.ts` and the quote UI.

---

## Features

### Dashboard
- **KPI cards** — total quotes, active products, aggregate revenue (INR), profit before admin with margin %. Cards are colour-coded (profit green/red).
- **Revenue trend chart** — last 12 months of INR revenue (Recharts bar chart).
- **Top customers chart** — up to 8 customers by aggregate revenue (horizontal bar).
- **Quote pipeline chart** — status distribution bar chart with colour-coded legend and percentages.
- **Recent quotes** — last 10 quotes; entire row is clickable.

### Quotes list (`/quotes`)
- **Search** by PO number or customer (case-insensitive).
- **Status filter** buttons (All, DRAFT, SUBMITTED, VERIFIED, APPROVED, REJECTED, SENT).
- **Sortable columns** — click PO, Customer, Status, or Updated headers; sort direction toggled via URL params.
- **Pagination** — 25 per page; prev / next and page number links.
- **Export CSV** — downloads current search + status filter as a date-stamped `.csv` (all matching rows, not just the current page).
- Entire row is clickable.

### New quote (`/quotes/new`)
- PO No, Customer, USD/INR rate (default pulled from the `default_fx_rate` assumption — change once in Assumptions, all new quotes follow).

### Quote editor (`/quotes/[id]`)

#### Sticky action bar
Compact bar stays visible while scrolling. Buttons grouped with separators:
- **Save** — `Ctrl+S` / `Cmd+S` keyboard shortcut; dot indicator when edits are pending.
- **Status actions** — Submit / Verify / Approve ✓ / Mark Sent / ↩ Draft / Reject (muted styling).
- **Utilities** — PDF (opens print view in new tab), Copy (duplicate).
- **Delete** — muted, far right.

Auto-saves pending edits before any status transition.

#### Quote header — sectioned form
Four labelled sections (expand / collapse the whole form with one click):

| Section | Fields |
|---|---|
| **Commercial** | PO No, Customer, Country, Incoterm, Payment, Contract date, Revised date |
| **Shipping & Processing** | Plant, Freeze type, Port of loading + date, Port of destination + date |
| **Financial** | USD/INR rate, Commission Rs/kg override, Processing charge + GST toggle |
| **Team & Notes** | Prepared by, Verified by, Approved by, Notes |

Collapsed state shows a rich summary line: Customer · Country · incoterm badge · Payment · Plant · ports.

**Smart datalist autocomplete** on: Customer, Country, Port of loading, Port of destination (populated from existing quotes), Payment (standard trade terms list).

**Duplicate PO warning** — if another quote already has the same PO number, a toast fires after save.

#### Sell lines
- 1–12 lines (default 4); add / remove per line.
- **ProductCombobox** — type code or name; results grouped by category with sticky headers. Arrow ↑↓ keyboard navigation + Enter to select. Clear button in dropdown header.
- Auto-fills product name, size band, pack, standard yield %, avg RM size from master. Yield stays `null` if unset in master — warning fires.
- **Price history hint** below each USD/kg input: last quoted price, date, and customer for that product.
- **Per-line warnings** (⚠ badge + amber borders): zero yield, zero RM price, missing processing-rate match.

#### Cost build-up (Excel Cost Flow Table)
Exact row order of `Cost sheet format - Shrimps.xlsx` rows 24–60:

- Selling block (selling price INR/kg, revenue USD/INR)
- Variable costs: RM meat, packaging, additive, harvesting, processing (variable, auto-looked-up), commission, export shipment, DDP, DBK (−), MEIS (−)
- **Custom variable cost rows** — add/remove, editable label, per-column values
- **Contribution margin** highlight row
- Fixed costs: processing (from assumptions), wages, rental, depreciation
- **Custom fixed cost rows**
- **Profit** highlight row

All column totals use revenue-weighted averages; margin % uses `Σ contribution / Σ revenue`.

#### What-if sliders
USD/kg ±30%, RM price ±30%, FX rate ±30% — live preview, not saved.

#### Status workflow
```
DRAFT → SUBMITTED → VERIFIED → APPROVED → SENT
                ↘               ↘
              REJECTED        REJECTED
```
- Enforced **server-side** via `VALID_TRANSITIONS` map.
- **Submit / Approve** block if any active line has zero yield or zero RM price.
- **Approve** snapshots the full quote + assumptions + computed results as JSON — future assumption changes cannot drift approved figures.
- Each status has a distinct colour badge (slate / blue / violet / emerald / teal / rose).

#### Other quote features
- **Duplicate** — copies header + all lines to a new DRAFT.
- **PDF / Print** — `/quotes/{id}/pdf` returns print-ready A4 landscape HTML (2 pages: exec summary + full cost breakdown).
- **Audit log** — collapsible (default closed); full event history with timestamps.

### Products master (`/products`)
- Full CRUD — create, edit in modal dialog, soft-delete (toggle active).
- Yield entered in **percent (0–100)**, stored as 0–1 in DB.
- Toast feedback on every save / activate / deactivate.
- Inactive products stay in old quotes but are hidden from the combobox.
- Search by code or name; "Show inactive" toggle.

### Assumptions & Masters (`/assumptions`)

| Card | Description |
|---|---|
| **Processing plants** | Add / rename / toggle / delete plants that appear in the quote Plant dropdown. Active plants feed processing-charge lookup. |
| **Assumptions** | Grouped editable defaults (Variable costs, Duties/drawback, Fixed costs, Calculation factors). Includes `default_fx_rate` — the default USD/INR rate for new quotes. |
| **Processing charge rates** | Collapsible read-only viewer for all seeded rates. Searchable by product/pack/freeze type; filterable by plant. |

### Toast notifications
Success / error / info, slide-in animation, 4 s auto-dismiss. Every destructive or mutating action provides feedback.

---

## Run locally

> **Requires PostgreSQL.** The schema uses PostgreSQL-only types (`JSONB`, native enum). SQLite is not supported.

```bash
# Quickest local DB
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16

cd shrimp-app
cp .env.example .env
# Edit .env → set DATABASE_URL:
#   DATABASE_URL="postgresql://postgres:dev@localhost:5432/shrimp"

npm install
npx prisma migrate deploy   # creates tables
npm run db:seed             # imports assumptions + master from Excel file
npm run dev
```

Open <http://localhost:3000>.

`npm run db:seed` looks for `Cost sheet format - Shrimps.xlsx` in the repo root (committed), then one directory above. The app runs without the file — seed skips product/rate import and you can add products manually.

**OneDrive note:** if `npx prisma generate` fails with `EPERM` on `query_engine-windows.dll.node`, stop all Node processes and retry outside OneDrive.

---

## Deploy

See [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) for the full Vercel + Railway walkthrough.

Short version:
1. Push this folder to GitHub.
2. Import the repo in Vercel; set `DATABASE_URL` in Environment Variables → Production.
3. `npm run build` runs `prisma migrate deploy && npm run db:seed && next build` — migrations apply and seed data loads automatically on every deploy.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma migrate deploy` → `npm run db:seed` → `next build` |
| `npm run calc:test` | Calculation kernel unit tests |
| `npm run lookup:test` | Processing-charge lookup matcher smoke test |
| `npm run name:test` | Product-name parser smoke test |
| `npm run db:migrate` | Create a new migration during schema development |
| `npm run db:seed` | (Re-)import assumptions + products + processing rates from Excel |
| `npm run db:reset` | Wipe DB and re-seed (destructive) |

---

## File map

```
app/
  page.tsx                        Dashboard (KPI cards, charts, pipeline, recent quotes)
  layout.tsx                      Root layout: sticky nav + mobile hamburger + ToastProvider
  globals.css                     Tailwind base + component classes + toast animation
  components/
    NavLinks.tsx                  Active-path nav; mobile hamburger menu
    Toaster.tsx                   Toast context, provider, and useToast() hook
    DashboardCharts.tsx           Recharts charts: revenue trend, top customers, pipeline
  quotes/
    page.tsx                      Quote list: search, status filter, sort, pagination
    new/page.tsx                  New quote form (FX default from DB)
    [id]/page.tsx                 Quote detail server component
    [id]/QuoteEditor.tsx          Quote editor client component (sectioned header, Ctrl+S, autocomplete)
    [id]/ExcelCostFlowTable.tsx   Excel-style cost-flow table (sticky label column)
    [id]/pdf/route.ts             Print-ready HTML (A4 landscape, exec summary + full breakdown)
    export/route.ts               CSV export endpoint (respects search/status filter)
  products/
    page.tsx                      Product list server component
    ProductTable.tsx              Product CRUD client component (toasts, % yield input)
  assumptions/
    page.tsx                      Assumptions page server component
    AssumptionsForm.tsx           Grouped assumption editor
    PlantsCard.tsx                Plant master CRUD
    ProcessingRatesCard.tsx       Read-only processing rates viewer (searchable, collapsible)
  actions/
    quotes.ts                     saveQuote, transitionQuote, duplicateQuote, deleteQuote,
                                  createQuote, getQuoteAutocomplete
    products.ts                   upsertProduct, activateProduct, getProductPriceHistory
    assumptions.ts                updateAssumptions
    plants.ts                     addPlant, renamePlant, togglePlantActive, deletePlant
lib/
  calc.ts                         Pure calculation kernel (Excel Maintain rows 24–60)
  calc.test.ts                    Unit tests: Excel line parity, zero-weight, zero-yield
  processingLookup.ts             Processing-charge sheet lookup → variable Rs/kg
  quoteCompute.ts                 Wires commission override + processing lookup into computeQuote
  customCosts.ts                  Custom variable/fixed cost row serialisation helpers
  productName.ts                  Pack parsing; category grouping for combobox
  assumptions.ts                  loadAssumptions() — DB read + DEFAULT_ASSUMPTIONS merge
  db.ts                           PrismaClient singleton
prisma/
  schema.prisma                   Data model (PostgreSQL): Quote, QuoteLine, QuoteEvent,
                                  QuoteSnapshot, Product, Plant, ProcessingChargeRate, Assumption
  seed.ts                         Imports assumptions + product master + processing rates from Excel
  migrations/                     PostgreSQL migrations
docs/
  DEPLOY-VERCEL.md                Vercel + Railway deployment walkthrough
  Formula-summary-Shrimps.md     Excel formula inventory mapped to app code
```

---

## Roadmap

- **Authentication** — no login / roles yet; add Clerk or NextAuth before sharing externally
- **Excel export** — download a quote as `.xlsx` in the original cost-sheet layout
- **Quote version history** — every save creates a revertible revision
- **Customer master** — deduplicated customer list with contact info
