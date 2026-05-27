# Shrimp Cost Sheet — web app

Web replacement for `Cost sheet format - Shrimps.xlsx`. Built with **Next.js 16** (App Router), TypeScript, Tailwind CSS, Prisma ORM, and **PostgreSQL** (Railway in production).

**Formula inventory:** see [`docs/Formula-summary-Shrimps.md`](docs/Formula-summary-Shrimps.md) for how the Excel formulas map to `lib/calc.ts` and the quote UI.

---

## Features

### Quote editor
- **1–12 sell lines** (default 4). Add / Remove per line.
- **ProductCombobox** — searchable by code or name; Enter picks first match. Auto-fills product name, size band, pack, standard yield %, and avg RM size from the Product master.
- **Price history hint** below each USD/kg cell: `Last: $4.50 · 12/03/2026 · Customer` — last 5 non-rejected quotes for that product.
- **Per-line warnings** (⚠ badge + amber input borders) for: zero yield, zero RM price, missing processing-rate match. Warning panel above table lists all issues.
- **Sticky action bar** — title, coloured status badge, warning count, all action buttons stay in view while scrolling.
- **Unsaved-changes indicator** — Save button shows a `●` dot when edits are pending; browser `beforeunload` fires on navigation.
- **Auto-save before status transitions** — clicking Submit/Verify/Approve with unsaved edits saves first, then transitions.

### Quote header fields
PO No · Customer · Country · Plant · Freeze type · Incoterm · Payment · USD/INR · Contract date · Revised date · Port of loading + date · Port of destination + date · Commission Rs/kg (quote-level override) · Processing charge GST toggle · Prepared by · Verified by · Approved by · Notes

### Cost build-up (Excel Cost Flow Table)
Exact top-to-bottom order of `Cost sheet format - Shrimps.xlsx` (rows 24–60):

- **Selling block** — selling price INR/kg, revenue USD/INR
- **Variable costs** — RM meat, packaging, additive, harvesting, processing (variable, auto-looked-up), commission, export shipment, DDP, DBK (−), MEIS (−)
- **Custom variable cost rows** — add/remove, editable label, per-column values
- **Contribution margin highlight**
- **Fixed costs** — processing (fixed from assumptions), wages, rental, depreciation
- **Custom fixed cost rows**
- **Profit highlight**

All column totals use revenue-weighted averages; margin % uses `Σ contribution / Σ revenue` (not kg-weighted).

### What-if sliders
USD/kg ±30%, RM price ±30%, FX rate ±30% — live, not saved.

### Status workflow
```
DRAFT → SUBMITTED → VERIFIED → APPROVED → SENT
                ↘               ↘
               REJECTED      REJECTED
```
- Every transition is enforced **server-side** via a `VALID_TRANSITIONS` map.
- **Submit / Approve** validate active lines: zero yield or zero RM price blocks the transition.
- **Approve** freezes a JSON snapshot of quote + assumptions + computed results so future assumption changes don't drift the approved figures.
- **Mark as Sent** available from APPROVED; SENT is the terminal state.
- Each status has a distinct colour badge (slate / blue / violet / emerald / teal / rose).

### Other
- **Duplicate quote** — copies header + lines to a new DRAFT; confirm dialog guards against accidental clicks.
- **PDF / Print** — `/quotes/{id}/pdf` returns print-ready A4 landscape HTML.
- **Audit log** — collapsible (default closed), full event history with timestamps.
- **Collapsible header section** — shows summary line when collapsed, full form when open.
- **Products master** (`/products`) — full CRUD, soft-delete, reactivate.
- **Cost assumptions** (`/assumptions`) — edit all default Rs/kg values; toast on save.
- **Dashboard** — KPI cards (quotes, products, total revenue, profit %), by-status mix, recent quotes table.
- **Toast notifications** — success / error / info, slide-in animation, auto-dismiss after 4 s.

---

## Run locally

> **Requires PostgreSQL.** The schema uses PostgreSQL-only types (`JSONB`, native enum). SQLite is not supported.

The quickest local database is Docker:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
```

Then:
```bash
cd shrimp-app
cp .env.example .env
# Edit .env — set DATABASE_URL, e.g.:
#   DATABASE_URL="postgresql://postgres:dev@localhost:5432/shrimp"

