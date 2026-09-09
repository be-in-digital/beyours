/**
 * Payment management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { clampPagination } from "./pagination"
import { planRefund } from "./refundPolicy"
import {
  DoubleCollectionError,
  paymentStatusAfterSettlement,
} from "./paymentSettlement"
import { recordPaymentStatus } from "./orders"
import { collectionOnOrder, LEDGERED_STATUSES } from "./paymentLedger"
import type { OrderConfirmationDispatch } from "./orderConfirmation"

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
    // Clamped: `paginationOptsValidator` lets the caller name any page size,
    // and a page of a million rows is the transaction this query was rewritten
    // to stop being.
    const page = clampPagination(args.paginationOpts)
    const newestFirst = (query: any) => query.order("desc").paginate(page)

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
 *  - A new row is inserted directly as "succeeded". The old `create` then
 *    `updateStatus` pair was a second read-then-write window, and the reason a
 *    row could sit at "pending" forever when the second call never landed. A
 *    row that is ALREADY there and still pending is promoted in place — see
 *    the comment on the match below for what leaving it pending cost.
 *
 * A fourth guard was added later, and it is a different question from all
 * three: `by_externalId` recognises a charge it has already seen, and cannot
 * recognise an order somebody ELSE has already collected. Cash carries no
 * reference and two providers mint unrelated ones, so those rows never collide
 * — which is how one meal was collected twice, in cash at the counter and
 * again by a Stripe session left live behind an abandoned checkout (#378). The
 * order-level check below is what makes "one order, one collection" a property
 * of the ledger rather than of five call sites remembering to ask a guard.
 *
 * That fourth guard was first written as `p.provider !== args.provider`, and
 * that clause was a hole the width of the whole product. Two live Stripe
 * sessions on one order — a stale tab, a back-navigation, a retry — are two
 * DIFFERENT charges from the SAME provider, so the clause read them as the
 * same collection and let the second row in. Both referenced the order, the
 * currency and the total, so `assertSettlesOrder` passed both; both were
 * `card`, so #378's method check did not separate them. A 1 200 € order
 * collected 2 400 €, in two `succeeded` rows, each independently refundable
 * (#411). The clause is gone: by the time execution reaches it, the same charge
 * has already returned above, so anything still on the order is another one.
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
      throw new DoubleCollectionError(
        "charge_settles_another_order",
        `Ce paiement ${args.provider} règle déjà la commande ${cross.orderId}.`,
        { provider: args.provider, settledOrderId: String(cross.orderId) }
      )
    }

    // A row for this charge on this order already stands. Whether it is DONE
    // is a different question from whether it EXISTS, and only the second was
    // being asked: any match at all returned `created: false` and was left
    // exactly as it was found.
    //
    // A `pending` row is not a settlement. It is the placeholder
    // `payments.create` writes before anything has been heard from the
    // provider, and leaving it pending while the ORDER goes to `paid` — which
    // is what `settleByExternalReference` does immediately after this returns
    // — produced a charge that was:
    //
    //   - permanently unrefundable through the product, because `planRefund`
    //     accepts only `succeeded` and `partially_refunded`, and nothing else
    //     ever revisits the row;
    //   - still open to a second collection, because `collectionOnOrder` counts
    //     the same two statuses, so the order read as holding no money at all.
    //
    // So a settled charge is only recognised as already-recorded when the row
    // says the money is actually on the ledger. Anything else falls through to
    // the guard below and is promoted.
    const match = existing.find((p: any) => p.orderId === args.orderId)
    if (match && LEDGERED_STATUSES.has(match.status)) {
      return { paymentId: match._id, created: false }
    }

    // Below this line a NEW collection is about to be written, and an order is
    // collected once.
    //
    // WHY THIS IS NOT THE CHECK ABOVE: `byExternalId` answers "have I seen this
    // charge before". It cannot answer "has this order already been collected
    // by some other charge" — a cash row carries no `externalId` at all, two
    // providers mint unrelated references, and one provider mints a fresh one
    // per checkout session. None of those ever collide. That gap is #378 and
    // #411 both:
    //
    //   #378 — a diner abandons Stripe, confirms « Espèces » on the same
    //   attempt (#374 re-methods the reused order), staff take the notes, and
    //   the Stripe session stays live for ~24 h. Completing it wrote a second
    //   `succeeded` row on top of the cash one.
    //
    //   #411 — a diner opens checkout twice and leaves two live Stripe
    //   sessions on one order. Completing both wrote two `succeeded` rows, and
    //   nothing above could tell them apart: same order, same currency, same
    //   total, same method, same provider, two payment intents.
    //
    // Either way the order still read « Payé », both rows were independently
    // refundable, and one meal had been charged twice with nothing anywhere
    // saying so.
    //
    // THE PREDICATE IS ABOUT THE CHARGE, NOT THE PROVIDER. It used to carry
    // `p.provider !== args.provider`, which made #411 invisible — the two
    // Stripe sessions are both `stripe`. It cannot be reinstated: execution
    // only reaches this line when `byExternalId` found no row for THIS charge
    // on THIS order, so every row still standing here belongs to another
    // charge, whoever minted it.
    //
    // `refunded` is deliberately not counted: that money went back, so a fresh
    // collection is a real one. `partially_refunded` is, because part of it is
    // still held.
    const collected = await collectionOnOrder(ctx, args.orderId)
    if (collected) {
      throw new DoubleCollectionError(
        "order_already_collected",
        `Cette commande a déjà été encaissée (${collected.provider}) : ` +
          `un règlement ${args.provider} en ferait un double encaissement.`,
        {
          provider: args.provider,
          collectedBy: String(collected.provider),
          collectedExternalId: String(collected.externalId ?? ""),
          externalId,
        }
      )
    }

    const now = Date.now()

    // Promote the placeholder rather than inserting beside it. Two rows for one
    // charge is the duplicate `by_externalId` exists to prevent, and the guard
    // above has just established that this order holds no other collection.
    //
    // `provider`, `amount` and `currency` are overwritten, not preserved. A
    // `pending` row is by definition "nothing has been heard from the
    // provider" — a placeholder, not a record — and the settlement is the
    // first authoritative account of the charge. It matters most for
    // `provider`: a refund is issued against whatever that field says, so a
    // row left naming the wrong one sends the refund to a provider that is not
    // holding the money.
    if (match) {
      await ctx.db.patch(match._id, {
        provider: args.provider,
        amount: args.amount,
        currency: args.currency,
        status: "succeeded",
        updatedAt: now,
        ...(args.metadata
          ? { metadata: { ...(match.metadata ?? {}), ...args.metadata } }
          : {}),
      })
      // `created` means "this call is what put the money on the ledger", which
      // it is. It has never meant "a document was inserted" — the callers use
      // it to decide whether a settlement is news.
      return { paymentId: match._id, created: true }
    }

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

    // Promoting a row to `succeeded` IS a collection, and this is the second
    // writer that reached the payments table without asking whether the order
    // already held one. `create` inserts at `pending` under `payments:write`
    // and this promotes it, so the pair could put a second `succeeded` row on
    // an order the provider paths would have refused — the whole of #411,
    // through a surface nothing calls. The check is the same one, in the same
    // place, as the four provider paths make.
    if (status === "succeeded") {
      const row = await ctx.db.get(id)
      if (!row) throw new Error("Payment not found")

      const collected = await collectionOnOrder(ctx, row.orderId)
      if (collected && collected._id !== id) {
        throw new DoubleCollectionError(
          "order_already_collected",
          `Cette commande a déjà été encaissée (${collected.provider}) : ` +
            `un second règlement en ferait un double encaissement.`,
          { collectedBy: String(collected.provider) }
        )
      }
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
    confirmation?: OrderConfirmationDispatch | null
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
    let confirmation: OrderConfirmationDispatch | null = null
    if (next) {
      // Through `recordPaymentStatus`, not a bare patch.
      //
      // This path patched `paymentStatus` itself and skipped everything that
      // hangs off an order becoming paid — the kitchen release AND the diner's
      // confirmation. `payment_intent.succeeded` is a real Stripe event and
      // reaches here, so an order could go to `paid` with nothing on the pass
      // and nothing in the customer's inbox; and because
      // `paymentStatusAfterSettlement` then answers `null` for an order already
      // paid, no later webhook, success page or reconciliation sweep would ever
      // put it right. The bare patch was the whole of that defect.
      confirmation = await recordPaymentStatus.handler(ctx, {
        id: payment.orderId,
        paymentStatus: next,
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
      // Handed back for the app to schedule, the same way `orders.ts` does it:
      // this layer has no `internal.*` to schedule with.
      confirmation,
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
/** How much of a refusal message we keep. Enough to act on, bounded. */
export const MAX_REFUSAL_DETAIL_CHARS = 2_000

