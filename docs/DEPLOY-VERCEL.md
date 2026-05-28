# Deploying to Vercel + Railway

The repo root is **`shrimp-app/`** — that directory is the Next.js + Prisma project. Point Vercel and GitHub at this folder.

---

## 1. Database (Railway PostgreSQL)

The schema uses `provider = "postgresql"` and PostgreSQL-only types (`JSONB`, native enum). **SQLite is not supported.**

### Railway setup

1. Go to [railway.app](https://railway.app) → New project → **Deploy PostgreSQL**.
2. Select the database → **Connect** tab → copy `DATABASE_URL` (the full `postgresql://...` string).
3. If the password contains special characters (`@`, `#`, `!`, etc.), **URL-encode** them (e.g. `@` → `%40`) in the connection string before pasting into Vercel.

### Local development

Use Docker for a local PostgreSQL instance:
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
# DATABASE_URL="postgresql://postgres:dev@localhost:5432/shrimp"
```

Or point your local `.env` at any hosted PostgreSQL (Railway, Neon, Supabase).

---

## 2. Vercel project settings

1. **Import** the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. **Root directory:** leave blank if you pushed `shrimp-app/` as the repo root; set to `shrimp-app` if it's a subdirectory.
3. **Environment variables** → add `DATABASE_URL` for **Production** (and **Preview** if you want preview deploys):
   - Value: the Railway `DATABASE_URL` from step 1.
4. **Build command:** leave as default — `npm run build` is defined in `package.json` as:
   ```
   prisma migrate deploy && npm run db:seed && next build
   ```
   This means every deploy automatically applies pending migrations **and** re-seeds assumptions + product master + processing rates. Do **not** add a separate override.
5. **Node version:** 20+ recommended; Vercel's default is fine for Next.js 16.

### Deploy flow

```
git push origin main
  └─ Vercel triggers build
       ├─ npm install → postinstall: prisma generate
       └─ npm run build
              ├─ prisma migrate deploy   (applies any pending migrations)
              ├─ npm run db:seed         (upserts assumptions; imports products + rates from Excel)
              └─ next build
```

The seed is **idempotent**: assumptions are upserted (only created on first run — user-edited values are never overwritten), products are upserted by code, and processing rates are deleted and recreated from the Excel file on every deploy.

---

## 3. Excel workbook (seed data)

`npm run db:seed` imports:
- **Assumptions** (default Rs/kg values, duty percentages, FX default) from hardcoded constants in `prisma/seed.ts`
- **Product master** from the `master` sheet of `Cost sheet format - Shrimps.xlsx`
- **Processing charge rates** from the `Processing charge` sheet of the same workbook

The workbook (`Cost sheet format - Shrimps.xlsx`) is committed to the repo root. Vercel uses this file automatically during the build seed. If you update the workbook, commit it and the next deploy will re-import rates and products.

The app works without the file — assumptions use hardcoded defaults and you can add products manually — but processing-rate auto-lookup and product master import require a successful seed.

---

## 4. Push to GitHub

From `shrimp-app/`:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Vercel auto-deploys from `main`. Use feature branches for development and merge to `main` when ready.

---

## 5. After first deploy — verify

1. Open the app URL → **Dashboard** should load (empty charts and zero KPIs on first deploy is fine).
2. Go to **Assumptions** — the assumptions table should show ~15 rows; the Processing Rates card should show all seeded rates.
3. Go to **Products** — should show all products from the Excel master sheet.
4. Create a test quote and verify the product picker, processing-rate auto-fill, and PDF export work.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: *Environment variable not found: `DATABASE_URL`* | Add `DATABASE_URL` in Vercel → Settings → Environment Variables → Production. |
| Build fails: *P1013 invalid port number* or *could not translate host name* | Password has special characters — URL-encode them (`@`→`%40`, `#`→`%23`, etc.). Re-copy from Railway's Connect tab. |
| *P1001: Can't reach database server* | Check Railway allows external connections; try adding `?sslmode=require` to the connection string. |
| *Migration failed / provider mismatch* | Confirm `prisma/schema.prisma` says `provider = "postgresql"` (not `sqlite`). |
| `npm run build` works locally but fails on Vercel | Vercel does not read your local `.env` — set all required env vars in the Vercel dashboard. |
| Products / assumptions empty after deploy | The seed step failed silently. Check build logs for errors in the `npm run db:seed` step. |
| `prisma generate` fails with `EPERM` (Windows / OneDrive) | Stop all Node processes; retry outside OneDrive if it persists. |
| Processing rates not auto-filling in the quote editor | The Plant field on the quote must match a Plant name exactly. Check the Processing Rates card on `/assumptions` to confirm the rate exists and the plant/pack/product names align. |
