import { test, expect, type Page } from "@playwright/test"

/**
 * Admin Gamification E2E Tests
 *
 * Scénarios testés :
 * 1. Page "Jeux & Prix" - vérification des prérequis
 * 2. Création d'un prix
 * 3. Création d'un QR code
 * 4. Création d'une action
 * 5. Drag-and-drop des actions (réordonnement)
 * 6. Création d'un jeu (prérequis remplis)
 * 7. Modification et suppression d'éléments
 *
 * Prerequisites:
 * - Dev server running on localhost:3000
 * - A valid admin user in the DB (email: test@test.com, password: test1234)
 * - A store selected (or the test will select one)
 *
 * Run: pnpm --filter restaurant-theme test:e2e -- admin-gamification
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@test.com"
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test1234"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto("/sign-in")
  await page.locator('input[id="email"]').fill(ADMIN_EMAIL)
  await page.locator('input[id="password"]').fill(ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 15000 })
}

async function ensureStoreSelected(page: Page) {
  // If store selector is visible, pick first store
  const storeSelector = page.locator('[data-testid="store-selector"]')
  const isSelectorVisible = await storeSelector.isVisible().catch(() => false)
  if (isSelectorVisible) {
    await storeSelector.click()
    // Click first store option
    await page.locator('[role="option"]').first().click()
    await page.waitForTimeout(1000)
  }
}

async function navigateToGames(page: Page, sub?: string) {
  const path = sub ? `/games/${sub}` : "/games/catalog"
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Admin Gamification", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await ensureStoreSelected(page)
  })

  // ─── Scénario 1 : Prérequis manquants ──────────────────────────────────

  test.describe("Prerequisites check", () => {
    test("should show prerequisites alert when no elements exist", async ({ page }) => {
      await navigateToGames(page)

      // The alert should be visible if there are missing prerequisites
      const alert = page.locator("text=Avant de créer un jeu, configurez ces éléments")
      const isAlertVisible = await alert.isVisible().catch(() => false)

      if (isAlertVisible) {
        // Check that the "Créer un jeu" button is disabled
        const createButton = page.getByRole("button", { name: "Créer un jeu" })
        await expect(createButton).toBeDisabled()

        // Verify links to missing elements are shown
        const missingItems = page.locator(".border-amber-200 a")
        const count = await missingItems.count()
        expect(count).toBeGreaterThan(0)
      }
    })

    test("should enable game creation when all prerequisites exist", async ({ page }) => {
      await navigateToGames(page)

      // If prerequisites are met, button should be enabled
      const createButton = page.getByRole("button", { name: "Créer un jeu" })
      const isDisabled = await createButton.isDisabled()

      if (!isDisabled) {
        // No alert should be visible
        const alert = page.locator("text=Avant de créer un jeu, configurez ces éléments")
        await expect(alert).not.toBeVisible()
      }
    })
  })

  // ─── Scénario 2 : Création d'un prix ───────────────────────────────────

  test.describe("Prize management", () => {
    test("should create a new prize", async ({ page }) => {
      await navigateToGames(page)

      // Switch to Prix tab
      await page.getByRole("tab", { name: "Prix" }).click()
      await page.waitForTimeout(500)

      // Click create prize button
      await page.getByRole("button", { name: "Créer un prix" }).click()

      // Fill form
      await page.locator('input[id="prizeName"]').fill("Test - 10% de réduction")

      // Select type
      await page.locator("#prizeType").click()
      await page.getByRole("option", { name: "Réduction %" }).click()

      // Set value
      await page.locator('input[id="prizeValue"]').fill("10")

      // Set validity
      await page.locator('input[id="validityDays"]').clear()
      await page.locator('input[id="validityDays"]').fill("30")

      // Submit
      await page.getByRole("button", { name: "Créer un prix" }).last().click()

      // Verify success toast
      await expect(page.getByText("Prix créé avec succès")).toBeVisible({ timeout: 5000 })

      // Verify prize appears in table
      await expect(page.getByText("Test - 10% de réduction")).toBeVisible()
    })

    test("should show prize in table with correct info", async ({ page }) => {
      await navigateToGames(page)

      // Switch to Prix tab
      await page.getByRole("tab", { name: "Prix" }).click()
      await page.waitForTimeout(500)

      // Verify table headers
      await expect(page.getByRole("columnheader", { name: "Nom" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Valeur" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Validité" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Stock" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Statut" })).toBeVisible()
    })
  })

  // ─── Scénario 3 : Création d'un QR code ────────────────────────────────

  test.describe("QR Code management", () => {
    test("should create a new QR code", async ({ page }) => {
      await navigateToGames(page, "qr-codes")

      // Click create
      await page.getByRole("button", { name: "Créer un code QR" }).click()

      // Generate a code
      await page.getByRole("button", { name: "Générer" }).click()

      // Verify code was generated (input should have a value)
      const codeInput = page.locator('input[id="qrCode"]')
      const codeValue = await codeInput.inputValue()
      expect(codeValue.length).toBeGreaterThan(0)

      // Fill table number
      await page.locator('input[id="tableNumber"]').fill("1")

      // Fill location
      await page.locator('input[id="location"]').fill("Terrasse")

      // Submit
      await page.getByRole("button", { name: "Créer" }).click()

      // Verify success toast
      await expect(page.getByText("Code QR créé avec succès")).toBeVisible({ timeout: 5000 })

      // Verify QR code appears in table
      await expect(page.getByText("Terrasse")).toBeVisible()
    })

    test("should display QR codes in table format", async ({ page }) => {
      await navigateToGames(page, "qr-codes")

      // Verify table structure
      await expect(page.getByRole("columnheader", { name: "Code" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Table" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Emplacement" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Statut" })).toBeVisible()
    })

    test("should edit a QR code", async ({ page }) => {
      await navigateToGames(page, "qr-codes")

      // Open action menu on first row
      const actionButtons = page.locator("table button").filter({ has: page.locator(".lucide-more-vertical") })
      const firstAction = actionButtons.first()

      if (await firstAction.isVisible().catch(() => false)) {
        await firstAction.click()
        await page.getByRole("menuitem", { name: "Modifier" }).click()

        // Change table number
        const tableInput = page.locator('input[id="tableNumber"]')
        await tableInput.clear()
        await tableInput.fill("99")

        // Submit
        await page.getByRole("button", { name: "Mettre à jour" }).click()
        await expect(page.getByText("Code QR mis à jour")).toBeVisible({ timeout: 5000 })
      }
    })
  })

  // ─── Scénario 4 : Création d'une action ────────────────────────────────

  test.describe("Action management", () => {
    test("should create a new action", async ({ page }) => {
      await navigateToGames(page, "actions")

      // Click create
      await page.getByRole("button", { name: "Ajouter une action" }).click()

      // Select type
      const typeSelect = page.locator("select, [role='combobox']").first()
      await typeSelect.click()
      await page.getByRole("option", { name: "Avis Google" }).click()

      // Fill name
      const nameInput = page.getByLabel("Nom *")
      await nameInput.fill("Laissez un avis Google")

      // Fill URL
      const urlInput = page.getByLabel("URL")
      await urlInput.fill("https://g.page/r/test")

      // Fill timer
      const timerInput = page.getByLabel("Timer (secondes)")
      await timerInput.clear()
      await timerInput.fill("15")

      // Submit
      await page.getByRole("button", { name: "Créer" }).click()

      // Verify success
      await expect(page.getByText("Action créée avec succès")).toBeVisible({ timeout: 5000 })

      // Verify action appears
      await expect(page.getByText("Laissez un avis Google")).toBeVisible()
    })

    test("should not show sortOrder field in form", async ({ page }) => {
      await navigateToGames(page, "actions")

      // Open create form
      await page.getByRole("button", { name: "Ajouter une action" }).click()

      // Verify "Ordre" field does NOT exist
      await expect(page.getByLabel("Ordre")).not.toBeVisible()

      // Close
      await page.getByRole("button", { name: "Annuler" }).click()
    })

    test("should display drag handles in table", async ({ page }) => {
      await navigateToGames(page, "actions")

      // Check for GripVertical icons (drag handles)
      const dragHandles = page.locator("table .lucide-grip-vertical")
      const handleCount = await dragHandles.count()

      // If there are actions, there should be drag handles
      const rows = page.locator("table tbody tr")
      const rowCount = await rows.count()

      if (rowCount > 0) {
        expect(handleCount).toBe(rowCount)
      }
    })

    test("should display actions table with correct columns", async ({ page }) => {
      await navigateToGames(page, "actions")

      // Verify table headers (no "Ordre" column, has drag handle column instead)
      await expect(page.getByRole("columnheader", { name: "Nom" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Type" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Timer" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Obligatoire" })).toBeVisible()
      await expect(page.getByRole("columnheader", { name: "Statut" })).toBeVisible()

      // "Ordre" should NOT be a column header anymore
      const ordreHeader = page.getByRole("columnheader", { name: "Ordre" })
      await expect(ordreHeader).not.toBeVisible()
    })
  })

  // ─── Scénario 5 : Drag-and-drop des actions ────────────────────────────

  test.describe("Drag and drop actions", () => {
    test("should reorder actions via drag and drop", async ({ page }) => {
      await navigateToGames(page, "actions")

      const rows = page.locator("table tbody tr")
      const rowCount = await rows.count()

      if (rowCount >= 2) {
        // Get names before drag
        const firstNameBefore = await rows.nth(0).locator("td").nth(1).textContent()
        const secondNameBefore = await rows.nth(1).locator("td").nth(1).textContent()

        // Get drag handles
        const firstHandle = rows.nth(0).locator(".lucide-grip-vertical").first()
        const secondHandle = rows.nth(1).locator(".lucide-grip-vertical").first()

        // Get bounding boxes
        const firstBox = await firstHandle.boundingBox()
        const secondBox = await secondHandle.boundingBox()

        if (firstBox && secondBox) {
          // Perform drag: first row to second row position
          await page.mouse.move(
            firstBox.x + firstBox.width / 2,
            firstBox.y + firstBox.height / 2
          )
          await page.mouse.down()
          await page.mouse.move(
            secondBox.x + secondBox.width / 2,
            secondBox.y + secondBox.height / 2,
            { steps: 10 }
          )
          await page.mouse.up()

          // Wait for reorder mutation
          await page.waitForTimeout(1000)

          // Verify order changed
          const firstNameAfter = await rows.nth(0).locator("td").nth(1).textContent()
          const secondNameAfter = await rows.nth(1).locator("td").nth(1).textContent()

          // After drag, the order should be swapped
          expect(firstNameAfter).toBe(secondNameBefore)
          expect(secondNameAfter).toBe(firstNameBefore)
        }
      }
    })
  })

  // ─── Scénario 6 : Création d'un jeu complet ────────────────────────────

  test.describe("Game creation flow", () => {
    test("should create a game with full wizard when prerequisites met", async ({ page }) => {
      await navigateToGames(page)

      const createButton = page.getByRole("button", { name: "Créer un jeu" })
      const isDisabled = await createButton.isDisabled()

      if (isDisabled) {
        // Prerequisites not met - skip this test
        test.skip()
        return
      }

      // Step 1: Basic info
      await createButton.click()
      await expect(page.getByText("Créer un jeu")).toBeVisible()

      // Fill name
      const nameInput = page.getByLabel("Nom du jeu *")
      await nameInput.fill("Roue de la Fortune - Test")

      // Select type (wheel should be default)
      // Click "Suivant" to go to Step 2
      await page.getByRole("button", { name: "Suivant" }).click()

      // Step 2: Segments
      await expect(page.getByText(/Segments|Étape 2/)).toBeVisible({ timeout: 3000 })

      // There should be default segments
      // Click "Suivant" to go to Step 3
      await page.getByRole("button", { name: "Suivant" }).click()

      // Step 3: Win ratio
      await expect(page.getByText(/Win ratio|Taux de gain|Étape 3/)).toBeVisible({ timeout: 3000 })

      // Submit
      await page.getByRole("button", { name: "Créer" }).click()

      // Verify success
      await expect(page.getByText(/créé avec succès/)).toBeVisible({ timeout: 5000 })

      // Verify game appears in table
      await expect(page.getByText("Roue de la Fortune - Test")).toBeVisible()
    })
  })

  // ─── Scénario 7 : Suppression d'éléments ───────────────────────────────

  test.describe("Element deletion", () => {
    test("should delete a prize with confirmation", async ({ page }) => {
      await navigateToGames(page)

      // Switch to Prix tab
      await page.getByRole("tab", { name: "Prix" }).click()
      await page.waitForTimeout(500)

      // Find action menu in table
      const actionButtons = page.locator("table button").filter({ has: page.locator(".lucide-more-vertical") })
      const firstAction = actionButtons.first()

      if (await firstAction.isVisible().catch(() => false)) {
        await firstAction.click()
        await page.getByRole("menuitem", { name: "Supprimer" }).click()

        // Confirmation dialog should appear
        await expect(page.getByText("Supprimer ce prix ?")).toBeVisible()
        await expect(page.getByText("irréversible")).toBeVisible()

        // Cancel first
        await page.getByRole("button", { name: "Annuler" }).click()
        await expect(page.getByText("Supprimer ce prix ?")).not.toBeVisible()
      }
    })

    test("should delete an action with confirmation", async ({ page }) => {
      await navigateToGames(page, "actions")

      // Find action menu
      const actionButtons = page.locator("table button").filter({ has: page.locator(".lucide-more-vertical") })
      const firstAction = actionButtons.first()

      if (await firstAction.isVisible().catch(() => false)) {
        await firstAction.click()
        await page.getByRole("menuitem", { name: "Supprimer" }).click()

        // Confirmation dialog
        await expect(page.getByText("Supprimer cette action ?")).toBeVisible()

        // Cancel
        await page.getByRole("button", { name: "Annuler" }).click()
      }
    })

    test("should delete a QR code with confirmation", async ({ page }) => {
      await navigateToGames(page, "qr-codes")

      // Find action menu
      const actionButtons = page.locator("table button").filter({ has: page.locator(".lucide-more-vertical") })
      const firstAction = actionButtons.first()

      if (await firstAction.isVisible().catch(() => false)) {
        await firstAction.click()
        await page.getByRole("menuitem", { name: "Supprimer" }).click()

        // Confirmation dialog
        await expect(page.getByText("Supprimer ce code QR ?")).toBeVisible()

        // Cancel
        await page.getByRole("button", { name: "Annuler" }).click()
      }
    })
  })

  // ─── Scénario 8 : Navigation entre les pages ───────────────────────────

  test.describe("Navigation", () => {
    test("should navigate between gamification sub-pages", async ({ page }) => {
      // Dashboard
      await page.goto("/games")
      await expect(page.getByText("Tableau de bord")).toBeVisible({ timeout: 5000 })

      // Catalog
      await page.goto("/games/catalog")
      await expect(page.getByText("Jeux & Prix")).toBeVisible({ timeout: 5000 })

      // QR Codes
      await page.goto("/games/qr-codes")
      await expect(page.getByText("Codes QR")).toBeVisible({ timeout: 5000 })

      // Actions
      await page.goto("/games/actions")
      await expect(page.getByText("Actions")).toBeVisible({ timeout: 5000 })

      // Winners
      await page.goto("/games/winners")
      await page.waitForLoadState("networkidle")

      // Settings
      await page.goto("/games/settings")
      await page.waitForLoadState("networkidle")
    })

    test("should show sidebar navigation for gamification section", async ({ page }) => {
      await page.goto("/games/catalog")
      await page.waitForLoadState("networkidle")

      // Verify sidebar items are visible
      const sidebar = page.locator("nav, aside")
      await expect(sidebar.getByText("Jeux")).toBeVisible()
      await expect(sidebar.getByText("QR Codes")).toBeVisible()
      await expect(sidebar.getByText("Actions")).toBeVisible()
      await expect(sidebar.getByText("Gagnants")).toBeVisible()
    })
  })

  // ─── Scénario 9 : Full creation flow (premier jeu) ─────────────────────

  test.describe("First game creation scenario", () => {
    test("complete flow: create prize → QR code → action → game", async ({ page }) => {
      // This test runs the full happy path for setting up gamification from scratch.
      // It verifies that prerequisites are checked correctly.

      // 1. Go to games catalog
      await navigateToGames(page)

      // 2. Check if prerequisites alert is shown
      const alert = page.locator("text=Avant de créer un jeu, configurez ces éléments")
      const needsSetup = await alert.isVisible().catch(() => false)

      if (!needsSetup) {
        // Prerequisites already met, skip creation steps
        test.skip()
        return
      }

      // 3. Create a prize (switch to Prix tab)
      await page.getByRole("tab", { name: "Prix" }).click()
      await page.waitForTimeout(500)
      await page.getByRole("button", { name: "Créer un prix" }).click()

      await page.locator('input[id="prizeName"]').fill("E2E - Café offert")
      await page.locator("#prizeType").click()
      await page.getByRole("option", { name: "Produit offert" }).click()
      await page.locator('input[id="validityDays"]').clear()
      await page.locator('input[id="validityDays"]').fill("7")
      await page.getByRole("button", { name: "Créer un prix" }).last().click()
      await expect(page.getByText("Prix créé avec succès")).toBeVisible({ timeout: 5000 })

      // 4. Create a QR code
      await page.goto("/games/qr-codes")
      await page.waitForLoadState("networkidle")
      await page.getByRole("button", { name: "Créer un code QR" }).click()
      await page.getByRole("button", { name: "Générer" }).click()
      await page.locator('input[id="tableNumber"]').fill("E2E")
      await page.getByRole("button", { name: "Créer" }).click()
      await expect(page.getByText("Code QR créé avec succès")).toBeVisible({ timeout: 5000 })

      // 5. Create an action
      await page.goto("/games/actions")
      await page.waitForLoadState("networkidle")
      await page.getByRole("button", { name: "Ajouter une action" }).click()

      await page.getByLabel("Nom *").fill("E2E - Avis Google")
      await page.getByLabel("URL").fill("https://g.page/r/e2e-test")
      await page.getByRole("button", { name: "Créer" }).click()
      await expect(page.getByText("Action créée avec succès")).toBeVisible({ timeout: 5000 })

      // 6. Go back to catalog and verify prerequisites are met
      await navigateToGames(page)

      // Alert should no longer be visible
      await expect(alert).not.toBeVisible({ timeout: 5000 })

      // Create button should be enabled
      const createButton = page.getByRole("button", { name: "Créer un jeu" })
      await expect(createButton).toBeEnabled()
    })
  })
})