/**
 * Record a collection this deployment refused, so somebody gives the money back.
 *
 * WHY THIS EXISTS: `settlePayment` refusing a second collection is right, and
 * on its own it is not enough. The provider does not tell us about a charge it
 * did not take — by the time the refusal fires, the diner's account has been
 * debited a second time. Refusing the row keeps the LEDGER honest; it does not
 * make the diner whole, and nothing else in the deployment was left holding
 * that fact. The Stripe webhook answered 500, Stripe retried for three days,
 * and the only trace was a `console.error` in one client's Convex dashboard —
 * which is to say, nobody was told (#411).
 *
 * `systemAuditLog` rather than a table of its own: this is exactly what that
 * log is for, an operator opens it from Dashboard → Système, and the entry is
 * durable — `paymentEvents` would have been the tempting home and it is swept
 * after thirty days, which is shorter than the time a mis-charged diner takes
 * to notice.
 *
 * `result: "failure"` is about the collection, not about this function. The
 * money moved and it should not have.
 *
 * Never throws, and that is load-bearing: its only caller is the failure branch
 * of a webhook, and a recording that can itself fail the handler turns one
 * refused collection into a retry storm — the same rule
 * `platformWebhookFailures.record` follows, for the same reason.
 */
export const recordRefusedCollection = {
  args: {
    provider: v.string(),
    /** The refusal code, from `paymentSettlement`'s two reason unions. */
    code: v.string(),
    /** The French sentence the refusal carried. */
    message: v.string(),
    /** The provider's own reference for the charge that was refused. */
    externalId: v.optional(v.string()),
    /** The provider delivery this arrived on, when there was one. */
    eventType: v.optional(v.string()),
    /**
     * The order and the establishment, as STRINGS.
     *
     * NOT `v.id("orders")` / `v.id("stores")`, and that is the whole point.
     * Convex validates arguments BEFORE the handler runs, so the `try/catch`
     * below — whose entire contract is "this can never fail its caller" —
     * cannot catch a validator error. The only caller is the failure branch of
     * a webhook, and its `storeId` comes from provider metadata: a session
     * created outside `createCheckoutSession`, or an id from a re-created
     * deployment, throws out of the catch block, past the 200, and back into
     * the three-day retry loop this exists to end — with nothing recorded.
     *
     * They are identifiers in a log line, never dereferenced, so a string is
     * all this needs. `targetStoreId` is only set when the value resolves.
     */
    orderId: v.optional(v.string()),
    storeId: v.optional(v.string()),
  },
  handler: async (
    ctx: any,
    args: {
      provider: string
      code: string
      message: string
      externalId?: string
      eventType?: string
      orderId?: string
      storeId?: string
    }
  ): Promise<void> => {
    try {
      // `targetStoreId` is a real reference and the column is typed as one, so
      // it is set only when the string actually resolves to a store. A value
      // that does not is still kept, in `details`, where it is a clue rather
      // than a dangling pointer.
      const store = args.storeId
        ? await ctx.db.get(args.storeId as any).catch(() => null)
        : null

      await ctx.db.insert("systemAuditLog", {
        action: "payment_collection_refused" as const,
        // No identity to name: a webhook runs with none, and the provider is
        // the honest answer to "who did this".
        performedBy: args.provider,
        performedAt: Date.now(),
        ...(store ? { targetStoreId: args.storeId } : {}),
        details: JSON.stringify({
          code: args.code,
          provider: args.provider,
          ...(args.eventType ? { eventType: args.eventType } : {}),
          ...(args.orderId ? { orderId: args.orderId } : {}),
          ...(args.storeId ? { storeId: args.storeId } : {}),
          ...(args.externalId ? { externalId: args.externalId } : {}),
        }).slice(0, MAX_REFUSAL_DETAIL_CHARS),
        result: "failure" as const,
        errorMessage: args.message.slice(0, MAX_REFUSAL_DETAIL_CHARS),
      })
    } catch (failure) {
      // The refusal itself has already been logged by the caller. This one is
      // about the recording, and it must not replace it.
      console.error("[payments] could not record a refused collection:", failure)
    }
  },
}

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
