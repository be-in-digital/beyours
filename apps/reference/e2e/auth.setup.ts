import { test as setup, expect } from "@playwright/test"

/**
 * Authentication setup for admin E2E tests.
 *
 * Logs in as the test admin user (client_admin role) and saves the
 * browser storage state so subsequent tests can reuse the session.
 *
 * Requires:
 *   - A running Convex backend with seeded users (npx tsx scripts/seed-users.mts)
 *   - NEXT_PUBLIC_CONVEX_URL in .env.local
 *   - SEED_PASSWORD, the same value the seed script used
 */

const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json"

/** The account `scripts/seed-users.mts` creates with the `client_admin` role. */
const ADMIN_EMAIL = "test.owner@beindigital.fr"

/**
 * The seeded password, which only the environment knows.
 *
 * This file used to carry a literal — and not even the right one, since
 * `seed-users.mts` reads `SEED_PASSWORD`. So the setup only ever worked on a
 * machine where the two happened to agree, and failed with "wrong credentials"
 * everywhere else. The seed script's own comment says it: never hardcode a
 * password, not even a throwaway.
 */
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? ""

setup("authenticate as admin", async ({ page }) => {
  // Fail here, with the reason, rather than thirty seconds later on a login
  // form that simply refused an empty password.
  expect(
    ADMIN_PASSWORD,
    "SEED_PASSWORD is not set — run the seed script and export the same value"
  ).not.toBe("")

  // Wait for full network idle to ensure Convex backend is connected
  await page.goto("/sign-in", {
    waitUntil: "networkidle",
    timeout: 60_000,
  })

  await expect(
    page.getByText("Bon retour").or(page.getByRole("heading", { name: "Connexion" }))
  ).toBeVisible({ timeout: 30_000 })

  // Wait for Next.js compilation to finish (dev mode indicator)
  const compilingIndicator = page.getByText("Compiling")
  try {
    await compilingIndicator.waitFor({ state: "hidden", timeout: 30_000 })
  } catch {
    // Indicator may not appear if already compiled
  }

  // Extra wait for Convex WebSocket connection to stabilize
  await page.waitForLoadState("networkidle")

  // Fill credentials using input IDs (labels are ambiguous due to "Mot de passe oublié" link)
  await page.locator("#email").fill(ADMIN_EMAIL)
  await page.locator("#password").fill(ADMIN_PASSWORD)

  await page.getByRole("button", { name: /se connecter/i }).click()

  // Wait for auth API response before checking URL
  await page.waitForLoadState("networkidle", { timeout: 30_000 })

  // After login, the app redirects to /menu or /dashboard
  await expect(page).toHaveURL(/\/(dashboard|menu)/, { timeout: 60_000 })

  await page.context().storageState({ path: ADMIN_STORAGE_STATE })
})
