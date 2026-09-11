import { describe, expect, it } from "vitest"

import {
  RECONCILE_MIN_AGE_MINUTES,
  attachCheckoutSession,
  listStrandedCheckouts,
} from "../payments"

/**
 * Finding the checkouts a diner never came back from, for every provider.
 *
 * WHAT WAS BROKEN (#431.2). Only Stripe could be asked. `crons.ts` reconciled
 * Stripe alone, the order carried `stripeCheckoutSessionId` and nothing else,
 * and `listStrandedCheckouts` read that one field:
 *
 *     $ grep -n "reconcile" convex/crons.ts
 *     only internal.stripe.reconcilePendingCheckouts
 *
 * So a diner who paid with SumUp or approved with PayPal and closed the tab
 * before the redirect completed left the charge with the provider, the order at
 * `pending`, and the kitchen blind. Permanently — not for a window: no path in
 * the product ever asked again. The restaurant had the money and no order to
 * cook.
 *
 * The two things worth pinning here are the ones a copy-paste would get wrong:
 * a reference is only ever returned to the provider it belongs to, and orders
 * written before this existed are still recoverable.
 */

const NOW = 1_700_000_000_000
/** Old enough for the sweep to consider, young enough to be inside the window. */
const STRANDED_AT = NOW - (RECONCILE_MIN_AGE_MINUTES + 5) * 60_000

type Order = Record<string, unknown>

/**
 * A `ctx.db` that answers the one index range the query reads.
 *
 * Hand-rolled rather than `convex-test`, because what is under test is the
 * filtering — which row is returned for which provider — and a real database
 * would add a schema to satisfy without adding an assertion.
 */
function ctxWith(rows: Order[]) {
  return {
    db: {
      query: () => ({
        withIndex: () => ({
          take: async () => rows,
        }),
      }),
    },
  }
}

function order(over: Order = {}): Order {
  return {
    _id: "order_1",
    storeId: "store_1",
    paymentStatus: "pending",
    total: 2_000,
    createdAt: STRANDED_AT,
    ...over,
  }
}

const listFor = (rows: Order[], provider?: string) =>
  listStrandedCheckouts.handler(ctxWith(rows), { now: NOW, ...(provider ? { provider } : {}) })

describe("listStrandedCheckouts", () => {
  it("returns a SumUp checkout to the SumUp sweep", async () => {
    const rows = [
      order({
        providerCheckoutRef: { provider: "sumup", reference: "chk_1", attachedAt: STRANDED_AT },
      }),
    ]
    expect(await listFor(rows, "sumup")).toEqual([
      { orderId: "order_1", storeId: "store_1", checkoutSessionId: "chk_1", total: 2_000, createdAt: STRANDED_AT },
    ])
  })

  it("and NOT to the Stripe one", async () => {
    // The bug a copy-paste makes, and the one that matters most: a SumUp
    // reference read against Stripe's API answers "unknown", which a sweep
    // would take for "never paid" and could act on.
    const rows = [
      order({
        providerCheckoutRef: { provider: "sumup", reference: "chk_1", attachedAt: STRANDED_AT },
      }),
    ]
    expect(await listFor(rows, "stripe")).toEqual([])
    expect(await listFor(rows, "paypal")).toEqual([])
  })

  it("defaults to Stripe, so every caller written before this keeps its meaning", async () => {
    const rows = [
      order({
        providerCheckoutRef: { provider: "stripe", reference: "cs_1", attachedAt: STRANDED_AT },
      }),
    ]
    expect((await listFor(rows)).map((row) => row.checkoutSessionId)).toEqual(["cs_1"])
  })

  it("still finds an order written before `providerCheckoutRef` existed", async () => {
    // The migration case. A Stripe checkout stranded the day before this
    // shipped has only the old field, and it is still worth recovering.
    const rows = [order({ stripeCheckoutSessionId: "cs_legacy" })]
    expect((await listFor(rows, "stripe")).map((row) => row.checkoutSessionId)).toEqual([
      "cs_legacy",
    ])
  })

  it("but does not hand that legacy field to another provider", async () => {
    // `stripeCheckoutSessionId` is Stripe's by name and by content. Reading it
    // for SumUp would send a Stripe session id to SumUp's API.
    const rows = [order({ stripeCheckoutSessionId: "cs_legacy" })]
    expect(await listFor(rows, "sumup")).toEqual([])
  })

  it("prefers the typed reference over the legacy field when both are set", async () => {
    // Stripe writes both. The typed one carries the provider, so it is the one
    // that can be checked.
    const rows = [
      order({
        stripeCheckoutSessionId: "cs_old",
        providerCheckoutRef: { provider: "stripe", reference: "cs_new", attachedAt: STRANDED_AT },
      }),
    ]
    expect((await listFor(rows, "stripe")).map((row) => row.checkoutSessionId)).toEqual(["cs_new"])
  })

  it("skips an order with no reference at all", async () => {
    // Cash, and every platform order, sit at `paymentStatus: "pending"` too.
    expect(await listFor([order()], "sumup")).toEqual([])
  })

  it("skips an empty reference rather than asking a provider about nothing", async () => {
    const rows = [
      order({ providerCheckoutRef: { provider: "sumup", reference: "   ", attachedAt: STRANDED_AT } }),
    ]
    expect(await listFor(rows, "sumup")).toEqual([])
  })

  it("stops at the limit", async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      order({
        _id: `order_${i}`,
        providerCheckoutRef: { provider: "sumup", reference: `chk_${i}`, attachedAt: STRANDED_AT },
      })
    )
    const found = await listStrandedCheckouts.handler(ctxWith(rows), {
      now: NOW,
      provider: "sumup",
      limit: 2,
    })
    expect(found).toHaveLength(2)
  })
})

