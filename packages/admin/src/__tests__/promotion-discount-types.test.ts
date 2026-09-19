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
 *
 * WHAT THIS FILE MISSED (#414 P5-F4). It asserted the form no longer names
 * `bogoTriggerQuantity` or `bogoRewardQuantity` — and said nothing at all about
 * the server. So `promotions.create` and `promotions.update` went on accepting
 * all five withdrawn configuration fields for another five commits, and one of
 * them was live: `products.remove` reads three of them, so a `freeProductId`
 * set on an ordinary `percentage` promotion made a dish undeletable and named a
 * promotion the owner could see no reference in. A test that holds one end of a
 * contract and calls it done is how a half-cleanup passes review. The last
 * describe block below is the other end.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { create, update } from "@be-yours/convex-functions/promotions"
import {
  HONOURABLE_DISCOUNT_TYPES,
  UNHONOURABLE_DISCOUNT_TYPES,
  WITHDRAWN_PROMOTION_CONFIG_FIELDS,
} from "@be-yours/convex-functions/promotionDiscount"

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
      'from "@be-yours/convex-functions/promotionDiscount"'
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

  it.each(WITHDRAWN_PROMOTION_CONFIG_FIELDS)(
    "carries no dead %s field for a type it cannot offer",
    (field) => {
      // The BOGO quantity inputs collected two numbers that were stored and
      // read by nothing. They went with the option — and so did the three
      // product pickers, which is all five, not the two this once checked.
      expect(form).not.toContain(field)
    }
  )

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

describe("the server args — the half this file used to leave unchecked", () => {
  // Not source-scanned: these are the validator objects the Convex mutations
  // are built from, so what is asserted is the contract itself. Convex refuses
  // an argument no validator declares — "Validator error: Unexpected field
  // `freeProductId` in object" — which is why absence here IS the guard, and
  // why an added key would silently re-open the hole rather than fail a type
  // check (both handlers take `args: any` and spread it into the row).
  const validators = { create: create.args, update: update.args }

  for (const [name, args] of Object.entries(validators)) {
    it.each(WITHDRAWN_PROMOTION_CONFIG_FIELDS)(
      `promotions.${name} declares no ${"%s"}`,
      (field) => {
        expect(Object.keys(args)).not.toContain(field)
      }
    )
  }

  it("still declares everything the form actually sends", () => {
    // The counterweight: this must fail if someone "fixes" the tests above by
    // emptying the validators.
    for (const field of ["storeId", "name", "discountType", "scope", "targetProductIds"]) {
      expect(Object.keys(create.args)).toContain(field)
    }
    for (const field of ["id", "name", "discountType", "scope", "targetProductIds"]) {
      expect(Object.keys(update.args)).toContain(field)
    }
  })

  it("keeps all five discount-type LITERALS on the type validator", () => {
    // Deliberate, and the opposite of the fields above. `update` reads
    // `existing.discountType` to refuse an edit that would KEEP a withdrawn
    // type, and that refusal is a French sentence an owner can act on. Narrow
    // this union and the same edit becomes an untranslated validator error.
    const literals = create.args.discountType.members.map((member) => member.value)

    expect([...literals].sort()).toEqual(
      [...HONOURABLE_DISCOUNT_TYPES, ...UNHONOURABLE_DISCOUNT_TYPES].sort()
    )
  })
})
