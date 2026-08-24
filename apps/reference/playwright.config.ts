import { defineConfig, devices } from "@playwright/test"
import { loadEnvFiles } from "./e2e/load-env"

loadEnvFiles(__dirname, [".env.e2e", ".env.local"])

const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json"

// Admin/setup projects require a real Convex backend (not placeholder URLs).
// In CI with placeholder URLs we only run the "public" project.
const hasRealBackend = !process.env.NEXT_PUBLIC_CONVEX_URL?.includes("placeholder")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry locally, two in CI.
  //
  // Roughly once per full run the admin shell fails to render inside 30s and a
  // test dies on "[data-slot=\"sidebar\"] not found" — a server or Convex
  // hiccup, not a defect: the spec that lost passed 33/33 on four immediate
  // repeats. A retry keeps that from reading as a failure, and Playwright
  // reports the test as flaky rather than as passed, so it stays visible
  // instead of being quietly absorbed.
  retries: process.env.CI ? 2 : 1,
  // One worker, everywhere.
  //
  // Two workers share a single Next server and a single Convex deployment, and
  // the contention shows up as tests failing on "[data-slot=\"sidebar\"] not
  // visible in 15s" — the admin shell simply had not rendered yet. Which tests
  // lost that race changed from run to run, so the suite reported different
  // defects each time and none of them were defects. The same five files that
  // failed under two workers passed 76/76 under one.
  workers: 1,
  reporter: "html",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    // Auth setup — runs first, saves browser state for admin tests
    ...(hasRealBackend
      ? [
          {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
            retries: 2,
          },
        ]
      : []),
    // Tests that don't need authentication
    {
      name: "public",
      testMatch: [
        /auth\/.+\.spec\.ts/,
        /storefront\/.+\.spec\.ts/,
        /auth-responsive\.spec\.ts/,
        /auth-a11y\.spec\.ts/,
        /address-autocomplete\.spec\.ts/,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    // Admin tests that need authentication (skipped without real backend)
    ...(hasRealBackend
      ? [
          {
            name: "admin",
            dependencies: ["setup"],
            testMatch: [
              /admin\/.+\.spec\.ts/,
              /cms\/.+\.spec\.ts/,
              /navigation\/.+\.spec\.ts/,
              /admin-responsive\.spec\.ts/,
              /admin-a11y\.spec\.ts/,
            ],
            use: {
              ...devices["Desktop Chrome"],
              storageState: ADMIN_STORAGE_STATE,
            },
          },
        ]
      : []),
  ],
  webServer: {
    // A production server in CI, a dev server locally.
    //
    // Turbopack compiles each route the first time it is requested, and in dev
    // that costs ten to twenty seconds — longer than most of these tests are
    // allowed to live. It produced failures that looked like defects and were
    // not: `/dashboard` refused to redirect an anonymous visitor within 15 s on
    // a cold server, and redirected in 4.6 s on the next run. Every one of
    // those "failures" disappeared on a second pass.
    //
    // CI already runs `pnpm build`, so it should serve that build rather than
    // recompile page by page. `E2E_USE_BUILD=true` gets the same locally.
    command:
      process.env.CI || process.env.E2E_USE_BUILD === "true"
        ? "pnpm start"
        : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([, v]) => v !== undefined
      ) as [string, string][]
    ),
  },
})
