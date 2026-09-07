/**
 * Every bare delete that left a row pointing at nothing (#326, #312, #313).
 *
 * WHY THIS FILE EXISTS. Five handlers were written as `ctx.db.delete(args.id)`
 * against tables other rows reference, and `v.id("table")` validates how an id
 * is ENCODED, not that it still resolves — so nothing anywhere complained. Each
 * one had a different cost:
 *
 *  - a prize deleted while a diner held a winning code (`prizeRedemptions
 *    .prizeId`, REQUIRED) left the redemption standing at `pending` with
 *    nothing behind it;
 *  - a game deleted after it had been played (`gamePlays.gameId`, REQUIRED)
 *    took the establishment's record of what it ran, consent included;
 *  - a template deleted under a scheduled campaign HALTED the send silently;
 *  - a segment deleted under one BROADENED it — the filter was skipped, and the
 *    campaign went to the whole list;
 *  - cancelling a couponed order restored the stock and kept the coupon spent;
 *  - `orders.remove` would have taken the fiscal invoice with the order.
 *
 * WHAT THESE CASES ASSERT. Not "an error was thrown" — that passes against a
 * handler that throws for the wrong reason. Each case seeds the referencing row,
 * runs the REAL handler, and then asserts BOTH halves: the refusal carries the
 * code a screen switches on, AND the rows on both sides of the reference are
 * still there afterwards. A guard that refuses and half-deletes would pass the
 * first assertion and fail the second.
 *
 * The double is `support/countingDb`: it reads the real declared indexes out of
 * `@be-in-digital/convex-schema` and refuses a query that names one that does
 * not exist. The four indexes these guards needed — `gamePlays.by_gameId`,
 * `gamePlays.by_prizeId`, `prizeRedemptions.by_prizeId`,
 * `promotionUsages.by_orderId` — are therefore proved by these tests to be
 * declared, not merely spelled correctly.
 */

import { describe, it, expect } from "vitest"
import { remove as removePrize } from "../prizes"
import { remove as removeGame } from "../games"
import { remove as removeTemplate } from "../emailTemplates"
import { remove as removeSegment } from "../emailSegments"
import { remove as removeOrder, updateStatus } from "../orders"
import * as convexFunctions from "../index"
import { createCountingDb } from "./support/countingDb"

const STORE = "stores:1"
const NOW = Date.UTC(2026, 8, 7, 12, 0)

/** The `{ code }` a `ConvexError` carries, or null for anything else. */
function refusalCode(error: unknown): string | null {
  const data = (error as { data?: unknown } | null)?.data
  if (typeof data !== "object" || data === null) return null
  const code = (data as { code?: unknown }).code
  return typeof code === "string" ? code : null
}

/** Run `fn`, and return the `ConvexError` it threw. Fails if it did not throw. */
async function refusalFrom(fn: () => Promise<unknown>): Promise<{
  code: string | null
  message: string
}> {
  try {
    await fn()
  } catch (error) {
    return {
      code: refusalCode(error),
      message: (error as Error).message ?? "",
    }
  }
  throw new Error("expected the handler to refuse, and it did not")
}

const rows = (ctx: ReturnType<typeof createCountingDb>, table: string) =>
  ctx.store[table] ?? []

// ---------------------------------------------------------------------------
// #326.1 — prizes.ts:28 and games.ts:38
// ---------------------------------------------------------------------------

