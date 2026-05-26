# Shrimp Cost Sheet — web app

Web replacement for `Cost sheet format - Shrimps.xlsx`. Built with Next.js 14 (App
Router), TypeScript, Tailwind, Prisma and Postgres-on-Railway / SQLite-locally.

**Formula inventory:** `Formula_Summary_Shrimps.xlsx` (project root) lists all
formulas, types, and cross-sheet links; see [`docs/Formula-summary-Shrimps.md`](docs/Formula-summary-Shrimps.md) for how that maps to the app.

## Features (day 1)

- Quote editor: **4 default sell lines**, **Add line** / **Remove** (1–12). Wider,
  padded tables; **Yield (%)**; **Stock FG (kg)** & **Stock cost Rs/kg**;
  product code → master lookup (name, size, yield, pcs/kg, default pack).
- **Custom cost rows:** add/remove extra **variable** and **fixed** Rs/kg lines
  (per product column), saved on the quote and included in margin math.
- Live calculation kernel (`lib/calc.ts`) from the Excel **Maintain** block;
  `npm run calc:test` checks line 1 parity.
- **Stock cost** row is reference-only (Excel excludes it from `SUM(E37:E46)`).
- **Processing charge connector:** `npm run db:seed` imports the **Processing charge** sheet into `ProcessingChargeRate`. The quote editor matches **Plant**, **Freeze type** (optional), **Pack**, and product text to auto-fill **variable** processing Rs/kg (override per line in **Proc var ₹/kg**). **Fixed** processing Rs/kg always uses global assumptions (Excel row 52).
- **Commission fan (quote-level):** optional **Commission Rs/kg (this quote)** overrides the global assumption for every line unless a line has its own **Comm ₹/kg**.
- Master product catalogue (`/products`) — Excel master on `db:seed`
- Editable cost assumptions (`/assumptions`)
- What-if sliders (USD, RM, FX ±30%) — live, not saved
- Quote status: `DRAFT → SUBMITTED → VERIFIED → APPROVED` (+ `REJECTED`).
  **Approve** freezes a JSON snapshot.
- PDF / print at `/quotes/{id}/pdf` (A4 landscape)
- Dashboard with quote counts, status mix, totals

## Run locally

```bash
cd shrimp-app
npm install
npx prisma migrate dev
npm run db:seed   # imports master from the Excel file in the parent folder
npm run dev
```

Open <http://localhost:3000>.

If **`npx prisma generate`** fails with **`EPERM`** on `query_engine-windows.dll.node` (often when the repo lives under **OneDrive**), stop **`npm run dev`** and other Node processes using the folder, then run `npx prisma generate` again. If it still fails, copy `shrimp-app` to a folder **outside** OneDrive and run install/migrate/generate there.

## Deploy

See **[`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md)** for Vercel + Postgres (e.g. **Railway** later) and GitHub push steps.

Short version:

1. Repo root = **`shrimp-app/`** (this folder is what you push to GitHub).
2. **`vercel.json`** runs `prisma migrate deploy` then `next build`; **`postinstall`** runs `prisma generate`.
3. Set **`DATABASE_URL`** on Vercel to a **hosted Postgres** URL for production (SQLite is for local dev only).
4. Switch **`prisma/schema.prisma`** to `provider = "postgresql"` when you move production to Postgres, then add migrations and redeploy.

## Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run calc:test` | Validate calculation kernel against Excel values |
| `npm run lookup:test` | Processing charge lookup matcher (unit smoke test) |
| `npm run db:migrate` | Apply schema changes |
| `npm run db:seed` | Re-import assumptions + master from the Excel file |
| `npm run db:reset` | Wipe DB and re-seed (dangerous) |

## File map

```
app/                 # Next.js App Router pages
  page.tsx           # Dashboard
  quotes/            # Quote list, new, [id] editor, [id]/pdf
  products/          # Master catalogue
  assumptions/       # Cost assumption editor
  actions/           # Server actions (saveQuote, transitionQuote, ...)
lib/
  calc.ts            # Pure calculation kernel (Excel parity)
  calc.test.ts       # Sanity test: line 1 of the original workbook
  processingLookup.ts # Processing charge sheet → variable Rs/kg matcher
  quoteCompute.ts    # Wires commission + processing lookup into computeQuote input
  assumptions.ts     # Load assumptions out of DB
  db.ts              # PrismaClient singleton
prisma/
  schema.prisma      # Data model
  seed.ts            # Imports master + Processing charge rates + assumptions
```

## To do

- Authentication (Clerk or NextAuth) for production
- Excel export of a quote (.xlsx) in the original layout
- Recharts dashboard (status mix bar, monthly margin line)
- Version history per quote (every save = revertible revision)
