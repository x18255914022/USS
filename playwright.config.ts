import { defineConfig } from "@playwright/test";

// ponytail: system Edge via channel — cdn.playwright.dev (chromium download) is
// unreachable from this network; remove `channel` after `pnpm exec playwright install chromium` works.
export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    trace: "on-first-retry",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: [
    {
      command: "pnpm --filter @app/api dev",
      url: "http://localhost:3001/health",
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      // stderr: ioredis retries print full stack traces every second when Redis is
      // unavailable (the happy path works without Redis; only telegram delivery needs it).
      stderr: "ignore",
    },
    {
      command: "pnpm --filter @app/web dev",
      url: "http://localhost:3000",
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
