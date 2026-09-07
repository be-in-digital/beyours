/**
 * The promotion form may not offer a discount the order path cannot give.
 *
 * WHAT WENT WRONG (#376, item 3): the form sold « Produit offert » and
 * « Offre BOGO (1+1) » in its type picker, `promotions.create` stored both,
 * and `resolvePromotionDiscount` threw `not_applicable` at the first
 * redemption. The owner learned their campaign was decorative from a customer
 * at the till, having already printed the flyers.
 *
 * The server refuses both at creation now. This is the other half: the form
 * must not ASK for that refusal, and — because rows created before the guard
 * exist — the list must still render them honestly rather than hiding them.
 *
 * Source-level, deliberately. What is asserted here is which options the
 * markup can offer and where the list of them comes from; mounting the form
 * would answer the first and not the second, and it is the second that keeps
 * the two ends from drifting apart again.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  HONOURABLE_DISCOUNT_TYPES,
  UNHONOURABLE_DISCOUNT_TYPES,
} from "@be-in-digital/convex-functions/promotionDiscount"

const PROMOTIONS = path.join(__dirname, "..", "pages", "promotions")
const read = (file: string): string =>
  fs.readFileSync(path.join(PROMOTIONS, file), "utf8")

const form = read("promotion-form.tsx")
const listPage = read("promotions-page.tsx")

describe("the type picker", () => {
  it("takes its options from the resolver, not from a literal list", () => {
    // The one property that makes this stay fixed: implement `bogo` in
    // `promotionDiscount.ts` and the option comes back here on the same
    // commit, with no second edit to remember.
    expect(form).toContain(
      'from "@be-in-digital/convex-functions/promotionDiscount"'
    )
    expect(form).toContain("HONOURABLE_DISCOUNT_TYPES.map(")
  })

  it.each(UNHONOURABLE_DISCOUNT_TYPES)(
    "offers no %s option",
    (discountType) => {
      expect(form).not.toContain(`SelectItem value="${discountType}"`)
      expect(form).not.toContain(`value="${discountType}"`)
    }
  )

  it("has a label for every type it can offer, and no more", () => {
    const labelled = [
      ...form.matchAll(/^ {2}(percentage|fixed_amount|free_delivery|free_product|bogo):/gm),
    ].map((m) => m[1])

    expect(labelled.sort()).toEqual([...HONOURABLE_DISCOUNT_TYPES].sort())
  })

  it("carries no dead field for a type it cannot offer", () => {
    // The BOGO quantity inputs collected two numbers that were stored and
    // read by nothing. They went with the option.
    expect(form).not.toContain("bogoTriggerQuantity")
    expect(form).not.toContain("bogoRewardQuantity")
  })

  it("explains itself when an existing promotion carries a withdrawn type", () => {
    expect(form).toContain("UNHONOURABLE_DISCOUNT_TYPE_MESSAGE")
    expect(form).toContain("isHonourableDiscountType(promotion?.discountType)")
  })

  it("reads a server refusal out of the ConvexError payload", () => {
    // `error.message` alone is "Server Error" in production.
    expect(form).toContain("convexErrorMessage(")
  })
})

describe("the promotions list", () => {
  it.each(UNHONOURABLE_DISCOUNT_TYPES)(
    "still knows how to label a stored %s row",
    (discountType) => {
      // Hiding them would leave an owner with a promotion they can see the
      // effects of and cannot find.
      expect(listPage).toContain(`${discountType}:`)
    }
  )

  it("says in the value column that they grant nothing", () => {
    expect(listPage).toContain("Aucune remise appliquée")
    // And no longer prints a value that reads as a working campaign.
    expect(listPage).not.toContain('return "BOGO"')
    expect(listPage).not.toContain('return "Produit offert"')
  })
})
