import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests run against a production build with a dedicated database
 * (./data/e2e.db) that is wiped and re-seeded before every run — your demo
 * database is never touched.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run db:reset -- --yes && npm run build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 360_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: { DATABASE_PATH: "./data/e2e.db", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
