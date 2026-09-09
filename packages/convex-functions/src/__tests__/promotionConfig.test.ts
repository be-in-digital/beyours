/**
 * A promotion this deployment cannot honour must be refused when it is
 * created, not when a diner tries to redeem it.
 *
 * WHAT WENT WRONG (#376, item 3): the promotion form sold « Produit offert »
 * and « Offre BOGO (1+1) », `promotions.create` validated and stored both, and
 * `resolvePromotionDiscount` threw `not_applicable` at order time — both types
 * alter the item list rather than the order total, and no code path builds
 * those items. So an owner configured a campaign, activated it, printed the
 * flyers, and found out it was decorative from a customer at the till. The
 * refusal existed all along; it was simply as late as it could possibly be.
 *
 * The list of what can be honoured lives with the resolver that enforces it
 * (`promotionDiscount.ts`), and both ends read it. Implement `bogo` there and
 * these tests say so — `HONOURABLE_DISCOUNT_TYPES` gains a member and the
 * refusal below stops firing — which is the point: the guard tracks the
 * implementation instead of being a second opinion about it.
 */

import { describe, it, expect } from "vitest"

import { create, update, PromotionConfigRefusedError } from "../promotions"
import {
  HONOURABLE_DISCOUNT_TYPES,
  UNHONOURABLE_DISCOUNT_TYPES,
  WITHDRAWN_PROMOTION_CONFIG_FIELDS,
  isHonourableDiscountType,
} from "../promotionDiscount"

const NOW = 1_700_000_000_000

/** A minimal ctx: no rows, and every insert/patch recorded. */
function fakeCtx(stored: Record<string, unknown> | null = null) {
  const inserted: Record<string, unknown>[] = []
  const patched: Record<string, unknown>[] = []
  return {
    inserted,
    patched,
    db: {
      get: async () => stored,
      query: () => ({ withIndex: () => ({ first: async () => null }) }),
      insert: async (_table: string, doc: Record<string, unknown>) => {
        inserted.push(doc)
        return "promotions:1"
      },
      patch: async (_id: string, fields: Record<string, unknown>) => {
        patched.push(fields)
      },
    },
  }
}

function promotionArgs(overrides: Record<string, unknown> = {}) {
  return {
    storeId: "stores:1",
    name: "Offre du soir",
    triggerMode: "coupon",
    couponCode: "SOIR",
    discountType: "percentage",
    discountValue: 10,
    scope: "order",
    startDate: NOW - 1_000,
    endDate: NOW + 1_000_000,
    isActive: true,
    ...overrides,
  }
}

async function refusal(fn: () => Promise<unknown>): Promise<PromotionConfigRefusedError> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof PromotionConfigRefusedError) return error
    throw error
  }
  throw new Error("expected the promotion to be refused, but it was saved")
}

describe("the two vocabularies agree", () => {
  it("names every discount type exactly once", () => {
    const all = [...HONOURABLE_DISCOUNT_TYPES, ...UNHONOURABLE_DISCOUNT_TYPES]
    expect(new Set(all).size).toBe(all.length)
    // The five the schema's `discountType` union admits.
    expect(all.sort()).toEqual([
      "bogo",
      "fixed_amount",
      "free_delivery",
      "free_product",
      "percentage",
    ])
  })

  it("answers for a type it has never heard of", () => {
    expect(isHonourableDiscountType("mystery_box")).toBe(false)
  })
})

