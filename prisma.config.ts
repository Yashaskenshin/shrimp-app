/**
 * Prisma CLI config (replaces deprecated `package.json#prisma`).
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 *
 * For Prisma ORM v6, the database URL stays in `prisma/schema.prisma`.
 *
 * When this file exists, Prisma skips auto-loading `.env`; load it here so
 * local `prisma migrate` / `prisma generate` still pick up `DATABASE_URL`.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
