import { test, expect } from "@playwright/test"
import { collectConsoleErrors } from "../helpers/console.helpers"
import { waitForAdminPage } from "../helpers/navigation.helpers"
import {
  waitForDialog,
  closeDialogByEscape,
  getDialog,
} from "../helpers/dialog.helpers"

const CAMPAIGNS_URL = "/email/campaigns"

test.describe("Email Campaigns Page", () => {
  test.describe("Page Structure", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(CAMPAIGNS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should display heading", async ({ page }) => {
      await expect(
        page.getByRole("heading", { level: 1, name: "Campagnes" })
      ).toBeVisible({ timeout: 15_000 })
    })

    test('should display "Nouvelle campagne" button', async ({ page }) => {
      await expect(
        page.getByRole("button", { name: "Nouvelle campagne" })
      ).toBeVisible({ timeout: 15_000 })
    })

    test("should display search input", async ({ page }) => {
      await expect(
        page.getByPlaceholder("Rechercher une campagne...")
      ).toBeVisible({ timeout: 15_000 })
    })

    test("should display status filter", async ({ page }) => {
      await expect(
        page.getByRole("combobox").filter({ hasText: "Tous les statuts" })
      ).toBeVisible({ timeout: 15_000 })
    })

    test("should display table or empty state", async ({ page }) => {
      const table = page.locator("table")
      const emptyState = page.getByText("Aucune campagne")

      await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 })
    })
  })

  test.describe("Campaign Wizard", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(CAMPAIGNS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should open wizard dialog when clicking create button", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: "Nouvelle campagne" })
        .click()

      const dialog = await waitForDialog(page)
      await expect(dialog.getByText("Nouvelle campagne")).toBeVisible()
    })

    test("should display wizard steps", async ({ page }) => {
      await page
        .getByRole("button", { name: "Nouvelle campagne" })
        .click()

      const dialog = await waitForDialog(page)

      // First step should show information fields
      await expect(dialog.getByText("Informations")).toBeVisible()
    })

    test("should display form fields in first step", async ({ page }) => {
      await page
        .getByRole("button", { name: "Nouvelle campagne" })
        .click()

      const dialog = await waitForDialog(page)

      await expect(dialog.getByLabel(/Nom de la campagne/)).toBeVisible()
      await expect(dialog.getByLabel(/Objet/)).toBeVisible()
    })

    test("should close wizard on Escape", async ({ page }) => {
      await page
        .getByRole("button", { name: "Nouvelle campagne" })
        .click()

      await waitForDialog(page)
      await closeDialogByEscape(page)

      await expect(getDialog(page)).toBeHidden()
    })
  })

  test.describe("Search & Filter", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(CAMPAIGNS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
    })

    test("should filter campaigns by search", async ({ page }) => {
      const searchInput = page.getByPlaceholder("Rechercher une campagne...")
      await expect(searchInput).toBeVisible({ timeout: 15_000 })

      await searchInput.fill("test")
      await page.waitForTimeout(1_000)

      await expect(
        page.getByRole("heading", { name: "Campagnes", level: 1 })
      ).toBeVisible()
    })

    test("should clear search", async ({ page }) => {
      const searchInput = page.getByPlaceholder("Rechercher une campagne...")
      await expect(searchInput).toBeVisible({ timeout: 15_000 })

      await searchInput.fill("test")
      await page.waitForTimeout(500)
      await searchInput.clear()
      await page.waitForTimeout(500)

      await expect(
        page.getByRole("heading", { name: "Campagnes", level: 1 })
      ).toBeVisible()
    })
  })

  test.describe("Console Errors", () => {
    test("should not produce unexpected console errors", async ({ page }) => {
      const { getErrors, cleanup } = collectConsoleErrors(page)

      await page.goto(CAMPAIGNS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      })
      await waitForAdminPage(page)
      await page.waitForTimeout(3_000)

      cleanup()

      const errors = getErrors()
      expect(errors).toEqual([])
    })
  })
})