describe("promotions.create", () => {
  it.each(UNHONOURABLE_DISCOUNT_TYPES)(
    "refuses %s instead of storing a promotion no order can use",
    async (discountType) => {
      const ctx = fakeCtx()
      const error = await refusal(() =>
        create.handler(ctx, promotionArgs({ discountType }))
      )

      expect(error.reason).toBe("discount_type_unhonourable")
      // The refusal must arrive as a sentence, not as "Server Error": Convex
      // redacts a thrown `Error` and only a `ConvexError` keeps its payload.
      expect(error.message).toContain("pourcentage")
      expect(error.data.code).toBe("discount_type_unhonourable")
      expect(ctx.inserted).toEqual([])
    }
  )

  it.each(HONOURABLE_DISCOUNT_TYPES)("still stores %s", async (discountType) => {
    const ctx = fakeCtx()
    await create.handler(ctx, promotionArgs({ discountType }))

    expect(ctx.inserted).toHaveLength(1)
    expect(ctx.inserted[0]?.discountType).toBe(discountType)
  })

  it("reports a duplicate coupon code legibly too", async () => {
    const ctx = fakeCtx()
    ctx.db.query = () =>
      ({ withIndex: () => ({ first: async () => ({ _id: "promotions:9" }) }) }) as never

    const error = await refusal(() => create.handler(ctx, promotionArgs()))

    expect(error.reason).toBe("coupon_code_taken")
    expect(error.message).toContain("existe déjà")
  })
})

describe("promotions.update", () => {
  it("refuses a change INTO an unhonourable type", async () => {
    const ctx = fakeCtx({ _id: "promotions:1", discountType: "percentage" })

    const error = await refusal(() =>
      update.handler(ctx, { id: "promotions:1", discountType: "bogo" })
    )

    expect(error.reason).toBe("discount_type_unhonourable")
    expect(ctx.patched).toEqual([])
  })

  it("refuses an edit that would KEEP an unhonourable type", async () => {
    // A row stored before this guard existed. Renaming it must not quietly
    // re-bless the type it carries.
    const ctx = fakeCtx({ _id: "promotions:1", discountType: "free_product" })

    const error = await refusal(() =>
      update.handler(ctx, { id: "promotions:1", name: "Nouveau nom" })
    )

    expect(error.reason).toBe("discount_type_unhonourable")
    expect(ctx.patched).toEqual([])
  })

  it("accepts an edit that moves a legacy promotion onto a type that works", async () => {
    const ctx = fakeCtx({ _id: "promotions:1", discountType: "bogo" })

    await update.handler(ctx, {
      id: "promotions:1",
      discountType: "percentage",
      discountValue: 50,
    })

    expect(ctx.patched).toHaveLength(1)
    expect(ctx.patched[0]?.discountType).toBe("percentage")
  })
})

/**
 * The five fields the two withdrawn types configured.
 *
 * #403 took the TYPES off both handlers and off the form, and left these on
 * both args validators — where they are not decoration, because both handlers
 * spread `args` straight into the row and `products.remove` reads three of
 * them. A `percentage` promotion could therefore be given a `freeProductId`
 * that no screen renders and no `update` can clear, and the dish it named
 * became undeletable.
 *
 * A Convex mutation refuses an argument its validator does not declare, so
 * absence here IS the refusal; there is nothing in the handler to assert
 * against. Both apps' `tests/convex/promotion-withdrawn-fields.test.ts` runs
 * the real mutation and watches the validator do it.
 */
describe("the withdrawn configuration is not writable", () => {
  it.each(WITHDRAWN_PROMOTION_CONFIG_FIELDS)(
    "promotions.create declares no %s",
    (field) => {
      expect(Object.keys(create.args)).not.toContain(field)
    }
  )

  it.each(WITHDRAWN_PROMOTION_CONFIG_FIELDS)(
    "promotions.update declares no %s",
    (field) => {
      expect(Object.keys(update.args)).not.toContain(field)
    }
  )

  it("is exactly the set the schema still declares for legacy rows", () => {
    // If one is ever implemented, it comes back on the validators AND leaves
    // this list, in the same commit — the schema comment says so too.
    expect([...WITHDRAWN_PROMOTION_CONFIG_FIELDS].sort()).toEqual([
      "bogoRewardProductId",
      "bogoRewardQuantity",
      "bogoTriggerProductId",
      "bogoTriggerQuantity",
      "freeProductId",
    ])
  })
})
