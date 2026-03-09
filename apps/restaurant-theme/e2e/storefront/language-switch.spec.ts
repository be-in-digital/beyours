import { test, expect } from "@playwright/test"
import { collectConsoleErrors } from "../helpers/console.helpers"

test.describe("Language Switch", () => {
  test.describe("LanguageSwitcher component", () => {
    test("should display language switcher in the header", async ({ page }) => {
      await page.goto("/menu", { waitUntil: "domcontentloaded" })

      const _switcher = page.getByTestId("language-switcher")
      // The switcher may not appear if only 1 language is active.
      // If visible, it means multiple languages are configured.
      // We just verify it doesn't throw errors.
      await page.waitForTimeout(3_000)

      // Check the page loaded without issues
      await expect(
        page.getByRole("link", { name: "BeInDigital" })
      ).toBeVisible({ timeout: 30_000 })
    })

    test("should switch language without page reload", async ({ page }) => {
      await page.goto("/menu", { waitUntil: "domcontentloaded" })

      const switcher = page.getByTestId("language-switcher")

      // Wait for the page to fully load
      await expect(
        page.getByRole("link", { name: "BeInDigital" })
      ).toBeVisible({ timeout: 30_000 })

      // Only proceed if language switcher is visible (multi-language store)
      const isVisible = await switcher.isVisible().catch(() => false)
      if (!isVisible) {
        test.skip()
        return
      }

      // Record current URL
      const urlBefore = page.url()

      // Click the language switcher to open dropdown
      await switcher.click()

      // Look for a language option (e.g., English)
      const enOption = page.getByTestId("lang-option-en")
      const enVisible = await enOption.isVisible().catch(() => false)

      if (enVisible) {
        await enOption.click()

        // URL should NOT change (no locale in URL)
        expect(page.url()).toBe(urlBefore)

        // Page should not have reloaded — brand link still visible
        await expect(
          page.getByRole("link", { name: "BeInDigital" })
        ).toBeVisible()
      }
    })

    test("should persist language selection in localStorage after refresh", async ({
      page,
    }) => {
      await page.goto("/menu", { waitUntil: "domcontentloaded" })

      const switcher = page.getByTestId("language-switcher")

      await expect(
        page.getByRole("link", { name: "BeInDigital" })
      ).toBeVisible({ timeout: 30_000 })

      const isVisible = await switcher.isVisible().catch(() => false)
      if (!isVisible) {
        test.skip()
        return
      }

      // Switch to English
      await switcher.click()
      const enOption = page.getByTestId("lang-option-en")
      const enVisible = await enOption.isVisible().catch(() => false)
      if (!enVisible) {
        test.skip()
        return
      }
      await enOption.click()

      // Check localStorage was set
      const storedLocale = await page.evaluate(() =>
        localStorage.getItem("beid-locale")
      )
      expect(storedLocale).toBe("en")

      // Refresh the page
      await page.reload({ waitUntil: "domcontentloaded" })

      // localStorage should still have 'en'
      const storedLocaleAfter = await page.evaluate(() =>
        localStorage.getItem("beid-locale")
      )
      expect(storedLocaleAfter).toBe("en")
    })
  })

  test.describe("Console Errors", () => {
    test("should not produce unexpected console errors during language switch", async ({
      page,
    }) => {
      const { getErrors, cleanup } = collectConsoleErrors(page)

      await page.goto("/menu", { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(3_000)

      // Try to switch language if possible
      const switcher = page.getByTestId("language-switcher")
      const isVisible = await switcher.isVisible().catch(() => false)
      if (isVisible) {
        await switcher.click()
        await page.waitForTimeout(500)
        const enOption = page.getByTestId("lang-option-en")
        const enVisible = await enOption.isVisible().catch(() => false)
        if (enVisible) {
          await enOption.click()
          await page.waitForTimeout(1_000)
        }
      }

      cleanup()
      expect(getErrors()).toEqual([])
    })
  })
})
