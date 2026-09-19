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
 * `@be-yours/convex-schema` and refuses a query that names one that does
 * not exist. The four indexes these guards needed — `gamePlays.by_gameId`,
 * `gamePlays.by_prizeId`, `prizeRedemptions.by_prizeId`,
 * `promotionUsages.by_orderId` — are therefore proved by these tests to be
 * declared, not merely spelled correctly.
 *
 * #412 ADDED FIVE MORE, found by asking the same question of the removes #400
 * did not reach. Same rule, applied the same way: what the machine wrote about
 * a person is cleaned up with them, and what HAPPENED refuses. So a subscriber
 * takes their events and automation runs with them, while a campaign that has
 * already reached somebody, a QR code that has been played, a formule a prize
 * gives away, a coupon an order was discounted by and an automation that has
 * mailed anyone all refuse and say what to do instead.
 */

import { describe, it, expect } from "vitest"
import { remove as removePrize } from "../prizes"
import { remove as removeGame } from "../games"
import { remove as removeTemplate } from "../emailTemplates"
import { remove as removeSegment } from "../emailSegments"
import { remove as removeOrder, updateStatus } from "../orders"
import { remove as removeSubscriber, SUBSCRIBER_DEPENDENT_BATCH } from "../emailSubscribers"
import { remove as removeCampaign } from "../emailCampaigns"
import { remove as removeQRCode, setActive as setQRCodeActive } from "../gameQRCodes"
import { remove as removeMenu, purgeTranslations } from "../menus"
import { remove as removePromotion } from "../promotions"
import { remove as removeAutomation } from "../emailAutomations"
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

// ---------------------------------------------------------------------------
// #412 P3-F2 — emailSubscribers.ts:381
// ---------------------------------------------------------------------------

describe("#412 P3-F2 emailSubscribers.remove — a person's rows go with them", () => {
  const subscriber = {
    _id: "emailSubscribers:1",
    storeId: STORE,
    email: "diner@example.fr",
    status: "active",
    source: "storefront_form",
    createdAt: NOW,
    updatedAt: NOW,
  }

  const runs = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      _id: `emailAutomationRuns:${i}`,
      storeId: STORE,
      automationId: "emailAutomations:1",
      subscriberId: "emailSubscribers:1",
      stepId: `step-${i}`,
      sentAt: NOW,
    }))

  const events = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      _id: `emailEvents:${i}`,
      storeId: STORE,
      campaignId: "emailCampaigns:1",
      subscriberId: "emailSubscribers:1",
      type: "sent",
      occurredAt: NOW,
    }))

  it("leaves nothing holding a subscriberId that resolves to nothing", async () => {
    // Both columns are REQUIRED. Deleting the subscriber alone left two tables
    // promising a row the database no longer had.
    const ctx = createCountingDb({
      emailSubscribers: [subscriber],
      emailAutomationRuns: runs(2),
      emailEvents: events(3),
    })

    const result = await removeSubscriber.handler(ctx, { id: "emailSubscribers:1" })

    expect(result).toEqual({ deleted: 5, complete: true })
    expect(rows(ctx, "emailSubscribers")).toHaveLength(0)
    expect(rows(ctx, "emailAutomationRuns")).toHaveLength(0)
    expect(rows(ctx, "emailEvents")).toHaveLength(0)
  })

  it("keeps the subscriber until the pass that finishes their rows", async () => {
    // The half-drained state is the dangerous one: a subscriber deleted on the
    // first pass would leave every remaining event pointing at nothing for as
    // long as the drain took.
    const ctx = createCountingDb({
      emailSubscribers: [subscriber],
      emailAutomationRuns: [],
      emailEvents: events(SUBSCRIBER_DEPENDENT_BATCH + 7),
    })

    const first = await removeSubscriber.handler(ctx, { id: "emailSubscribers:1" })
    expect(first.complete).toBe(false)
    expect(rows(ctx, "emailSubscribers")).toHaveLength(1)
    expect(ctx.reads()).toBeLessThanOrEqual(SUBSCRIBER_DEPENDENT_BATCH + 2)

    const second = await removeSubscriber.handler(ctx, { id: "emailSubscribers:1" })
    expect(second.complete).toBe(true)
    expect(rows(ctx, "emailSubscribers")).toHaveLength(0)
    expect(rows(ctx, "emailEvents")).toHaveLength(0)
  })

  it("does not touch another subscriber's rows", async () => {
    const ctx = createCountingDb({
      emailSubscribers: [subscriber, { ...subscriber, _id: "emailSubscribers:2", email: "b@example.fr" }],
      emailAutomationRuns: [],
      emailEvents: [
        ...events(1),
        { _id: "emailEvents:other", storeId: STORE, subscriberId: "emailSubscribers:2", type: "sent", occurredAt: NOW },
      ],
    })

    await removeSubscriber.handler(ctx, { id: "emailSubscribers:1" })

    expect(rows(ctx, "emailEvents").map((row) => row._id)).toEqual(["emailEvents:other"])
    expect(rows(ctx, "emailSubscribers")).toHaveLength(1)
  })

  it("is idempotent, because the drain re-runs it", async () => {
    const ctx = createCountingDb({ emailSubscribers: [] })
    await expect(
      removeSubscriber.handler(ctx, { id: "emailSubscribers:404" })
    ).resolves.toEqual({ deleted: 0, complete: true })
  })
})

