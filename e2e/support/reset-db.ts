// e2e/support/reset-db.ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Playwright always runs tests from the repo root, so process.cwd() is reliable.
const REPO_ROOT = process.cwd();

/**
 * Read the D1 database name from wrangler.jsonc by scanning for the
 * "database_name" key.  Avoids full JSONC parsing (which is complicated by
 * double-slash sequences inside string values such as URLs).
 * Falls back to "saasmail-db" when the file is absent or unparseable.
 */
function getDbName(): string {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, "wrangler.jsonc"), "utf-8");
    // Match: "database_name": "some-value"
    const match = raw.match(/"database_name"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  } catch {
    // ignore
  }
  return "saasmail-db";
}

/**
 * Full reset: drop local D1 state, re-apply migrations, seed SQL.
 * Only safe to call BEFORE the dev server is running (else miniflare holds file locks).
 * Used by globalSetup.
 */
export function wipeAndSeed(): void {
  // Delete the entire local D1 state dir so migrations start from scratch.
  execSync(`rm -rf .wrangler/state/v3/d1`, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });

  const dbName = getDbName();

  execSync(`wrangler d1 migrations apply ${dbName} --local`, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });

  execSync(`wrangler d1 execute ${dbName} --local --file=seeds/e2e.sql`, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

/**
 * Soft reset: re-runs seeds/e2e.sql (which DELETEs then INSERTs) against the
 * live miniflare instance. Safe while the dev server is running.
 * Used by each spec file's beforeAll.
 */
export function truncateAndReseed(): void {
  const dbName = getDbName();
  execSync(`wrangler d1 execute ${dbName} --local --file=seeds/e2e.sql`, {
    cwd: REPO_ROOT,
    stdio: "pipe",
  });
}
