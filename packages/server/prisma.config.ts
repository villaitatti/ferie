import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

// Same root-.env convention as src/config.ts: one .env at the monorepo root serves all packages.
// dotenv never overrides variables already in the environment, so CI and scripts can still point
// the CLI at another database via DATABASE_URL.
const rootEnv = resolve(import.meta.dirname, "../../.env");
loadDotenv(existsSync(rootEnv) ? { path: rootEnv, quiet: true } : { quiet: true });

// Prisma's env() helper throws while the config is being loaded, which breaks commands that never
// touch the database (`prisma generate` in CI, builds on a fresh clone with no .env). Resolve the
// URL ourselves instead — but never fall back to a real port: parallel checkouts share localhost,
// and a silent default could migrate or seed another workspace's database. The .invalid hostname
// keeps `generate` working (it never connects) while any database-touching command fails loudly
// with this string in the error.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://ferie@set-database-url-in-root-dot-env.invalid:5432/ferie";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
