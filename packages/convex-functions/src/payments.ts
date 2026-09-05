/**
 * Payment management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { planRefund } from "./refundPolicy"
import { paymentStatusAfterSettlement } from "./paymentSettlement"

/** The providers whose events can settle or reverse a charge on their own. */
const PROVIDER_EVENT_SOURCE = v.union(
  v.literal("stripe"),
  v.literal("sumup"),
  v.literal("paypal")
)

/** Every payment carrying this provider reference. Single-field on purpose. */
async function byExternalId(ctx: any, externalId: string) {
  return await ctx.db
    .query("payments")
    .withIndex("by_externalId", (q: any) => q.eq("externalId", externalId))
    .collect()
}

// === QUERIES ===

/**
 * Get payments by order
 */
export const getByOrder = {
  args: { orderId: v.id("orders") },
  handler: async (ctx: any, args: { orderId: string }) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .collect()
  },
}

/** The filters `/dashboard/payments` offers, as the query understands them. */
const PAYMENT_STATUS = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("refunded"),
  v.literal("partially_refunded")
)

/** Square is announced, not built — it can appear on no past payment. */
const PAYMENT_PROVIDER = v.union(
  v.literal("stripe"),
  v.literal("sumup"),
  v.literal("paypal"),
  v.literal("square"),
  v.literal("cash")
)

/**
 * One page of a store's payments, newest first, filtered where it is asked.
 *
 * WHY IT IS PAGINATED. This returned every payment the establishment had ever
 * taken, and `/dashboard/payments` then applied both of its filters in the
 * browser. Measured on a seeded store: 4,000 rows in the table, 4,000 rows
 * returned. Convex aborts a transaction that reads more than 16,384 documents,
 * so the screen was on a path to throwing on every load — at 40 payments a day,
 * inside about fourteen months — with no admin action able to clear it.
 *
 * WHY THE FILTERS MOVED TO THE SERVER. A filter applied after the read saves
 * nothing: the cost is the read. Both of them are equalities on indexed fields,
 * so all four combinations — neither, status, provider, both — resolve to an
 * exact index range here, and the page reads only the rows it shows.
 */
export const getByStore = {
  args: {
    storeId: v.id("stores"),
    status: v.optional(PAYMENT_STATUS),
    provider: v.optional(PAYMENT_PROVIDER),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      status?: string
      provider?: string
      paginationOpts: { numItems: number; cursor: string | null }
    }
  ) => {
    const newestFirst = (query: any) => query.order("desc").paginate(args.paginationOpts)

    if (args.provider) {
      // `by_storeId_provider_status` carries provider before status, so this
      // covers "provider alone" and "provider and status" from one index.
      return await newestFirst(
        ctx.db
          .query("payments")
          .withIndex("by_storeId_provider_status", (q: any) => {
            const scoped = q.eq("storeId", args.storeId).eq("provider", args.provider)
            return args.status ? scoped.eq("status", args.status) : scoped
          })
      )
    }

    if (args.status) {
      return await newestFirst(
        ctx.db
          .query("payments")
          .withIndex("by_storeId_status", (q: any) =>
            q.eq("storeId", args.storeId).eq("status", args.status)
          )
      )
    }

    return await newestFirst(
      ctx.db
        .query("payments")
        .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
    )
  },
}

// === MUTATIONS ===