describe("attachCheckoutSession", () => {
  function patchingCtx(row: Order | null) {
    const patches: Record<string, unknown>[] = []
    return {
      patches,
      ctx: {
        db: {
          get: async () => row,
          patch: async (_id: unknown, fields: Record<string, unknown>) => {
            patches.push(fields)
          },
        },
      },
    }
  }

  it("writes BOTH fields for Stripe", async () => {
    // The old field is read by more than the sweep — a second checkout on one
    // order expires the first through it (#411) — so it has to keep working.
    const { ctx, patches } = patchingCtx(order())
    await attachCheckoutSession.handler(ctx, { orderId: "order_1", checkoutSessionId: "cs_1" })
    expect(patches[0]!.stripeCheckoutSessionId).toBe("cs_1")
    expect(patches[0]!.providerCheckoutRef).toMatchObject({
      provider: "stripe",
      reference: "cs_1",
    })
  })

  it("writes only the typed one for SumUp", async () => {
    // Putting a SumUp id in `stripeCheckoutSessionId` would send it to Stripe's
    // API on the next sweep, and to `checkout.sessions.expire` on the next
    // checkout.
    const { ctx, patches } = patchingCtx(order())
    await attachCheckoutSession.handler(ctx, {
      orderId: "order_1",
      checkoutSessionId: "chk_1",
      provider: "sumup",
    })
    expect(patches[0]!.stripeCheckoutSessionId).toBeUndefined()
    expect(patches[0]!.providerCheckoutRef).toMatchObject({
      provider: "sumup",
      reference: "chk_1",
    })
  })

  it("and only the typed one for PayPal", async () => {
    const { ctx, patches } = patchingCtx(order())
    await attachCheckoutSession.handler(ctx, {
      orderId: "order_1",
      checkoutSessionId: "PAY-1",
      provider: "paypal",
    })
    expect(patches[0]!.stripeCheckoutSessionId).toBeUndefined()
    expect(patches[0]!.providerCheckoutRef).toMatchObject({ provider: "paypal" })
  })

  it("writes nothing for an empty reference", async () => {
    const { ctx, patches } = patchingCtx(order())
    await attachCheckoutSession.handler(ctx, { orderId: "order_1", checkoutSessionId: "  " })
    expect(patches).toEqual([])
  })

  it("writes nothing for an order that does not exist", async () => {
    const { ctx, patches } = patchingCtx(null)
    await attachCheckoutSession.handler(ctx, { orderId: "gone", checkoutSessionId: "cs_1" })
    expect(patches).toEqual([])
  })
})
