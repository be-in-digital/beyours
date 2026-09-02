import { test, expect } from "@playwright/test"

/**
 * The total on screen is the total that will be charged.
 *
 * The summary showed the sum of the lines under "TVA incluse" while the server
 * added VAT on top of it — 20 € displayed, 22 € debited at 10 %, 24 € at the
 * default 20. Both sides now run the same `computeOrderTotals`, and it takes
 * the tax *out* of the price: the rate moves the "dont TVA" line and nothing
 * else.
 *
 * `order-vat.test.ts` holds the server half — what Stripe is asked to charge.
 * This holds the half the customer reads before deciding.
 */

/** Written by the cart store (packages/restaurant). */
const CART_KEY = "beindigital-cart"

/**
 * An hour the establishment is open, as an instant.
 *
 * /checkout refuses a closed restaurant, so an unpinned clock made this test
 * pass or fail on the time of day it was run. The hour has to be open under
 * both sets of hours the suite may leave behind: the fixture seeds 09:00-22:00
 * with Monday closed, and `store-overnight-hours.spec.ts` rewrites the week to
 * 18:00-02:00, so 18:00-22:00 is the overlap. This is 20:00 Paris on Friday
 * 2026-08-28, written in UTC because a wall-clock string means the runner's
 * zone while the storefront reads the establishment's, which is Europe/Paris.
 */
const OPEN_HOUR = new Date("2026-08-28T18:00:00Z")

/** A menu at 10 % and a bottle at 20 %: no single rate describes this basket. */
const ITEMS = [
  {
    lineId: "line-menu",
    productId: "p1",
    name: "Menu du jour",
    price: 2_400,
    quantity: 1,
    options: [],
    taxRate: 10,
  },
  {
    lineId: "line-wine",
    productId: "p2",
    name: "Côtes-du-Rhône",
    price: 1_800,
    quantity: 1,
    options: [],
    taxRate: 20,
  },
]

test.describe("The checkout total", () => {
  // The width most customers order from.
  test.use({ viewport: { width: 375, height: 812 } })

  test.beforeEach(async ({ page }) => {
    // Let the storefront pick the establishment, then write the cart with the
    // id it picked.
    //
    // Seeding `storeId: null` never reached the summary: `checkout/page.tsx`
    // sends a cart with items and no establishment straight to
    // /store-selector, so the assertions below were reading whatever page the
    // redirect happened to land on. The storefront resolves an establishment
    // for the SESSION, not for a cart already sitting in localStorage, so the
    // null had to be filled in here.
    await page.clock.setFixedTime(OPEN_HOUR)
    await page.goto("/menu", { waitUntil: "domcontentloaded" })

    const handle = await page.waitForFunction(
      (key) => {
        const raw = window.localStorage.getItem(key)
        return raw ? (JSON.parse(raw)?.state?.storeId ?? null) : null
      },
      CART_KEY,
      { timeout: 30_000 },
    )
    const storeId = await handle.jsonValue()

    await page.evaluate(
      ({ key, items, storeId }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            state: { items, orderType: "pickup", storeId },
            version: 1,
          }),
        )
      },
      { key: CART_KEY, items: ITEMS as unknown[], storeId },
    )
  })

  test("is the sum of the prices on the menu, with the VAT inside it", async ({
    page,
  }) => {
    await page.goto("/checkout", { waitUntil: "domcontentloaded" })

    // The summary is the one block that names the tax: the cart sheet in the
    // layout shows the same total without it.
    await expect(page.getByText("dont TVA")).toBeVisible({ timeout: 30_000 })

    // 24,00 € + 18,00 €. VAT added on top would have read 46,20 €.
    await expect(page.getByText("42,00 €").first()).toBeVisible()

    // 2,18 € in the menu at 10 % plus 3,00 € in the bottle at 20 %. One global
    // rate over the basket declared 3,82 €.
    await expect(page.getByText("5,18 €")).toBeVisible()

    await expect(page.getByText("TVA incluse")).toBeVisible()
  })
})
