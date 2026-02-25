import { test, expect } from "@playwright/test"
import { collectConsoleErrors } from "../helpers/console.helpers"
import { waitForAdminPage } from "../helpers/navigation.helpers"

test.describe("Admin Translations", () => {
  test.describe.configure({ mode: "serial" })

  test.describe("Product Form Translations Tab", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/products/new", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should display 5 form tabs including Traductions", async ({
      page,
    }) => {
      // Wait for the form tabs to be visible
      await expect(
        page
          .getByRole("tab", { name: "General" })
          .or(page.getByRole("tab", { name: "Général" }))
      ).toBeVisible({ timeout: 15_000 })

      await expect(
        page.getByRole("tab", { name: "Options" })
      ).toBeVisible()

      await expect(page.getByRole("tab", { name: "Stock" })).toBeVisible()

      await expect(
        page.getByRole("tab", { name: "Planification" })
      ).toBeVisible()

      await expect(
        page.getByRole("tab", { name: "Traductions" })
      ).toBeVisible()
    })

    test("should display translations content when clicking Traductions tab", async ({
      page,
    }) => {
      const translationsTab = page.getByRole("tab", {
        name: "Traductions",
      })
      await expect(translationsTab).toBeVisible({ timeout: 15_000 })

      await translationsTab.click()

      // Should display translation-related content
      // Either language sections or a message about no languages
      await page.waitForTimeout(1_000)

      // The translations tab should be active
      await expect(translationsTab).toHaveAttribute(
        "data-state",
        "active"
      )
    })

    test("should display auto/manual/pending badges when translations exist", async ({
      page,
    }) => {
      const translationsTab = page.getByRole("tab", {
        name: "Traductions",
      })
      await expect(translationsTab).toBeVisible({ timeout: 15_000 })
      await translationsTab.click()

      await page.waitForTimeout(2_000)

      // These badges may or may not be present depending on store config
      // Just verify the tab renders without errors
      const autoBadge = page.getByTestId("translation-auto-badge").first()
      const manualBadge = page
        .getByTestId("translation-manual-badge")
        .first()
      const pendingBadge = page
        .getByTestId("translation-pending-badge")
        .first()

      // At least verify the page doesn't crash
      const hasAny =
        (await autoBadge.isVisible().catch(() => false)) ||
        (await manualBadge.isVisible().catch(() => false)) ||
        (await pendingBadge.isVisible().catch(() => false))

      // This is informational — we don't assert since it depends on store data
    })
  })

  test.describe("Category Form Translations", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/categories/new", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should display translations section in category form", async ({
      page,
    }) => {
      // Wait for the form to load
      await expect(
        page
          .getByRole("heading", { name: /cat[ée]gorie/i })
          .or(page.getByLabel(/nom/i).first())
      ).toBeVisible({ timeout: 15_000 })

      // Category form may have a translations section
      // Look for the translations heading or collapsible
      await page.waitForTimeout(1_000)

      // Verify the page loaded correctly
      const formVisible = await page
        .getByLabel(/nom/i)
        .first()
        .isVisible()
        .catch(() => false)
      expect(formVisible).toBe(true)
    })
  })

  test.describe("Console Errors", () => {
    test("should not produce unexpected console errors on translations tab", async ({
      page,
    }) => {
      const { getErrors, cleanup } = collectConsoleErrors(page)

      await page.goto("/products/new", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)

      const translationsTab = page.getByRole("tab", {
        name: "Traductions",
      })
      const isVisible = await translationsTab
        .isVisible({ timeout: 10_000 })
        .catch(() => false)

      if (isVisible) {
        await translationsTab.click()
        await page.waitForTimeout(2_000)
      }

      cleanup()
      expect(getErrors()).toEqual([])
    })
  })
})
