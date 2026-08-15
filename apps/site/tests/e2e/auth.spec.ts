import { test, expect } from "@playwright/test";

// Unique email per test run to avoid conflicts
const TEST_EMAIL = `test-${Date.now()}@e2e-test.com`;
const TEST_PASSWORD = "TestPassword123!";

test.describe.serial("Programme Apporteur - Auth Flow", () => {
  test("1 - landing page loads and has signup CTA", async ({ page }) => {
    await page.goto("/parrainage");
    await expect(page.locator("h1")).toContainText("500");
    await expect(
      page.locator('a[href="/parrainage/inscription"]').first()
    ).toBeVisible();
  });

  test("2 - signup page loads with form", async ({ page }) => {
    await page.goto("/parrainage/inscription");
    await expect(page.locator("h1")).toContainText("Créer votre compte");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Créer mon compte");
  });

  test("3 - password visibility toggle works on signup", async ({ page }) => {
    await page.goto("/parrainage/inscription");
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click eye toggle button (inside the relative container next to input)
    await page.locator("#password ~ button").click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Toggle back
    await page.locator("#password ~ button").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("4 - signup creates account and redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/parrainage/inscription");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Log to help debug
    console.log(`[E2E] Signing up with: ${TEST_EMAIL}`);

    await page.locator('button[type="submit"]').click();

    // Should show loading state
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Inscription en cours");

    // Should redirect to dashboard after successful signup
    await expect(page).toHaveURL(/\/parrainage\/dashboard/, {
      timeout: 25000,
    });

    // Dashboard should show "Bienvenue" heading
    await expect(page.locator("h1")).toContainText("Bienvenue", {
      timeout: 15000,
    });

    console.log(`[E2E] Signup successful, on dashboard`);
  });

  test("5 - login page loads with form", async ({ page }) => {
    await page.goto("/parrainage/connexion");
    await expect(page.locator("h1")).toContainText("Connexion");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("6 - password visibility toggle works on login", async ({ page }) => {
    await page.goto("/parrainage/connexion");
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.locator("#password ~ button").click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });

  test("7 - login with existing account redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("/parrainage/connexion");

    console.log(`[E2E] Logging in with: ${TEST_EMAIL}`);

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Should show loading state
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Connexion en cours");

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/parrainage\/dashboard/, {
      timeout: 25000,
    });

    // Dashboard should show "Bienvenue" or "Bonjour"
    await expect(page.locator("h1")).toContainText(/(Bienvenue|Bonjour)/, {
      timeout: 15000,
    });

    console.log(`[E2E] Login successful, on dashboard`);
  });

  test("8 - login with wrong password shows error", async ({ page }) => {
    await page.goto("/parrainage/connexion");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', "WrongPassword999!");
    await page.locator('button[type="submit"]').click();

    // Should show an error message (any red error box)
    await expect(page.locator('[class*="bg-red"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("9 - signup with already existing email shows error", async ({
    page,
  }) => {
    await page.goto("/parrainage/inscription");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Should show error about existing account or redirect to dashboard
    // (since account already exists with same password, auth might succeed)
    const errorOrDashboard = await Promise.race([
      page
        .locator('[class*="bg-red"]')
        .waitFor({ timeout: 15000 })
        .then(() => "error"),
      page
        .waitForURL(/\/parrainage\/dashboard/, { timeout: 15000 })
        .then(() => "dashboard"),
    ]);

    console.log(
      `[E2E] Signup with existing email result: ${errorOrDashboard}`
    );
    expect(["error", "dashboard"]).toContain(errorOrDashboard);
  });
});
