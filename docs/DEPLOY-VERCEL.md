# Deploying to Vercel + Railway

The repo root is **`shrimp-app/`** — that directory is the Next.js + Prisma project. Point Vercel and GitHub at this folder.

---

## 1. Database (Railway PostgreSQL)

The schema uses `provider = "postgresql"` and PostgreSQL-only types (`JSONB`, native enum). **SQLite is not supported.**

### Railway setup

1. Go to [railway.app](https://railway.app) → New project → **Deploy PostgreSQL**.
2. Select the database → **Connect** tab → copy `DATABASE_URL` (the full `postgresql://...` string).
3. If the password contains special characters (`@`, `#`, `!`, etc.), **URL-encode** them (e.g. `@` → `%40`) in the connection string before pasting it into Vercel.

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
2. **Root directory:** leave blank if you pushed `shrimp-app/` as the repo root; set it to `shrimp-app` if it's a subdirectory.
3. **Environment variables** → add `DATABASE_URL` for **Production** (and **Preview** if you want preview deploys):
   - Value: the Railway `DATABASE_URL` from step 1.
4. **Build command:** leave as default — `npm run build` runs `prisma migrate deploy` then `next build` (see `package.json`). Do **not** add a separate override.
5. **Node version:** 20+ recommended; Vercel's default is fine for Next.js 16.

### Deploy flow

```
git push origin main
  └─ Vercel triggers build
       └─ npm install → postinstall: prisma generate
       └─ npm run build → prisma migrate deploy → next build
```

`vercel.json` only sets the framework preset; the build is driven entirely by `package.json`.

---

## 3. Seed the database

`npm run db:seed` imports assumptions + the product master + processing-charge rates from `../Cost sheet format - Shrimps.xlsx`. Vercel does **not** run this during build.

Run it once from your machine against the production URL:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

Or via Railway's CLI / shell-in-container if you prefer running it server-side.

The app works without seeding — assumptions use hardcoded defaults and you can add products manually — but processing-rate auto-lookup and product master import require a seed.

---

## 4. Push to GitHub

From `shrimp-app/`:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Vercel auto-deploys from `main`. Use feature branches for development and merge to `main` when ready to ship.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: *Environment variable not found: `DATABASE_URL`* | Add `DATABASE_URL` in Vercel → Settings → Environment Variables → Production. |
| Build fails: *P1013 invalid port number* or *could not translate host name* | Password has special characters — URL-encode them (`@`→`%40`, `#`→`%23`, etc.) in the connection string. Re-copy from Railway's Connect tab and encode carefully. |
| *P1001: Can't reach database server* | Check Railway allows external connections; verify SSL (`?sslmode=require` may be needed). |
| *Migration failed / provider mismatch* | Confirm `prisma/schema.prisma` says `provider = "postgresql"` (not `sqlite`). |
| `npm run build` works locally but fails on Vercel | Vercel does not read your local `.env` file — set all required env vars in the Vercel dashboard. |
| `prisma generate` fails with `EPERM` (Windows / OneDrive) | Stop all Node processes using the folder; retry outside OneDrive if it persists. |