/**
 * Create a new payment
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    currency: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.object({
      last4: v.optional(v.string()),
      brand: v.optional(v.string()),
      receiptUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx: any, args: { storeId: string; orderId: string; amount: number; currency: string; provider: string; externalId?: string; metadata?: { last4?: string; brand?: string; receiptUrl?: string } }) => {
    if (args.amount <= 0) throw new Error("Payment amount must be positive")
    const now = Date.now()
    return await ctx.db.insert("payments", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Record a settled provider payment, exactly once.
 *
 * WHY THIS EXISTS: two writers settle the same Stripe charge — the return page
 * (`stripe.verifyCheckoutSession`) and the webhook (`stripeWebhook.handleWebhook`).
 * Each read `order.paymentStatus !== "paid"` and then wrote, in separate
 * transactions, so the loser of that race still inserted. Every call site
 * wrapped `create` in `try {} catch {}` under the comment "Payment record may
 * already exist" — which cannot be true: `db.insert` has no duplicate to throw
 * on, and `by_externalId` existed on the table but was queried by nothing.
 *
 * The result was two `succeeded` rows for one 48 € charge. `planRefund`
 * validates each row against its OWN amount, so 96 € was refundable.
 *
 * Three deliberate choices:
 *
 *  - `by_externalId` is a SINGLE-field index and stays that way. One provider
 *    charge means one row, whatever order claims it. A compound
 *    (orderId, externalId) index would read "same charge, different order" as a
 *    miss and insert a second row, which is the replay this refuses.
 *  - `externalId` is optional on the table (cash has none), and
 *    `q.eq("externalId", undefined)` matches every cash payment. A settlement
 *    with no reference is refused outright: it can be neither deduplicated nor
 *    refunded through the provider.
 *  - The row is inserted directly as "succeeded". The old `create` then
 *    `updateStatus` pair was a second read-then-write window, and the reason a
 *    row could sit at "pending" forever when the second call never landed.
 */
export const settlePayment = {
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    currency: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
    externalId: v.string(),
    metadata: v.optional(v.object({
      last4: v.optional(v.string()),
      brand: v.optional(v.string()),
      receiptUrl: v.optional(v.string()),
    })),
  },
  handler: async (
    ctx: any,
    args: {
      storeId: string
      orderId: string
      amount: number
      currency: string
      provider: string
      externalId: string
      metadata?: { last4?: string; brand?: string; receiptUrl?: string }
    }
  ): Promise<{ paymentId: string; created: boolean }> => {
    if (args.amount <= 0) throw new Error("Payment amount must be positive")

    const externalId = args.externalId.trim()
    if (!externalId) {
      throw new Error(
        "Un règlement fournisseur doit porter une référence de transaction."
      )
    }

    const existing = await byExternalId(ctx, externalId)

    // Someone else's charge replayed against this order: the provider reference
    // already settled a different one. Refusing is the point — this is the
    // duplicate a compound index would have missed.
    const cross = existing.find((p: any) => p.orderId !== args.orderId)
    if (cross) {
      throw new Error(
        `Ce paiement ${args.provider} règle déjà la commande ${cross.orderId}.`
      )
    }

    const match = existing.find((p: any) => p.orderId === args.orderId)
    if (match) {
      return { paymentId: match._id, created: false }
    }

    const now = Date.now()
    const paymentId = await ctx.db.insert("payments", {
      ...args,
      externalId,
      status: "succeeded",
      createdAt: now,
      updatedAt: now,
    })

    return { paymentId, created: true }
  },
}

/**
 * The two payment states this mutation must never be able to write.
 *
 * Both mean "money went back to the customer", and nothing about a status patch
 * moves money.
 */
export const REFUND_STATUSES = ["refunded", "partially_refunded"] as const

/**
 * Move a payment through its NON-refund states.
 *
 * WHY THE UNION IS SHORTER THAN THE TABLE'S: this took `"refunded"` and did a
 * bare `ctx.db.patch` with no provider call anywhere — the same money-lie issue
 * #128 was raised to remove from `payments.refund`, still open in a second
 * doorway. It is exposed publicly as a `storeMutation` under `payments:write`,
 * a permission held for taking payments rather than giving them back.
 *
 * The damage was not "the books read wrong". The patched row has
 * `refundedAmount: undefined` and `externalRefundId: undefined`, and
 * `planRefund` only accepts `succeeded` and `partially_refunded` — so the very
 * next real refund attempt dies on `Un paiement au statut « refunded » ne peut
 * pas être remboursé.` The lie is permanent: the customer can no longer be paid
 * back through the product at all.
 *
 * Refunds have exactly one entrance, `payments.refundPayment`: it reserves the
 * amount, calls the provider, and records the outcome with the provider's own
 * reference as proof. A refund the provider performed on its own side arrives
 * through `recordProviderRefund` below, carrying the amount Stripe reports.
 *
 * Guarded twice on purpose. The validator refuses the argument at the door, so
 * no Convex client can even send it; the runtime check covers a caller reaching
 * the definition directly, and gives a reason instead of a validator error.
 */
