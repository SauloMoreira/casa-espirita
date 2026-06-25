import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Dedicated runner for REAL database integration tests (L-07).
 *
 * These are intentionally separated from the unit/governance suite: they require
 * live Postgres credentials (PG* env vars) and exercise real triggers, RLS-aware
 * SECURITY DEFINER functions, auditing and idempotency. They never run in the
 * default `npm test` / CI (which has no DB) — run with `npm run test:db`.
 *
 * Naming convention: `*.dbtest.ts` (does not match the main config's
 * `*.{test,spec}.{ts,tsx}` include, so it can never leak into the unit run).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/integration/db/**/*.dbtest.ts"],
    // Real DB; keep serial to avoid pool contention and flaky parallel state.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
