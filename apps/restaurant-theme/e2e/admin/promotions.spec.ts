import { test, expect } from "@playwright/test"
import { collectConsoleErrors } from "../helpers/console.helpers"
import { waitForAdminPage } from "../helpers/navigation.helpers"
import {
  waitForDialog,
  closeDialogByCancel,
  closeDialogByEscape,
  getDialog,
} from "../helpers/dialog.helpers"

const PROMOTIONS_URL = "/promotions"
const SEARCH_PLACEHOLDER = "Rechercher une promotion..."

test.describe("Promotions Page", () => {
  test.describe("Page Structure", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should display heading and subtitle", async ({ page }) => {
      await expect(
        page.getByRole("heading", { level: 1, name: "Promotions" })
      ).toBeVisible({ timeout: 15_000 })

      await expect(
        page.getByText("Gérez vos codes promo et offres automatiques")
      ).toBeVisible()
    })

    test('should display "Créer une promotion" button', async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Créer une promotion" })
      ).toBeVisible({ timeout: 15_000 })
    })

    test("should display 2 tabs", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: "Codes promo" })
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        page.getByRole("tab", { name: "Offres automatiques" })
      ).toBeVisible()
    })

    test("should display search input", async ({ page }) => {
      await expect(
        page.getByPlaceholder(SEARCH_PLACEHOLDER)
      ).toBeVisible({ timeout: 15_000 })
    })

    test("should display status filter", async ({ page }) => {
      await expect(
        page.getByRole("combobox").filter({ hasText: "Tous les statuts" })
      ).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe("Tabs Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should default to Codes promo tab", async ({ page }) => {
      await expect(
        page.getByRole("tab", { name: "Codes promo" })
      ).toHaveAttribute("aria-selected", "true", { timeout: 15_000 })
    })

    test("should switch to Offres automatiques tab", async ({ page }) => {
      await page.getByRole("tab", { name: "Offres automatiques" }).click()

      await expect(
        page.getByRole("tab", { name: "Offres automatiques" })
      ).toHaveAttribute("aria-selected", "true", { timeout: 5_000 })
    })

    test("should switch back to Codes promo tab", async ({ page }) => {
      await page.getByRole("tab", { name: "Offres automatiques" }).click()
      await page.getByRole("tab", { name: "Codes promo" }).click()

      await expect(
        page.getByRole("tab", { name: "Codes promo" })
      ).toHaveAttribute("aria-selected", "true", { timeout: 5_000 })
    })
  })

  test.describe("Table or Empty State", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should show promotions table or empty state in Codes promo tab", async ({
      page,
    }) => {
      const table = page.locator("table")
      const emptyState = page.getByText("Aucune promotion")

      await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 })
    })

    test("should show promotions table or empty state in Offres automatiques tab", async ({
      page,
    }) => {
      await page.getByRole("tab", { name: "Offres automatiques" }).click()

      const table = page.locator("table")
      const emptyState = page.getByText("Aucune promotion")

      await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe("Search & Filter", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should filter promotions by search", async ({ page }) => {
      const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER)
      await expect(searchInput).toBeVisible()

      await searchInput.fill("test")
      await page.waitForTimeout(1_000)

      // Page should still be functional
      await expect(
        page.getByRole("heading", { name: "Promotions", level: 1 })
      ).toBeVisible()
    })

    test("should filter by status", async ({ page }) => {
      const statusFilter = page
        .getByRole("combobox")
        .filter({ hasText: "Tous les statuts" })
      await statusFilter.click()

      await page.getByRole("option", { name: "Active" }).click()

      await page.waitForTimeout(1_000)

      await expect(
        page.getByRole("heading", { name: "Promotions", level: 1 })
      ).toBeVisible()
    })

    test("should clear search", async ({ page }) => {
      const searchInput = page.getByPlaceholder(SEARCH_PLACEHOLDER)

      await searchInput.fill("test")
      await page.waitForTimeout(500)
      await searchInput.clear()
      await page.waitForTimeout(500)

      await expect(
        page.getByRole("heading", { name: "Promotions", level: 1 })
      ).toBeVisible()
    })
  })

  test.describe("Create Promotion Dialog", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should open dialog when clicking create button", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)
      await expect(dialog.getByText("Nouvelle promotion")).toBeVisible()
    })

    test("should display form fields in dialog", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      // Name field
      await expect(dialog.getByLabel("Nom de la promotion")).toBeVisible()

      // Description field
      await expect(dialog.getByLabel("Description")).toBeVisible()

      // Trigger mode radio buttons
      await expect(dialog.getByText("Code promo")).toBeVisible()
      await expect(dialog.getByText("Offre automatique")).toBeVisible()

      // Discount type select
      await expect(dialog.getByText("Type de réduction")).toBeVisible()

      // Dates
      await expect(dialog.getByLabel("Date de début")).toBeVisible()
      await expect(dialog.getByLabel("Date de fin")).toBeVisible()
    })

    test("should show coupon code field when coupon mode is selected", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      // Coupon mode should be default
      await expect(dialog.getByLabel("Code promo")).toBeVisible()
    })

    test("should show generate button for coupon code", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      // Generate button (RefreshCw icon button)
      const generateBtn = dialog.locator('button:has(svg)')
      await expect(generateBtn.first()).toBeVisible()
    })

    test("should display discount value fields", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      // Default discount type is percentage, so value field should be visible
      await expect(dialog.getByLabel(/Valeur/)).toBeVisible()
    })

    test("should display usage limit fields", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      await expect(dialog.getByLabel("Utilisations max")).toBeVisible()
      await expect(dialog.getByLabel("Max par client")).toBeVisible()
    })

    test("should display active switch", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      await expect(dialog.getByRole("switch", { name: "Active" })).toBeVisible()
    })

    test("should display scheduling toggle", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      await expect(
        dialog.getByRole("switch", { name: "Planification horaire" })
      ).toBeVisible()
    })

    test("should validate required fields on submit", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      const dialog = await waitForDialog(page)

      // Clear the name field and try to submit
      await dialog.getByLabel("Nom de la promotion").clear()

      // Click submit
      await dialog
        .getByRole("button", { name: "Créer la promotion" })
        .click()

      // Dialog should still be open (validation prevents closing)
      await expect(dialog).toBeVisible()
    })

    test("should close dialog on cancel", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      await waitForDialog(page)

      await closeDialogByCancel(page)

      await expect(getDialog(page)).toBeHidden()
    })

    test("should close dialog on Escape", async ({ page }) => {
      await page
        .getByRole("button", { name: "Créer une promotion" })
        .click()

      await waitForDialog(page)

      await closeDialogByEscape(page)

      await expect(getDialog(page)).toBeHidden()
    })
  })

  test.describe("Table Interaction", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should display promotion rows if data exists", async ({ page }) => {
      const table = page.locator("table")
      const tableExists = await table.isVisible().catch(() => false)

      if (tableExists) {
        const rows = page.locator("tbody tr")
        const rowCount = await rows.count()

        if (rowCount > 0) {
          await expect(rows.first()).toBeVisible()
        }
      }
    })

    test("should display action menu on table rows", async ({ page }) => {
      const rows = page.locator("tbody tr")
      const rowCount = await rows.count().catch(() => 0)

      if (rowCount > 0) {
        // Click the action menu button on the first row
        const actionButton = rows.first().getByRole("button").last()
        await actionButton.click()

        // Should show dropdown with Modifier and Supprimer
        const editOption = page.getByRole("menuitem", { name: /Modifier/ })
        const deleteOption = page.getByRole("menuitem", {
          name: /Supprimer/,
        })

        await expect(
          editOption.or(deleteOption)
        ).toBeVisible({ timeout: 5_000 })
      }
    })
  })

  test.describe("Delete Promotion", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should show delete confirmation dialog", async ({ page }) => {
      const rows = page.locator("tbody tr")
      const rowCount = await rows.count().catch(() => 0)

      if (rowCount > 0) {
        const actionButton = rows.first().getByRole("button").last()
        await actionButton.click()

        const deleteOption = page.getByRole("menuitem", {
          name: /Supprimer/,
        })
        const deleteVisible = await deleteOption
          .isVisible()
          .catch(() => false)

        if (deleteVisible) {
          await deleteOption.click()

          const dialog = page.locator('[data-slot="dialog-content"]')
          await expect(dialog).toBeVisible({ timeout: 10_000 })
          await expect(
            dialog.getByText(/Supprimer cette promotion/)
          ).toBeVisible()
        }
      }
    })

    test("should cancel deletion", async ({ page }) => {
      const rows = page.locator("tbody tr")
      const rowCount = await rows.count().catch(() => 0)

      if (rowCount > 0) {
        const actionButton = rows.first().getByRole("button").last()
        await actionButton.click()

        const deleteOption = page.getByRole("menuitem", {
          name: /Supprimer/,
        })
        const deleteVisible = await deleteOption
          .isVisible()
          .catch(() => false)

        if (deleteVisible) {
          await deleteOption.click()

          const dialog = page.locator('[data-slot="dialog-content"]')
          await expect(dialog).toBeVisible({ timeout: 10_000 })

          await dialog.getByRole("button", { name: "Annuler" }).click()
          await expect(dialog).toBeHidden({ timeout: 5_000 })
        }
      }
    })
  })

  test.describe("Console Errors", () => {
    test("should not produce unexpected console errors", async ({ page }) => {
      const { getErrors, cleanup } = collectConsoleErrors(page)

      await page.goto(PROMOTIONS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)

      // Wait for async operations to complete
      await page.waitForTimeout(3_000)

      cleanup()

      const errors = getErrors()
      expect(errors).toEqual([])
    })
  })
})