export const updateStatus = {
  args: {
    id: v.id("payments"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed")
    ),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx: any, args: { id: string; status: string; externalId?: string }) => {
    const { id, status, externalId } = args

    if ((REFUND_STATUSES as readonly string[]).includes(status)) {
      throw new Error(
        "Un remboursement ne peut pas être enregistré par une mise à jour de statut : " +
          "utilisez le remboursement, qui appelle le fournisseur avant d'écrire quoi que ce soit."
      )
    }

    const updates: Record<string, unknown> = {
      status,
      updatedAt: Date.now(),
    }

    if (externalId) {
      updates.externalId = externalId
    }

    await ctx.db.patch(id, updates)
  },
}

/**
 * Fetch a single payment. Used by the refund action, which runs in an action
 * context and therefore cannot touch the database directly.
 */
export const getById = {
  args: { id: v.id("payments") },
  handler: async (ctx: any, args: { id: string }) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Commit a refund's amount BEFORE the provider is asked to move the money.
 *
 * The write that recorded a refund re-validated against a fresh document, so
 * the stored balance could never overshoot — but it ran AFTER the provider
 * call. Two refund requests arriving together both read `refundedAmount: 0`,
 * both passed `planRefund`, and both sent a refund to Stripe. The money left the
 * account twice; the second write then threw and the second refund was never
 * even recorded. The database stayed consistent and the till did not.
 *
 * That write — `recordRefund` — has since been deleted. Once the reservation
 * moved in front of the provider call it had no callers left, and it remained
 * registered as `internal.payments.internalRecordRefund` on every deployed
 * backend: a live mutation that patched a payment AND its order to `refunded`
 * with no provider call and no permission check. The same money-lie as
 * `updateStatus` above, in a third doorway.
 *
 * A Convex mutation is a transaction, so reserving here is the serialisation
 * point: the second caller reads the first caller's committed amount and is
 * refused before anything leaves.
 */
export const reserveRefund = {
  args: {
    id: v.id("payments"),
    amount: v.number(),
    reason: v.optional(v.string()),
    refundMethod: v.union(v.literal("api"), v.literal("manual")),
  },
  handler: async (
    ctx: any,
    args: {
      id: string
      amount: number
      reason?: string
      refundMethod: "api" | "manual"
    }
  ) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const plan = planRefund({
      payment: {
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        refundedAmount: payment.refundedAmount,
        externalId: payment.externalId,
      },
      amount: args.amount,
    })

    const now = Date.now()
    const refunds = [
      ...(payment.refunds ?? []),
      {
        amount: args.amount,
        reason: args.reason,
        method: args.refundMethod,
        state: "reserved" as const,
        at: now,
      },
    ]

    await ctx.db.patch(args.id, {
      refundedAmount: plan.refundedAmount,
      refundReason: args.reason,
      status: plan.paymentStatus,
      refundedAt: now,
      refundMethod: args.refundMethod,
      refunds,
      updatedAt: now,
    })

    const orderId = payment.orderId as string
    if (orderId) {
      await ctx.db.patch(orderId, {
        paymentStatus: plan.orderPaymentStatus,
        updatedAt: now,
      })
    }

    return { plan, index: refunds.length - 1 }
  },
}