// ---------------------------------------------------------------------------
// #412 P3-F3 — emailCampaigns.ts:151
// ---------------------------------------------------------------------------

describe("#412 P3-F3 emailCampaigns.remove — the record of who was reached", () => {
  const campaign = {
    _id: "emailCampaigns:1",
    storeId: STORE,
    name: "Promo été",
    subject: "-20%",
    status: "failed",
  }

  it("refuses a campaign that has already reached part of the list", async () => {
    // `failed` only ever follows `sending`, so this campaign has mailed a
    // prefix of the list. The events keyed to it are what makes « Relancer »
    // resume instead of starting again; deleting the campaign makes them
    // unaddressable, and rebuilding it mails those people twice.
    const ctx = createCountingDb({
      emailCampaigns: [campaign],
      emailEvents: [
        {
          _id: "emailEvents:1",
          storeId: STORE,
          campaignId: "emailCampaigns:1",
          subscriberId: "emailSubscribers:1",
          type: "sent",
          occurredAt: NOW,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeCampaign.handler(ctx, { id: "emailCampaigns:1" })
    )

    expect(refusal.code).toBe("campaign_already_sent")
    // `failed` is one of the two statuses the screen offers « Relancer » for.
    expect(refusal.message).toContain("Relancer")
    expect(rows(ctx, "emailCampaigns")).toHaveLength(1)
    // And the record itself is untouched — this is a refusal, not a cascade.
    expect(rows(ctx, "emailEvents")).toHaveLength(1)
  })

  it("does not name « Relancer » on a campaign the screen cannot relaunch", async () => {
    // A campaign cancelled mid-list is refused too, and the screen renders
    // « Relancer » for `paused` and `failed` only. Sending the owner after a
    // control that is not there is the dead end this guard exists to avoid.
    const ctx = createCountingDb({
      emailCampaigns: [{ ...campaign, status: "cancelled" }],
      emailEvents: [
        {
          _id: "emailEvents:1",
          storeId: STORE,
          campaignId: "emailCampaigns:1",
          subscriberId: "emailSubscribers:1",
          type: "sent",
          occurredAt: NOW,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeCampaign.handler(ctx, { id: "emailCampaigns:1" })
    )

    expect(refusal.code).toBe("campaign_already_sent")
    expect(refusal.message).not.toContain("Relancer")
    expect(refusal.message).toContain("historique")
  })

  it("still deletes a campaign nobody ever received", async () => {
    const ctx = createCountingDb({
      emailCampaigns: [{ ...campaign, status: "draft" }],
      emailEvents: [],
    })
    await removeCampaign.handler(ctx, { id: "emailCampaigns:1" })
    expect(rows(ctx, "emailCampaigns")).toHaveLength(0)
  })

  it("costs one index lookup however big the campaign was", async () => {
    const ctx = createCountingDb({
      emailCampaigns: [campaign],
      emailEvents: Array.from({ length: 5_000 }, (_, i) => ({
        _id: `emailEvents:${i}`,
        storeId: STORE,
        campaignId: "emailCampaigns:1",
        subscriberId: `emailSubscribers:${i}`,
        type: "sent",
        occurredAt: NOW,
      })),
    })

    await refusalFrom(() => removeCampaign.handler(ctx, { id: "emailCampaigns:1" }))

    // The campaign, and one event. Not the 5,000 it produced.
    expect(ctx.reads()).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// #412 P3-F4 — gameQRCodes.ts:22, menus.ts:273, promotions.ts:354,
//              emailAutomations.ts:124
// ---------------------------------------------------------------------------

describe("#412 P3-F4 gameQRCodes.remove — where the consent was given", () => {
  const qrCode = {
    _id: "gameQRCodes:1",
    storeId: STORE,
    code: "TABLE12",
    tableNumber: "12",
    isActive: true,
    scannedCount: 7,
    createdAt: NOW,
    updatedAt: NOW,
  }

  it("refuses a code that has been played, and keeps the play", async () => {
    // `gamePlays.qrCodeId` has no reader anywhere, which is exactly why this
    // went unnoticed: nothing crashed. What was lost is the only field saying
    // WHERE a diner's consent under art. 7.1 was collected.
    const ctx = createCountingDb({
      gameQRCodes: [qrCode],
      gamePlays: [
        {
          _id: "gamePlays:1",
          storeId: STORE,
          gameId: "games:1",
          qrCodeId: "gameQRCodes:1",
          playedAt: NOW,
        },
      ],
    })

    const refusal = await refusalFrom(() => removeQRCode.handler(ctx, { id: "gameQRCodes:1" }))

    expect(refusal.code).toBe("qr_code_has_plays")
    expect(refusal.message).toContain("TABLE12")
    expect(refusal.message).toContain("Désactivez-le")
    expect(rows(ctx, "gameQRCodes")).toHaveLength(1)
    expect(rows(ctx, "gamePlays")[0].qrCodeId).toBe("gameQRCodes:1")
  })

  it("still deletes a code nobody has played", async () => {
    const ctx = createCountingDb({ gameQRCodes: [qrCode], gamePlays: [] })
    await removeQRCode.handler(ctx, { id: "gameQRCodes:1" })
    expect(rows(ctx, "gameQRCodes")).toHaveLength(0)
  })

  it("offers the way out the refusal names", async () => {
    // A refusal whose alternative does not exist is a dead end.
    const ctx = createCountingDb({ gameQRCodes: [qrCode] })
    await setQRCodeActive.handler(ctx, { id: "gameQRCodes:1", isActive: false })
    expect(rows(ctx, "gameQRCodes")[0].isActive).toBe(false)
  })
})

describe("#412 P3-F4 menus.remove", () => {
  const menu = { _id: "menus:1", storeId: STORE, name: "Formule midi", price: 1590 }

  it("refuses while a prize gives the formule away", async () => {
    const ctx = createCountingDb({
      menus: [menu],
      prizes: [{ _id: "prizes:1", storeId: STORE, name: "Menu offert", type: "free_menu", menuId: "menus:1" }],
      translations: [],
    })

    const refusal = await refusalFrom(() => removeMenu.handler(ctx, { id: "menus:1" }))

    expect(refusal.code).toBe("menu_in_prize")
    expect(refusal.message).toContain("« Menu offert »")
    expect(rows(ctx, "menus")).toHaveLength(1)
  })

  it("takes the menu's own translations with it, and only those", async () => {
    // `translations.entityId` is a `v.string()`, so no validator could ever see
    // that it was a foreign key. The rows are the menu's name and description
    // in the owner's other languages and are of no use to anything else.
    const ctx = createCountingDb({
      menus: [menu],
      prizes: [],
      translations: [
        { _id: "translations:1", storeId: STORE, entityType: "menus", entityId: "menus:1", field: "name", languageCode: "en", value: "Lunch set", isAutoTranslated: true, updatedAt: NOW },
        { _id: "translations:2", storeId: STORE, entityType: "menus", entityId: "menus:2", field: "name", languageCode: "en", value: "Other", isAutoTranslated: true, updatedAt: NOW },
        { _id: "translations:3", storeId: STORE, entityType: "products", entityId: "menus:1", field: "name", languageCode: "en", value: "Not a menu", isAutoTranslated: true, updatedAt: NOW },
      ],
    })

    const result = await removeMenu.handler(ctx, { id: "menus:1" })

    expect(result).toEqual({ deleted: 1, hasMore: false })
    expect(rows(ctx, "menus")).toHaveLength(0)
    expect(rows(ctx, "translations").map((row) => row._id)).toEqual([
      "translations:2",
      "translations:3",
    ])
  })

  it("reports more to do rather than clearing a long list in one transaction", async () => {
    const ctx = createCountingDb({
      menus: [menu],
      prizes: [],
      translations: Array.from({ length: 300 }, (_, i) => ({
        _id: `translations:${i}`,
        storeId: STORE,
        entityType: "menus",
        entityId: "menus:1",
        field: `field-${i}`,
        languageCode: "en",
        value: "x",
        isAutoTranslated: true,
        updatedAt: NOW,
      })),
    })

    const first = await removeMenu.handler(ctx, { id: "menus:1" })
    expect(first.hasMore).toBe(true)

    const rest = await purgeTranslations.handler(ctx, { menuId: "menus:1", storeId: STORE })
    expect(rest.hasMore).toBe(false)
    expect(rows(ctx, "translations")).toHaveLength(0)
  })
})

describe("#412 P3-F4 promotions.remove — the order still names it", () => {
  it("refuses a coupon an order was discounted by", async () => {
    // `orders.promotionId` is optional and, until `by_promotionId` was declared
    // for this guard, unseekable — so a deleted promotion left every order it
    // discounted naming nothing, with the discount still on the order and on
    // the invoice issued for it.
    const ctx = createCountingDb({
      promotions: [{ _id: "promotions:1", storeId: STORE, name: "Bienvenue", code: "BIENVENUE" }],
      promotionUsages: [
        {
          _id: "promotionUsages:1",
          storeId: STORE,
          promotionId: "promotions:1",
          orderId: "orders:1",
          customerEmail: "diner@example.fr",
          usedAt: NOW,
        },
      ],
      orders: [{ _id: "orders:1", storeId: STORE, promotionId: "promotions:1", discountAmount: 300, total: 1200 }],
    })

    const refusal = await refusalFrom(() => removePromotion.handler(ctx, { id: "promotions:1" }))

    expect(refusal.code).toBe("promotion_in_order")
    expect(refusal.message).toContain("Désactivez-la")
    expect(rows(ctx, "promotions")).toHaveLength(1)
    // The ledger it used to erase is still there, and so is the order's link.
    expect(rows(ctx, "promotionUsages")).toHaveLength(1)
    expect(rows(ctx, "orders")[0].promotionId).toBe("promotions:1")
  })

  it("refuses on the order alone, after retention has cleared the ledger", async () => {
    // The reason the guard reads `orders` and not only `promotionUsages`: the
    // retention cron and an art. 17 erasure both clear usage rows, while a paid
    // order is ANONYMISED and keeps its `promotionId` and its discount. A proxy
    // would have made a three-year-old coupon deletable again.
    const ctx = createCountingDb({
      promotions: [{ _id: "promotions:1", storeId: STORE, name: "Bienvenue", code: "BIENVENUE" }],
      promotionUsages: [],
      orders: [{ _id: "orders:1", storeId: STORE, promotionId: "promotions:1", discountAmount: 300, total: 1200 }],
    })

    const refusal = await refusalFrom(() => removePromotion.handler(ctx, { id: "promotions:1" }))

    expect(refusal.code).toBe("promotion_in_order")
    expect(rows(ctx, "promotions")).toHaveLength(1)
  })

  it("refuses on the ledger alone, when a usage row outlived its order", async () => {
    // `promotionUsages.orderId` is optional and `promotionId` is REQUIRED, so a
    // usage row with no order is still a reference the delete would strand.
    const ctx = createCountingDb({
      promotions: [{ _id: "promotions:1", storeId: STORE, name: "Bienvenue", code: "BIENVENUE" }],
      promotionUsages: [
        { _id: "promotionUsages:1", storeId: STORE, promotionId: "promotions:1", customerEmail: "a@b.fr", usedAt: NOW },
      ],
      orders: [],
    })

    const refusal = await refusalFrom(() => removePromotion.handler(ctx, { id: "promotions:1" }))
    expect(refusal.code).toBe("promotion_in_order")
  })

  it("still deletes a coupon nobody ever redeemed", async () => {
    const ctx = createCountingDb({
      promotions: [{ _id: "promotions:1", storeId: STORE, name: "Jamais utilisée", code: "OOPS" }],
      promotionUsages: [],
      orders: [],
    })
    await removePromotion.handler(ctx, { id: "promotions:1" })
    expect(rows(ctx, "promotions")).toHaveLength(0)
  })
})

describe("#412 P3-F4 emailAutomations.remove", () => {
  it("refuses while its runs record who it has already mailed", async () => {
    // No screen calls this today. That is the reason to guard it now: it is
    // live on the API under `marketing:write`, and `emailAutomationRuns` is
    // both the record of what was sent and the dedupe that stops a rescheduled
    // step sending it again.
    const ctx = createCountingDb({
      emailAutomations: [{ _id: "emailAutomations:1", storeId: STORE, name: "Bienvenue", steps: [] }],
      emailAutomationRuns: [
        {
          _id: "emailAutomationRuns:1",
          storeId: STORE,
          automationId: "emailAutomations:1",
          subscriberId: "emailSubscribers:1",
          stepId: "s1",
          sentAt: NOW,
        },
      ],
    })

    const refusal = await refusalFrom(() =>
      removeAutomation.handler(ctx, { id: "emailAutomations:1" })
    )

    expect(refusal.code).toBe("automation_has_runs")
    expect(rows(ctx, "emailAutomations")).toHaveLength(1)
  })

  it("still deletes an automation that never ran", async () => {
    const ctx = createCountingDb({
      emailAutomations: [{ _id: "emailAutomations:1", storeId: STORE, name: "Jamais lancée", steps: [] }],
      emailAutomationRuns: [],
    })
    await removeAutomation.handler(ctx, { id: "emailAutomations:1" })
    expect(rows(ctx, "emailAutomations")).toHaveLength(0)
  })
})
