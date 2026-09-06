/**
 * One-shot Turso schema apply + seed.
 * Generates SQL offline; applies via @libsql/client; then seeds.
 */
import { createClient } from "@libsql/client";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";

function requireEnv(): { url: string; authToken: string } {
  const url = process.env.DATABASE_URL ?? "";
  const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
  const okUrl =
    url.startsWith("libsql:") ||
    (url.startsWith("https:") && url.includes("turso"));
  if (!okUrl) {
    console.error("DATABASE_URL must be a Turso URL (libsql://... or https://...turso...).");
    console.error(`Got: ${url ? url.slice(0, 40) + "…" : "(empty)"}`);
    process.exit(1);
  }
  if (!authToken) {
    console.error("TURSO_AUTH_TOKEN is required for Turso setup.");
    process.exit(1);
  }
  return { url, authToken };
}

function generateSchemaSql(): string {
  const schemaPath = join(process.cwd(), "prisma", "schema.prisma");
  // migrate diff does not need a live DB; dummy file: URL for env resolve.
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL?.startsWith("file:")
      ? process.env.DATABASE_URL
      : "file:./dev.db",
  };
  return execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", schemaPath, "--script"],
    { encoding: "utf8", env, cwd: process.cwd() },
  );
}

function isAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("duplicate") ||
    /SQLITE_ERROR.*already exists/i.test(msg)
  );
}

async function applySql(url: string, authToken: string, sql: string): Promise<void> {
  const client = createClient({ url, authToken });
  const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  const cleaned = statements
    .map((s) =>
      s.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim(),
    )
    .filter(Boolean);
  console.log(`Applying ${cleaned.length} SQL statements to Turso…`);
  let applied = 0;
  let skipped = 0;
  for (const stmt of cleaned) {
    try {
      await client.execute(stmt);
      applied++;
    } catch (err) {
      if (isAlreadyExistsError(err)) {
        skipped++;
        console.log(`  skip (already exists): ${stmt.slice(0, 60)}…`);
        continue;
      }
      console.error("Failed statement:\n", stmt.slice(0, 200));
      throw err;
    }
  }
  console.log(`Schema applied (${applied} ok, ${skipped} already-existed).`);
}

function runSeed(): void {
  console.log("Running seed…");
  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  const { url, authToken } = requireEnv();
  console.log("Generating schema SQL from prisma/schema.prisma…");
  const sql = generateSchemaSql();
  if (!sql.trim()) {
    console.error("prisma migrate diff produced empty SQL.");
    process.exit(1);
  }
  await applySql(url, authToken, sql);
  runSeed();
  console.log("Success: Turso schema applied + seed done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
