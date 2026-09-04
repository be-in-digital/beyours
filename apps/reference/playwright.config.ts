import { defineConfig, devices } from "@playwright/test"
import { loadEnvFiles } from "./e2e/load-env"

loadEnvFiles(__dirname, [".env.e2e", ".env.local"])

const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json"

/**
 * The port the suite drives, and the port the server it starts listens on.
 *
 * Two runs on one machine used to fight over 3000: the second reused the first
 * one's server (`reuseExistingServer`) and drove a build of somebody else's
 * branch. `E2E_PORT` gives a run its own. `BETTER_AUTH_URL` and `SITE_URL` have
 * to agree with it — sign-in posts to the origin they name.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

// Admin/setup projects require a real Convex backend (not placeholder URLs).
// In CI with placeholder URLs we only run the "public" project.
//
// Spelled out rather than `!url?.includes("placeholder")`: that reads as "no
// placeholder, so a real backend", but on an UNSET variable it is `!undefined`
// — true — and claims a backend that was never configured. Unset is the one
// case where we know there is nothing to talk to.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
const hasRealBackend = convexUrl !== "" && !convexUrl.includes("placeholder")

// Dropping 43 of 56 spec files should never be silent. The projects below are
// spread out of the array when there is no backend, so they are not reported as
// skipped — they are absent, and the run looks complete. Say so here, and let
// scripts/assert-e2e-ran.mjs fail the job on it in CI.
if (!hasRealBackend) {
  console.warn(
    `[e2e] NEXT_PUBLIC_CONVEX_URL is ${convexUrl === "" ? "unset" : `"${convexUrl}"`} — ` +
      `the "setup" and "admin" projects are NOT declared. Only public tests will run.`
  )
}

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
  // JSON alongside HTML: the HTML report is for a human opening the artifact,
  // the JSON is what scripts/assert-e2e-ran.mjs reads to prove tests actually
  // ran. Playwright exits 0 over an empty run, so something has to count.
  reporter: [["html"], ["json", { outputFile: "playwright-report/report.json" }]],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: BASE_URL,
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
        // The player route is unauthenticated by design: a customer scans a
        // table QR code and plays. It belongs in this project, not `admin`.
        /game\/.+\.spec\.ts/,
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
        ? `pnpm start --port ${PORT}`
        : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([, v]) => v !== undefined
      ) as [string, string][]
    ),
  },
})
