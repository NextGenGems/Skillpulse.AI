/**
 * Additive Turso patch: CREATE TABLE IF NOT EXISTS SkillGap (+ indexes).
  * Safe for existing DBS that already ran turso-setup before Phase C.
  *
  * Usage:
  *   DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:turso:patch
 */
import { createClient } from "@libsql/client";

const SQL = `
CREATE TABLE IF NOT EXISTS "SkillGap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "signalsJson" TEXT,
    "score" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "slugHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "GenerationJob_skillGapId_idx" ON "GenerationJob"("skillGapId");
`.trim();

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
  const okUrl =
    url.startsWith("libsql:") || (url.startsWith("https:") && url.includes("turso"));
  if (!okUrl) {
    console.error("DATABASE_URL must be a Turso URL (libsql://... or https://...turso...).");
    process.exit(1);
  }
  if (!authToken) {
    console.error("TURSO_AUTH_TOKEN is required.");
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  const statements = SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    console.log("Applying: " + stmt.slice(0, 72) + "...");
    await client.execute(stmt);
  }

  console.log("OK: SkillGap table + GenerationJob indexes ensured.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
