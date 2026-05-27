# Deploying to Vercel

The Git repository lives in **`shrimp-app/`** — that directory is the Next.js + Prisma app. Point Vercel at this folder as the project root (or import a GitHub repo whose root is this folder).

## 1. Database (read this first)

| Environment | Recommendation |
|-------------|------------------|
| **Local dev** | SQLite (`DATABASE_URL=file:./dev.db`) — see `.env.example`. |
| **Vercel (production)** | **Hosted Postgres** (Neon, Supabase, Railway, etc.). Serverless functions do **not** give you a durable, shared SQLite file across invocations. |

**Railway:** When you add a Postgres plugin, copy `DATABASE_URL` into Vercel’s Environment Variables. You can keep SQLite locally while production uses Postgres.

**Prisma provider:** With Postgres in production, change `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then create and commit a Postgres migration (e.g. `npx prisma migrate dev` against a dev Neon/Railway DB), or use `prisma db push` for early experiments. **Do not** commit real credentials — only use env vars on Vercel.

## 2. Vercel project settings

1. Import the GitHub repo.
2. **Environment variables:** add **`DATABASE_URL`** for **Production** (and **Preview** if you want preview deploys to work).  
   If this is missing, the build fails at **`prisma migrate deploy`** with an error like *Environment variable not found: `DATABASE_URL`* or *Could not connect to database*.
3. **Build:** Vercel runs **`npm run build`**, which runs **`prisma migrate deploy`** then **`next build`** (see `package.json`). `npm install` runs **`postinstall`** → **`prisma generate`**.
4. **Node version:** Vercel defaults are fine for Next 16; use Node 20+ if you pin versions.

### Troubleshooting

| Symptom | Fix |
|--------|-----|
| Build stops right after `prisma migrate deploy` / “Environment variable not found: DATABASE_URL” | Add **`DATABASE_URL`** in Vercel → Project → Settings → Environment Variables (Production + Preview). |
| “P1001: Can't reach database server” | Check the URL, firewall, SSL (`?sslmode=require` on Neon etc.). |
| “Migration failed” / provider mismatch | Your Vercel `DATABASE_URL` must match `provider` in `schema.prisma` (Postgres URL if you switched off SQLite). |
| `npm run build` works locally but fails on Vercel | Ensure the same **`DATABASE_URL`** is set on Vercel; local uses `.env` which is not deployed. |

`vercel.json` only pins the **framework**; the build is **`npm run build`** from `package.json`.

## 3. Seed / Excel workbook

`npm run db:seed` reads `../Cost sheet format - Shrimps.xlsx` relative to the repo. On Vercel you typically **do not** run seed from the build. Run seed **once** from your machine (or a CI job) against the production `DATABASE_URL`, with the workbook available, or adjust `prisma/seed.ts` paths for your hosting layout.

## 4. Push to GitHub (no GitHub CLI)

From `shrimp-app/`:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

If the repo is new and empty, use `main` as above to match Vercel’s default branch name.
