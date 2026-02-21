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
 */

const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json"

setup("authenticate as admin", async ({ page }) => {
  // Wait for full network idle to ensure Convex backend is connected
  await page.goto("/sign-in", {
    waitUntil: "networkidle",
    timeout: 60_000,
  })

  await expect(
    page.getByRole("heading", { name: "Connexion" })
  ).toBeVisible({ timeout: 30_000 })

  // Extra wait for Convex WebSocket connection to stabilize
  await page.waitForLoadState("networkidle")

  await page.getByLabel("Email").fill("test.owner@beindigital.fr")
  await page.getByLabel("Mot de passe").fill("julien")

  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 })

  await page.context().storageState({ path: ADMIN_STORAGE_STATE })
})