describe("#326.1 prizes.remove — a won prize is not ours to void", () => {
  const prize = {
    _id: "prizes:1",
    storeId: STORE,
    name: "Dessert offert",
    type: "free_product",
    validityDays: 30,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }

  it("refuses while a redemption points at it, and deletes neither row", async () => {
    const ctx = createCountingDb({
      prizes: [prize],
      prizeRedemptions: [
        {
          _id: "prizeRedemptions:1",
          storeId: STORE,
          gamePlayId: "gamePlays:1",
          prizeId: "prizes:1",
          redemptionCode: "ABC123",
          // The state the counter scan actually found: someone is still owed
          // this, and the staff scanner resolves the code through `prizeId`.
          status: "pending",
          expiresAt: NOW + 86_400_000,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removePrize.handler(ctx, { id: "prizes:1" })
    )

    expect(refusal.code).toBe("prize_has_redemptions")
    expect(refusal.message).toContain("Dessert offert")
    // Both sides of the reference survive. This is the half a "did it throw?"
    // test cannot see.
    expect(rows(ctx, "prizes")).toHaveLength(1)
    expect(rows(ctx, "prizeRedemptions")).toHaveLength(1)
  })

  it("refuses while a play records it as won", async () => {
    const ctx = createCountingDb({
      prizes: [prize],
      prizeRedemptions: [],
      gamePlays: [
        {
          _id: "gamePlays:1",
          storeId: STORE,
          gameId: "games:1",
          completedActions: [],
          didWin: true,
          prizeId: "prizes:1",
          playedAt: NOW,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removePrize.handler(ctx, { id: "prizes:1" })
    )

    expect(refusal.code).toBe("prize_has_plays")
    expect(rows(ctx, "prizes")).toHaveLength(1)
    // `gamePlays.prizeId` is optional, so nulling it would have made the delete
    // succeed. That field IS the record of what was won; it stays.
    expect(rows(ctx, "gamePlays")[0]?.prizeId).toBe("prizes:1")
  })

  it("deletes an unwon prize and detaches the wheel section that named it", async () => {
    const ctx = createCountingDb({
      prizes: [prize],
      prizeRedemptions: [],
      gamePlays: [],
      games: [
        {
          _id: "games:1",
          storeId: STORE,
          type: "wheel",
          name: "Roue",
          winRatio: 30,
          isActive: true,
          config: {
            wheelSections: [
              { label: "Dessert", color: "#f00", prizeId: "prizes:1", isWinning: true },
              { label: "Perdu", color: "#ccc" },
            ],
          },
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    await removePrize.handler(ctx, { id: "prizes:1" })

    expect(rows(ctx, "prizes")).toHaveLength(0)
    const sections = rows(ctx, "games")[0]?.config.wheelSections
    // The section is the owner's work — a label and a colour — and survives.
    // Only the dead link goes.
    expect(sections[0].label).toBe("Dessert")
    expect(sections[0].prizeId).toBeUndefined()
    expect(sections[1].label).toBe("Perdu")
  })
})

describe("#326.1 games.remove — a played game keeps its plays", () => {
  const game = {
    _id: "games:1",
    storeId: STORE,
    type: "wheel",
    name: "Roue de la fortune",
    winRatio: 30,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
  }

  it("refuses while a play points at it, and keeps the consent record", async () => {
    const ctx = createCountingDb({
      games: [game],
      gamePlays: [
        {
          _id: "gamePlays:1",
          storeId: STORE,
          gameId: "games:1",
          // The reason a cascade would be worse than a refusal: this row is the
          // establishment's evidence that it collected consent (art. 7.1).
          consent: { acceptedAt: NOW, noticeVersion: "v1" },
          completedActions: [],
          didWin: false,
          playedAt: NOW,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeGame.handler(ctx, { id: "games:1" })
    )

    expect(refusal.code).toBe("game_has_plays")
    expect(refusal.message).toContain("Roue de la fortune")
    expect(rows(ctx, "games")).toHaveLength(1)
    expect(rows(ctx, "gamePlays")).toHaveLength(1)
    expect(rows(ctx, "gamePlays")[0]?.consent).toEqual({
      acceptedAt: NOW,
      noticeVersion: "v1",
    })
  })

  it("deletes a game nobody has played", async () => {
    const ctx = createCountingDb({ games: [game], gamePlays: [] })

    await removeGame.handler(ctx, { id: "games:1" })

    expect(rows(ctx, "games")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// #326.2 — emailTemplates.ts:92 and emailSegments.ts:162
// ---------------------------------------------------------------------------

const emptyStats = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
  converted: 0,
  revenue: 0,
}

function campaign(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    _id: id,
    storeId: STORE,
    name: `Campagne ${id}`,
    subject: "Sujet",
    templateId: "emailTemplates:1",
    status,
    abTestEnabled: false,
    stats: emptyStats,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  }
}

const template = {
  _id: "emailTemplates:1",
  storeId: STORE,
  name: "Modèle promo",
  subject: "Sujet",
  blocks: [],
  category: "marketing",
  createdAt: 0,
  updatedAt: 0,
}

const segment = {
  _id: "emailSegments:1",
  storeId: STORE,
  name: "Clients inactifs",
  rules: [],
  ruleOperator: "and",
  subscriberCount: 12,
  createdAt: 0,
  updatedAt: 0,
}

describe("#326.2 emailTemplates.remove — a scheduled send keeps its template", () => {
  it("refuses while a scheduled campaign names it", async () => {
    const ctx = createCountingDb({
      emailTemplates: [template],
      emailCampaigns: [campaign("emailCampaigns:1", "scheduled")],
      emailAutomations: [],
    })

    const refusal = await refusalFrom(() =>
      removeTemplate.handler(ctx, { id: "emailTemplates:1" })
    )

    expect(refusal.code).toBe("template_in_campaign")
    expect(refusal.message).toContain("Campagne emailCampaigns:1")
    expect(rows(ctx, "emailTemplates")).toHaveLength(1)
  })

  it("refuses while an automation step names it, whatever its status", async () => {
    const ctx = createCountingDb({
      emailTemplates: [template],
      emailCampaigns: [],
      emailAutomations: [
        {
          _id: "emailAutomations:1",
          storeId: STORE,
          name: "Bienvenue",
          trigger: "welcome",
          status: "draft",
          steps: [{ id: "s1", delayMinutes: 0, templateId: "emailTemplates:1" }],
          stats: emptyStats,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeTemplate.handler(ctx, { id: "emailTemplates:1" })
    )

    expect(refusal.code).toBe("template_in_automation")
    expect(rows(ctx, "emailTemplates")).toHaveLength(1)
  })

  it("deletes when only finished campaigns reference it", async () => {
    // A campaign that has finished will never dereference the template again.
    // Blocking on it would make the template list unmaintainable within a year
    // — the trade recorded in `emailAssetReferences.ts`.
    const ctx = createCountingDb({
      emailTemplates: [template],
      emailCampaigns: [
        campaign("emailCampaigns:1", "sent"),
        campaign("emailCampaigns:2", "cancelled"),
        campaign("emailCampaigns:3", "failed"),
      ],
      emailAutomations: [],
    })

    await removeTemplate.handler(ctx, { id: "emailTemplates:1" })

    expect(rows(ctx, "emailTemplates")).toHaveLength(0)
  })
})

describe("#326.2 emailSegments.remove — deleting one used to widen the send", () => {
  it("refuses while a live campaign targets it", async () => {
    const ctx = createCountingDb({
      emailSegments: [segment],
      emailCampaigns: [
        campaign("emailCampaigns:1", "paused", { segmentId: "emailSegments:1" }),
      ],
      emailAutomations: [],
    })

    const refusal = await refusalFrom(() =>
      removeSegment.handler(ctx, { id: "emailSegments:1" })
    )

    expect(refusal.code).toBe("segment_in_campaign")
    // The refusal has to say what would happen, not just that it will not.
    expect(refusal.message).toContain("toute la liste")
    expect(rows(ctx, "emailSegments")).toHaveLength(1)
  })

  it("refuses while an automation step targets it", async () => {
    const ctx = createCountingDb({
      emailSegments: [segment],
      emailCampaigns: [],
      emailAutomations: [
        {
          _id: "emailAutomations:1",
          storeId: STORE,
          name: "Réengagement",
          trigger: "inactive",
          status: "active",
          steps: [
            {
              id: "s1",
              delayMinutes: 0,
              templateId: "emailTemplates:1",
              segmentId: "emailSegments:1",
            },
          ],
          stats: emptyStats,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeSegment.handler(ctx, { id: "emailSegments:1" })
    )

    expect(refusal.code).toBe("segment_in_automation")
    expect(rows(ctx, "emailSegments")).toHaveLength(1)
  })

  it("deletes a segment nothing live points at", async () => {
    const ctx = createCountingDb({
      emailSegments: [segment],
      emailCampaigns: [campaign("emailCampaigns:1", "sent", { segmentId: "emailSegments:1" })],
      emailAutomations: [],
    })

    await removeSegment.handler(ctx, { id: "emailSegments:1" })

    expect(rows(ctx, "emailSegments")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// #326.3 — orders.ts cancellation branch
// ---------------------------------------------------------------------------

describe("#326.3 cancelling a couponed order gives the coupon back", () => {
  function couponedOrder() {
    return createCountingDb({
      orders: [
        {
          _id: "orders:1",
          storeId: STORE,
          orderNumber: "2026-0001",
          status: "confirmed",
          type: "delivery",
          paymentStatus: "pending",
          paymentMethod: "cash",
          source: "website",
          customerInfo: { name: "Camille", email: "camille@example.fr" },
          items: [],
          subtotal: 2000,
          total: 1800,
          promotionId: "promotions:1",
          discountAmount: 200,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      promotions: [
        {
          _id: "promotions:1",
          storeId: STORE,
          name: "BIENVENUE10",
          couponCode: "BIENVENUE10",
          // The checkout counted the use. Nothing ever uncounted it.
          usageCount: 1,
          maxTotalUsage: 1,
          maxUsagePerCustomer: 1,
          isActive: true,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      promotionUsages: [
        {
          _id: "promotionUsages:1",
          storeId: STORE,
          promotionId: "promotions:1",
          customerEmail: "camille@example.fr",
          orderId: "orders:1",
          usedAt: 0,
        },
      ],
      kitchenTickets: [],
      emailSubscribers: [],
    })
  }

  it("releases the global counter and the per-customer ledger row", async () => {
    const ctx = couponedOrder()

    await updateStatus.handler(ctx, {
      id: "orders:1",
      status: "cancelled",
      cancellationReason: "Rupture de stock",
    })

    expect(rows(ctx, "orders")[0]?.status).toBe("cancelled")
    // Without this, a promotion capped at one use stayed spent for ever and the
    // diner could not reorder — with no screen anywhere to fix either number.
    expect(rows(ctx, "promotions")[0]?.usageCount).toBe(0)
    expect(rows(ctx, "promotionUsages")).toHaveLength(0)
  })

  it("does not release twice, and never drives the counter negative", async () => {
    const ctx = couponedOrder()

    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })
    // `cancelled` is terminal and a replayed status returns before the branch,
    // so a double-clicked button or a webhook retry cannot double-credit.
    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

    expect(rows(ctx, "promotions")[0]?.usageCount).toBe(0)
  })

  it("leaves an order that carried no promotion alone", async () => {
    const ctx = createCountingDb({
      orders: [
        {
          _id: "orders:1",
          storeId: STORE,
          orderNumber: "2026-0002",
          status: "confirmed",
          type: "pickup",
          paymentStatus: "pending",
          paymentMethod: "cash",
          source: "website",
          customerInfo: { name: "Sans coupon" },
          items: [],
          subtotal: 1000,
          total: 1000,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      promotions: [
        {
          _id: "promotions:1",
          storeId: STORE,
          name: "Autre offre",
          usageCount: 5,
          isActive: true,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      promotionUsages: [],
      kitchenTickets: [],
      emailSubscribers: [],
    })

    await updateStatus.handler(ctx, { id: "orders:1", status: "cancelled" })

    expect(rows(ctx, "promotions")[0]?.usageCount).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// #312 — orders.ts:1690 orders.remove
// ---------------------------------------------------------------------------

describe("#312 orders.remove — the invoice is not the delete button's to take", () => {
  const paidOrder = {
    _id: "orders:1",
    storeId: STORE,
    orderNumber: "2026-0003",
    status: "completed",
    type: "delivery",
    paymentStatus: "paid",
    paymentMethod: "card",
    source: "website",
    customerInfo: { name: "Camille", email: "camille@example.fr" },
    items: [],
    subtotal: 2000,
    total: 2000,
    createdAt: 0,
    updatedAt: 0,
  }

  it("refuses when an invoice was issued, and keeps both documents", async () => {
    const ctx = createCountingDb({
      orders: [{ ...paidOrder, invoiceId: "invoices:1" }],
      invoices: [
        {
          _id: "invoices:1",
          storeId: STORE,
          orderId: "orders:1",
          number: "F-2026-0001",
          kind: "invoice",
          year: 2026,
          issuedAt: NOW,
        },
      ],
      payments: [],
      kitchenTickets: [],
      promotionUsages: [],
    })

    const refusal = await refusalFrom(() =>
      removeOrder.handler(ctx, { id: "orders:1" })
    )

    expect(refusal.code).toBe("order_has_invoice")
    expect(refusal.message).toContain("F-2026-0001")
    // art. 242 nonies A CGI: the series has no holes, and neither does the
    // order it points at.
    expect(rows(ctx, "orders")).toHaveLength(1)
    expect(rows(ctx, "invoices")).toHaveLength(1)
  })

  it("refuses on the invoice even when the order lost its `invoiceId`", async () => {
    // `orders.invoiceId` is optional; `invoices.by_orderId` is the
    // authoritative side of the same link, and an order invoiced before that
    // column was populated has only the second one.
    const ctx = createCountingDb({
      orders: [paidOrder],
      invoices: [
        {
          _id: "invoices:1",
          storeId: STORE,
          orderId: "orders:1",
          number: "F-2026-0002",
          kind: "invoice",
          year: 2026,
          issuedAt: NOW,
        },
      ],
      payments: [],
      kitchenTickets: [],
      promotionUsages: [],
    })

    const refusal = await refusalFrom(() =>
      removeOrder.handler(ctx, { id: "orders:1" })
    )

    expect(refusal.code).toBe("order_has_invoice")
    expect(rows(ctx, "orders")).toHaveLength(1)
  })

  it("refuses while a payment stands, so no takings lose their order", async () => {
    const ctx = createCountingDb({
      orders: [paidOrder],
      invoices: [],
      payments: [
        {
          _id: "payments:1",
          orderId: "orders:1",
          storeId: STORE,
          amount: 2000,
          currency: "EUR",
          provider: "stripe",
          status: "succeeded",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      kitchenTickets: [],
      promotionUsages: [],
    })

    const refusal = await refusalFrom(() =>
      removeOrder.handler(ctx, { id: "orders:1" })
    )

    expect(refusal.code).toBe("order_has_payment")
    expect(rows(ctx, "orders")).toHaveLength(1)
    expect(rows(ctx, "payments")).toHaveLength(1)
  })

  it("refuses while a payment is still in flight", async () => {
    // The provider's webhook would come back to patch an order that is gone.
    const ctx = createCountingDb({
      orders: [{ ...paidOrder, paymentStatus: "pending" }],
      invoices: [],
      payments: [
        {
          _id: "payments:1",
          orderId: "orders:1",
          storeId: STORE,
          amount: 2000,
          currency: "EUR",
          provider: "stripe",
          status: "processing",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      kitchenTickets: [],
      promotionUsages: [],
    })

    expect((await refusalFrom(() => removeOrder.handler(ctx, { id: "orders:1" }))).code).toBe(
      "order_has_payment"
    )
  })

  it("deletes an unpaid order and leaves no orphan behind", async () => {
    const ctx = createCountingDb({
      orders: [
        {
          ...paidOrder,
          paymentStatus: "failed",
          status: "cancelled",
          promotionId: "promotions:1",
          uberDirectEstimateId: "est_1",
        },
      ],
      invoices: [],
      payments: [
        {
          _id: "payments:1",
          orderId: "orders:1",
          storeId: STORE,
          amount: 2000,
          currency: "EUR",
          provider: "stripe",
          // A dead attempt. Machine-kept, and its `orderId` is REQUIRED.
          status: "failed",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      kitchenTickets: [
        {
          _id: "kitchenTickets:1",
          orderId: "orders:1",
          storeId: STORE,
          status: "cancelled",
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      deliveryQuotes: [
        {
          _id: "deliveryQuotes:1",
          estimateId: "est_1",
          storeId: STORE,
          fee: 490,
          currency: "EUR",
          dropoffLatitude: 48.8,
          dropoffLongitude: 2.3,
          expiresAt: NOW + 600_000,
          consumedByOrderId: "orders:1",
          createdAt: 0,
        },
      ],
      promotions: [
        {
          _id: "promotions:1",
          storeId: STORE,
          name: "BIENVENUE10",
          usageCount: 1,
          isActive: true,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      promotionUsages: [
        {
          _id: "promotionUsages:1",
          storeId: STORE,
          promotionId: "promotions:1",
          customerEmail: "camille@example.fr",
          orderId: "orders:1",
          usedAt: 0,
        },
      ],
    })

    await removeOrder.handler(ctx, { id: "orders:1" })

    expect(rows(ctx, "orders")).toHaveLength(0)
    // Not one row left holding an id that resolves to nothing.
    expect(rows(ctx, "kitchenTickets")).toHaveLength(0)
    expect(rows(ctx, "payments")).toHaveLength(0)
    expect(rows(ctx, "promotionUsages")).toHaveLength(0)
    // Deleted rather than detached: clearing `consumedByOrderId` would make a
    // spent quote reusable, which is the hole that column closed.
    expect(rows(ctx, "deliveryQuotes")).toHaveLength(0)
    // An order that never happened did not spend a coupon.
    expect(rows(ctx, "promotions")[0]?.usageCount).toBe(0)
  })

  it("is a no-op on an order that is already gone", async () => {
    const ctx = createCountingDb({ orders: [] })
    await expect(removeOrder.handler(ctx, { id: "orders:404" })).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// #313 — uberEatsOrders.ts:14 saveFromPlatform
// ---------------------------------------------------------------------------

describe("#313 the dead Uber Eats importer stays deleted", () => {
  it("is gone from the package barrel", () => {
    // `saveFromPlatform` inserted `paymentStatus: "paid"` with no
    // `releaseToKitchen`, so an order created through it would have been paid
    // and never reached the pass. Its docblock claimed the webhook action
    // called it; `grep` found zero callers, and the live path is
    // `orders.createFromWebhook`. Re-exporting it would bring back a second,
    // wrong way to create a marketplace order.
    expect(Object.keys(convexFunctions)).not.toContain("uberEatsOrders")
    expect(Object.keys(convexFunctions)).toContain("orders")
  })
})