npm install
npx prisma migrate deploy   # creates tables
npm run db:seed             # imports assumptions + master from the Excel file
npm run dev
```

Open <http://localhost:3000>.

`npm run db:seed` looks for `../Cost sheet format - Shrimps.xlsx` (one level above the repo). Move the workbook there or adjust `prisma/seed.ts` if your layout differs. The app runs without the Excel file — seed skips the import and you can create products manually.

**OneDrive note:** if `npx prisma generate` fails with `EPERM` on `query_engine-windows.dll.node`, stop all Node processes using the folder and retry. If it persists, move the repo outside OneDrive.

---

## Deploy

See [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) for the full Vercel + Railway walkthrough.

Short version:

1. Push this folder to GitHub.
2. Import the repo in Vercel; set `DATABASE_URL` (Environment Variables → Production) to your Railway Postgres URL.
3. `npm run build` runs `prisma migrate deploy` then `next build` — no extra build command needed.
4. Run `npm run db:seed` once from your machine against the production `DATABASE_URL` to populate assumptions and the product master.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | `prisma migrate deploy` + production Next.js build |
| `npm run calc:test` | Calculation kernel unit tests (6 cases: Excel parity, edge cases, weighted margin) |
| `npm run lookup:test` | Processing-charge lookup matcher smoke test |
| `npm run name:test` | Product-name parser smoke test |
| `npm run db:migrate` | Create a new migration during schema development |
| `npm run db:seed` | (Re-)import assumptions + products + processing rates from Excel |
| `npm run db:reset` | Wipe DB and re-seed (destructive) |

---

## File map

```
app/
  page.tsx                        Dashboard (KPI cards, status mix, recent quotes)
  layout.tsx                      Root layout: sticky nav + ToastProvider
  globals.css                     Tailwind base + component classes + toast animation
  components/
    NavLinks.tsx                  Active-path nav (client component)
    Toaster.tsx                   Toast context, provider, and useToast() hook
  quotes/
    page.tsx                      Quote list: search + status filter tabs + table
    new/page.tsx                  New quote creation form
    [id]/page.tsx                 Quote detail server component (fetches DB → props)
    [id]/QuoteEditor.tsx          Quote editor client component
    [id]/ExcelCostFlowTable.tsx   Excel-style cost-flow table (sticky label column)
    [id]/pdf/route.ts             Print-ready HTML handler (A4 landscape, auto-print)
  products/
    page.tsx                      Product list server component
    ProductTable.tsx              Product CRUD client component
  assumptions/
    page.tsx                      Assumptions server component
    AssumptionsForm.tsx           Assumption editor client component
  actions/
    quotes.ts                     saveQuote, transitionQuote, duplicateQuote, deleteQuote, createQuote
    products.ts                   upsertProduct, deleteProduct, activateProduct, getProductPriceHistory
    assumptions.ts                updateAssumptions
lib/
  calc.ts                         Pure calculation kernel (Excel Maintain rows 24–60)
  calc.test.ts                    Unit tests: Excel line parity, zero-weight, zero-yield, weighted margin
  processingLookup.ts             Processing-charge sheet lookup → variable Rs/kg
  quoteCompute.ts                 Wires commission override + processing lookup into computeQuote input
  customCosts.ts                  Custom variable/fixed cost row serialisation helpers
  productName.ts                  Pack parsing from product names, category grouping for combobox
  assumptions.ts                  loadAssumptions() — reads DB + merges with DEFAULT_ASSUMPTIONS
  db.ts                           PrismaClient singleton
prisma/
  schema.prisma                   Data model (PostgreSQL)
  seed.ts                         Imports assumptions + product master + processing rates from Excel
  migrations/                     Single PostgreSQL baseline migration
docs/
  DEPLOY-VERCEL.md                Vercel + Railway deployment walkthrough
  Formula-summary-Shrimps.md     Excel formula inventory mapped to app code
```

---

## Roadmap

- **Authentication** — no login / roles yet; add Clerk or NextAuth before sharing externally
- **Excel export** — download a quote as `.xlsx` in the original cost-sheet layout
- **Dashboard charts** — status-mix bar, monthly revenue / margin trend lines
- **Quote version history** — every save creates a revertible revision
- **Customer / supplier master** — PO and customer autocomplete