/** Attach the provider's reference once the money has actually moved. */
export const confirmRefund = {
  args: {
    id: v.id("payments"),
    index: v.number(),
    externalRefundId: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: { id: string; index: number; externalRefundId?: string }
  ) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const refunds = [...(payment.refunds ?? [])]
    const entry = refunds[args.index]
    if (!entry) throw new Error("Refund reservation not found")

    refunds[args.index] = {
      ...entry,
      externalRefundId: args.externalRefundId,
      state: "confirmed" as const,
    }

    await ctx.db.patch(args.id, {
      refunds,
      // The scalar keeps pointing at the most recent refund, for the screens
      // that read it; `refunds` is what survives a second partial refund.
      externalRefundId: args.externalRefundId ?? payment.externalRefundId,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Give a reservation back when the provider refused.
 *
 * Without this a failed provider call would leave the amount committed, and the
 * restaurant could never refund it — the balance would say the money was
 * already returned.
 */
export const releaseRefund = {
  args: {
    id: v.id("payments"),
    index: v.number(),
  },
  handler: async (ctx: any, args: { id: string; index: number }) => {
    const payment = await ctx.db.get(args.id)
    if (!payment) throw new Error("Payment not found")

    const refunds = [...(payment.refunds ?? [])]
    const entry = refunds[args.index]
    if (!entry || entry.state !== "reserved") return

    refunds[args.index] = { ...entry, state: "released" as const }

    const refundedAmount = Math.max(
      0,
      (payment.refundedAmount ?? 0) - entry.amount
    )
    // Back to "succeeded", NOT "completed": `planRefund` only accepts
    // "succeeded" and "partially_refunded", so releasing into "completed" would
    // have made the refund impossible to retry — the exact opposite of the
    // point. A test freezes this.
    const status = refundedAmount === 0 ? "succeeded" : "partially_refunded"

    await ctx.db.patch(args.id, {
      refunds,
      refundedAmount,
      status,
      updatedAt: Date.now(),
    })

    const orderId = payment.orderId as string
    if (orderId) {
      // Releasing a refund on a CANCELLED order must not read as "paid". That
      // order was paid and then cancelled, so it sits at "refund_pending": the
      // money is still owed back and a human still has to send it. Writing
      // "paid" here would erase the only marker saying so, and the refund the
      // provider just refused would be forgotten rather than retried.
      const order = await ctx.db.get(orderId)
      const settled = order?.status === "cancelled" ? "refund_pending" : "paid"

      await ctx.db.patch(orderId, {
        paymentStatus: refundedAmount === 0 ? settled : "partially_refunded",
        updatedAt: Date.now(),
      })
    }
  },
}

// === Provider-side events ===
//
// Everything below exists because the money can move without us being told in
// the one way we were listening for. `stripeWebhookVerify` normalised exactly
// one event type, `checkout.session.completed`, and `stripeWebhook` acted on
// exactly that one; `payment_intent.succeeded`, `payment_intent.payment_failed`,
// `charge.refunded` and `charge.dispute.created` were acknowledged with a 200
// and discarded.
//
// The consequences were a paid charge with no order to show for it, and a refund
// issued from the Stripe dashboard that our books never heard about.
//
// Resolution back to an order goes through `payments.externalId` — the payment
// intent id — and the single-field `by_externalId` index that already serves
// `settlePayment`. It has to: only `checkout.session.completed` carries our
// `metadata.orderId`, because `sessions.create` sets it on the SESSION. A
// `payment_intent.*` or `charge.*` event has no metadata of ours at all.

/**
 * How far past its creation an unpaid order is worth asking the provider about.
 *
 * Below the floor the customer may still be on the payment page. Above the
 * ceiling the checkout session has expired on Stripe's side (24 h) and there is
 * nothing left to ask.
 */
export const RECONCILE_MIN_AGE_MINUTES = 10
export const RECONCILE_MAX_AGE_HOURS = 24

/**
 * Remember which Stripe Checkout Session an order was sent to pay through.
 *
 * The session id was returned to the browser (`stripe.createCheckoutSession`)
 * and stored nowhere, so an order whose customer never came back could not even
 * be named to Stripe. Written from the action that creates the session, in its
 * own mutation because an action has no `ctx.db`.
 *
 * It lives in this module rather than with the other order mutations because it
 * exists solely to make settlement reconciliation possible, and it is read by
 * `listStrandedCheckouts` two definitions below.
 */
export const attachCheckoutSession = {
  args: {
    orderId: v.id("orders"),
    checkoutSessionId: v.string(),
  },
  handler: async (
    ctx: any,
    args: { orderId: string; checkoutSessionId: string }
  ): Promise<void> => {
    const checkoutSessionId = args.checkoutSessionId.trim()
    if (!checkoutSessionId) return

    const order = await ctx.db.get(args.orderId)
    if (!order) return

    await ctx.db.patch(args.orderId, {
      stripeCheckoutSessionId: checkoutSessionId,
      updatedAt: Date.now(),
    })
  },
}

/**
 * The orders that took a Stripe checkout and never came back paid.
 *
 * One index range — unpaid, inside the window — then a filter for the ones that
 * actually have a session to ask about. The filter is in memory rather than in
 * the index because the discriminating field is time: cash and platform orders
 * also sit at `paymentStatus: "pending"`, and they are cheap to skip once the
 * window has already bounded the scan.
 *
 * `scanLimit` bounds that scan explicitly, so a store with a busy day cannot
 * turn a scheduled sweep into a table walk.
 */
export const listStrandedCheckouts = {
  args: {
    now: v.optional(v.number()),
    minAgeMinutes: v.optional(v.number()),
    maxAgeHours: v.optional(v.number()),
    limit: v.optional(v.number()),
    scanLimit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: {
      now?: number
      minAgeMinutes?: number
      maxAgeHours?: number
      limit?: number
      scanLimit?: number
    }
  ): Promise<
    Array<{
      orderId: string
      storeId: string
      checkoutSessionId: string
      total: number
      createdAt: number
    }>
  > => {
    const now = args.now ?? Date.now()
    const newest = now - (args.minAgeMinutes ?? RECONCILE_MIN_AGE_MINUTES) * 60_000
    const oldest = now - (args.maxAgeHours ?? RECONCILE_MAX_AGE_HOURS) * 3_600_000

    const rows = await ctx.db
      .query("orders")
      .withIndex("by_paymentStatus_createdAt", (q: any) =>
        q.eq("paymentStatus", "pending").gte("createdAt", oldest).lte("createdAt", newest)
      )
      .take(args.scanLimit ?? 500)

    return rows
      .filter((order: any) => typeof order.stripeCheckoutSessionId === "string")
      .filter((order: any) => order.stripeCheckoutSessionId.trim() !== "")
      .slice(0, args.limit ?? 50)
      .map((order: any) => ({
        orderId: order._id,
        storeId: order.storeId,
        checkoutSessionId: order.stripeCheckoutSessionId as string,
        total: order.total,
        createdAt: order.createdAt,
      }))
  },
}

/**
 * Settle whatever this provider charge already refers to.
 *
 * The handler for `payment_intent.succeeded`: a second, redundant confirmation
 * that the charge went through. It resolves the order the only way such an event
 * can be resolved — by the payment intent stored as `payments.externalId` — and
 * then runs the SAME `settlePayment` the return page and the checkout webhook
 * run. That is not decoration: routing through it is what makes a second row
 * impossible here, rather than something a reader has to take on trust.
 *
 * Its real work is the order, not the payment. A settlement that recorded the
 * payment row and then failed to update the order left the charge taken and the
 * kitchen blind; this event arrives afterwards and closes that gap.
 *
 * A charge we hold no row for is reported back rather than thrown on. It may be
 * a stranded checkout — `listStrandedCheckouts` and the reconciliation sweep own
 * that case, because recovering it needs the checkout session and this event
 * does not carry one — or it may simply not be ours. Throwing would earn three
 * days of Stripe retries for something no retry can fix.
 */
export const settleFromChargeEvent = {
  args: {
    provider: PROVIDER_EVENT_SOURCE,
    externalId: v.string(),
  },
  handler: async (
    ctx: any,
    args: { provider: string; externalId: string }
  ): Promise<{
    status: "no_reference" | "unknown_charge" | "provider_mismatch" | "unknown_order" | "settled"
    created?: boolean
    orderId?: string
    paymentId?: string
  }> => {
    const externalId = args.externalId.trim()
    if (!externalId) return { status: "no_reference" }

    const [payment] = await byExternalId(ctx, externalId)
    if (!payment) return { status: "unknown_charge" }

    // `by_externalId` spans every provider, so a SumUp reference that happens to
    // equal a Stripe intent id must not be settled by a Stripe event.
    if (payment.provider !== args.provider) return { status: "provider_mismatch" }

    const order = await ctx.db.get(payment.orderId)
    if (!order) return { status: "unknown_order" }

    // Not always "mark it paid": an order cancelled after being charged is owed
    // the money back, and one already refunded must keep saying so.
    const next = paymentStatusAfterSettlement({
      status: order.status,
      paymentStatus: order.paymentStatus,
    })
    if (next) {
      await ctx.db.patch(payment.orderId, {
        paymentStatus: next,
        updatedAt: Date.now(),
      })
    }

    const settled = await settlePayment.handler(ctx, {
      storeId: payment.storeId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      externalId,
    })

    return {
      status: "settled",
      created: settled.created,
      orderId: payment.orderId,
      paymentId: settled.paymentId,
    }
  },
}

/**
 * Write down a refund or reversal the PROVIDER performed on its own.
 *
 * The handler for `charge.refunded` and `charge.dispute.created`.
 *
 * WHY THIS EXISTS: a refund issued from the Stripe dashboard — which is how an
 * owner in a hurry does it — moved real money and left our books untouched. The
 * admin went on offering the full amount as refundable, and it now accepts
 * `partially_refunded` as a refundable state, so an operator could ask to give
 * back more than remained. `planRefund` catches the overshoot server-side, so no
 * money is lost twice; what the operator gets instead is an error about a
 * balance the screen never showed them.
 *
 * `refundedTotalMinor` is CUMULATIVE, because that is what the provider reports:
 * Stripe's `charge.amount_refunded` is the running total for the charge, not the
 * delta of one refund. Recording it as a total is also what makes a replayed
 * delivery harmless — the second copy reports the same total and writes nothing.
 *
 * The stored balance is only ever raised. A refund reserved through our own UI
 * and still in flight has already committed its amount, and lowering the total
 * to whatever the provider had confirmed at the moment the event was minted
 * would hand that amount back out to be spent twice.
 */
export const recordProviderRefund = {
  args: {
    provider: PROVIDER_EVENT_SOURCE,
    externalId: v.string(),
    /** Cumulative amount the provider says has gone back, in minor units. */
    refundedTotalMinor: v.number(),
    reason: v.optional(v.string()),
    externalRefundId: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: {
      provider: string
      externalId: string
      refundedTotalMinor: number
      reason?: string
      externalRefundId?: string
    }
  ): Promise<{
    status: "no_reference" | "unknown_charge" | "provider_mismatch" | "already_recorded" | "recorded"
    refundedAmount?: number
    paymentId?: string
  }> => {
    const externalId = args.externalId.trim()
    if (!externalId) return { status: "no_reference" }

    const [payment] = await byExternalId(ctx, externalId)
    if (!payment) return { status: "unknown_charge" }
    if (payment.provider !== args.provider) return { status: "provider_mismatch" }

    const current: number = payment.refundedAmount ?? 0
    // Clamped to what was actually captured: a dispute is raised for the
    // disputed amount, and a malformed figure must not invent a balance larger
    // than the charge.
    const reported = Math.min(
      Math.max(0, Math.trunc(args.refundedTotalMinor)),
      payment.amount
    )

    if (reported <= current) {
      return { status: "already_recorded", refundedAmount: current, paymentId: payment._id }
    }

    const now = Date.now()
    const status = reported >= payment.amount ? "refunded" : "partially_refunded"

    await ctx.db.patch(payment._id, {
      refundedAmount: reported,
      refundReason: args.reason ?? payment.refundReason,
      status,
      externalRefundId: args.externalRefundId ?? payment.externalRefundId,
      refundedAt: now,
      refundMethod: "api",
      refunds: [
        ...(payment.refunds ?? []),
        {
          // The part this event added, so the history sums to the balance.
          amount: reported - current,
          reason: args.reason,
          externalRefundId: args.externalRefundId,
          method: "api" as const,
          state: "confirmed" as const,
          at: now,
        },
      ],
      updatedAt: now,
    })

    if (payment.orderId) {
      await ctx.db.patch(payment.orderId, {
        paymentStatus: status,
        updatedAt: now,
      })
    }

    return { status: "recorded", refundedAmount: reported, paymentId: payment._id }
  },
}
