import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * RULES §16 mandates testing across mobile (375px), tablet (768px),
 * and desktop (1440px) viewports. We run smoke tests against all
 * three projects on every CI invocation; deeper feature tests run
 * only on chromium-desktop.
 *
 * Local dev: `pnpm test:e2e` boots a dev server via `webServer.command`
 * and tears it down after the run. Override with `--ui` for interactive
 * mode or `--headed` to watch the browser.
 *
 * CI: `.github/workflows/e2e.yml` boots compose and runs against the
 * built image so we don't depend on hot-reload timing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],

  // Auto-start the dev server when running locally. CI overrides via
  // E2E_BASE_URL (set to the compose-up URL) so this block becomes a no-op
  // when CI is true (Playwright respects the `reuseExistingServer` flag).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
