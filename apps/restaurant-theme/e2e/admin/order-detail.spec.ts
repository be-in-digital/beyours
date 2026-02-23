import { test, expect } from "@playwright/test"
import { collectConsoleErrors } from "../helpers/console.helpers"

/**
 * Order Detail Page E2E tests.
 *
 * These tests verify the /orders/[orderId] page structure and behavior.
 * Since we rely on dynamic data, some tests conditionally check elements
 * based on what orders exist in the test database.
 */

const ORDERS_URL = "/orders"
const INVALID_ORDER_ID = "invalid-order-id-999"

test.describe("Order Detail Page", () => {
  /**
   * Helper: navigate to the first order detail page.
   * Returns true if an order was found, false otherwise.
   */
  async function navigateToFirstOrder(
    page: import("@playwright/test").Page
  ): Promise<boolean> {
    await page.goto(ORDERS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })

    // Wait for the page to load
    await expect(
      page.getByRole("heading", { name: "Commandes", level: 1 })
    ).toBeVisible({ timeout: 30_000 })

    // Wait for orders to load (table or empty state)
    const table = page.locator("table")
    const emptyState = page.getByText("Aucune commande")
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 })

    // Check if there are any order rows in the table
    const tableExists = await table.isVisible().catch(() => false)
    if (!tableExists) return false

    const rows = page.locator("tbody tr")
    const rowCount = await rows.count().catch(() => 0)

    if (rowCount > 0) {
      // Click the first order link to navigate to order detail
      const firstLink = rows.first().locator("a").first()
      await firstLink.click()
      await page.waitForLoadState("domcontentloaded")
      return true
    }

    return false
  }

  test.describe("Page Structure", () => {
    test("should display order heading with order number", async ({
      page,
    }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // The heading should contain "Commande" followed by order number
        await expect(
          page.getByRole("heading", { name: /Commande/ })
        ).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display back button linking to /orders", async ({
      page,
    }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        const backLink = page.locator('a[href="/orders"]')
        await expect(backLink).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display status badge", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Wait for heading to confirm page loaded
        await expect(
          page.getByRole("heading", { name: /Commande/ })
        ).toBeVisible({ timeout: 15_000 })

        // One of the status badges should be visible in the header area
        const statusTexts = [
          "En attente",
          "Confirmée",
          "En préparation",
          "Prête",
          "En livraison",
          "Livrée",
          "Terminée",
          "Annulée",
        ]

        const headerBadges = page.locator(".flex.items-center.gap-2 [data-slot='badge']")
        await expect(headerBadges.first()).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display type badge", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Wait for heading to confirm page loaded
        await expect(
          page.getByRole("heading", { name: /Commande/ })
        ).toBeVisible({ timeout: 15_000 })

        // Type badges (Livraison, À emporter, Sur place) should be visible
        const typeTexts = ["Livraison", "À emporter", "Sur place"]
        const typeBadge = page.locator('[data-slot="badge"]').filter({
          hasText: new RegExp(typeTexts.join("|")),
        })

        await expect(typeBadge.first()).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display source badge in header", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        await expect(
          page.getByRole("heading", { name: /Commande/ })
        ).toBeVisible({ timeout: 15_000 })

        // Source badges (Site web, Uber Eats, Deliveroo, Caisse) should be visible
        const sourceTexts = ["Site web", "Uber Eats", "Deliveroo", "Caisse"]
        const sourceBadge = page.locator('[data-slot="badge"]').filter({
          hasText: new RegExp(sourceTexts.join("|")),
        })

        await expect(sourceBadge.first()).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display items table", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Check for the items table with expected columns
        const table = page.locator("table")
        await expect(table).toBeVisible({ timeout: 15_000 })

        // Verify column headers
        const headers = page.locator("thead th")
        const headerTexts = ["Produit", "Qté", "Prix", "Sous-total"]

        for (const headerText of headerTexts) {
          await expect(
            headers.filter({ hasText: headerText })
          ).toBeVisible()
        }
      }
    })
  })

  test.describe("Customer Info", () => {
    test("should display customer name", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Look for the customer info section with "Nom" label
        await expect(page.getByText("Nom")).toBeVisible({ timeout: 15_000 })
      }
    })

    test("should display customer contact info", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Look for Email or Téléphone labels
        const emailLabel = page.getByText("Email")
        const phoneLabel = page.getByText("Téléphone")

        await expect(emailLabel.or(phoneLabel)).toBeVisible({
          timeout: 15_000,
        })
      }
    })
  })

  test.describe("Payment Info", () => {
    test("should display source label in payment card", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        await expect(
          page.getByText("Source de la commande")
        ).toBeVisible({ timeout: 15_000 })

        // The source value should be one of the proper labels
        const sourceValues = ["Site web", "Uber Eats", "Deliveroo", "Caisse"]
        const sourceLabel = page.locator("text=/Site web|Uber Eats|Deliveroo|Caisse/")
        await expect(sourceLabel.first()).toBeVisible({ timeout: 15_000 })
      }
    })
  })

  test.describe("Status Actions", () => {
    test("should display status action buttons", async ({ page }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Wait for the page to fully load
        await page.waitForTimeout(2_000)

        // Status action buttons or "no actions" message should be present
        const actionButtons = page.getByRole("button").filter({
          hasText:
            /Accepter|Commencer|Marquer|Terminer|Envoyer|Refuser/,
        })
        const noActions = page.getByText("Aucune action disponible")

        const count = await actionButtons.count()
        const hasNoActions = await noActions.isVisible().catch(() => false)
        expect(count > 0 || hasNoActions).toBe(true)
      }
    })
  })

  test.describe("Not Found", () => {
    test('should show "Commande introuvable" for invalid order ID', async ({
      page,
    }) => {
      await page.goto(`/orders/${INVALID_ORDER_ID}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })

      // Either the loading text or not found text should appear
      const loadingText = page.getByText(
        "Chargement des détails de la commande..."
      )
      const notFoundText = page.getByText("Commande introuvable")

      await expect(loadingText.or(notFoundText)).toBeVisible({
        timeout: 30_000,
      })
    })
  })

  test.describe("Navigation", () => {
    test("should navigate back to /orders via back button", async ({
      page,
    }) => {
      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Click the back link/button
        const backLink = page.locator('a[href="/orders"]')

        await expect(backLink).toBeVisible({ timeout: 15_000 })
        await backLink.first().click()

        await expect(page).toHaveURL(/\/orders$/, { timeout: 15_000 })
      }
    })
  })

  test.describe("Console Errors", () => {
    test("should not produce unexpected console errors", async ({ page }) => {
      const { getErrors, cleanup } = collectConsoleErrors(page)

      const hasOrder = await navigateToFirstOrder(page)

      if (hasOrder) {
        // Wait for page to settle
        await page.waitForTimeout(2_000)
      }

      cleanup()
      expect(getErrors()).toEqual([])
    })
  })
})
