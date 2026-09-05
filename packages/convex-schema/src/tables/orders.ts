import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Orders table
 * Complete order lifecycle with multi-source support
 */
export const ordersTable = defineTable({
  storeId: v.id("stores"),
  // Sequential per establishment per year — `ORD-2026-00412`, allocated by
  // `numbering.allocateOrderNumber`. It used to be `ORD-${year}-${Math.random()}`
  // while this comment promised the sequence, which is how the gap between the
  // documented format and the produced one survived.
  orderNumber: v.string(),
  customerId: v.optional(v.string()), // Reference to Better Auth component user
  customerInfo: v.object({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }),
  type: v.union(
    v.literal("delivery"),
    v.literal("pickup"),
    v.literal("dine_in")
  ),
  /**
   * Which table the order goes to. Set for `dine_in` orders placed from the
   * storefront; absent otherwise, and absent on the platform `dine_in` orders
   * Uber Eats and Deliveroo forward, which carry no table of their own.
   *
   * A label rather than a number — dining rooms use `A3` and `Terrasse 4` as
   * readily as `12`. Same representation as `gameQRCodes.tableNumber`; see
   * `@be-in-digital/core/dining` for why they are not the same field.
   */
  tableNumber: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("confirmed"),
    v.literal("preparing"),
    v.literal("ready"),
    v.literal("out_for_delivery"),
    v.literal("delivered"),
    v.literal("completed"),
    v.literal("cancelled")
  ),
  items: v.array(v.object({
    productId: v.optional(v.id("products")), // Optional for external platform orders
    productName: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    selectedOptions: v.array(v.object({
      optionId: v.optional(v.string()),
      optionName: v.string(),
      choiceId: v.optional(v.string()),
      choiceName: v.optional(v.string()),
      priceModifier: v.number(),
    })),
    subtotal: v.number(),
    /**
     * The VAT rate this line was priced at, as a percentage.
     *
     * Read live from `products.taxRate` when the order is priced and never
     * recorded, so a product retaxed afterwards restated the VAT on every past
     * order — and would restate an invoice already issued. Optional: absent on
     * every order written before this existed, and on platform orders, which
     * carry no tax of ours at all.
     */
    taxRatePercent: v.optional(v.number()),
    notes: v.optional(v.string()),
    externalId: v.optional(v.string()), // External platform item ID
  })),
  subtotal: v.number(),
  taxAmount: v.number(),
  /**
   * What each VAT rate contributed, as the order was priced.
   *
   * `computeOrderTotals` has always produced this — a basket mixing food at
   * 10 % and alcohol at 20 % cannot be described by one rate — and the create
   * path threw it away, keeping only the single `taxAmount` above. That was
   * enough for the total and not enough for anything that has to *declare* the
   * tax: a receipt, and an invoice, both of which must show the taxable amount
   * and the tax per rate.
   *
   * Stored rather than recomputed on demand, because recomputing means reading
   * each line's product for its rate today, and a receipt has to say what was
   * charged then. A product repriced, retaxed or deleted after the order must
   * not change what the diner was billed.
   *
   * Optional: every order written before this field existed has none, and the
   * marketplace paths (`createFromWebhook`, `saveFromPlatform`) write no tax at
   * all because Uber Eats and Deliveroo account for it themselves. Both read as
   * "no breakdown recorded", which is the truth, so no backfill is required for
   * `schemaValidation: true`.
   */
  taxBreakdown: v.optional(v.array(v.object({
    /** e.g. 10 for 10 %. */
    ratePercent: v.number(),
    /** Tax-inclusive amount taxed at this rate, in cents. */
    grossAmount: v.number(),
    /** Tax contained in `grossAmount`, in cents. */
    taxAmount: v.number(),
  }))),
  deliveryFee: v.optional(v.number()),
  // Uber Direct delivery tracking
  uberDirectEstimateId: v.optional(v.string()),
  uberDirectFee: v.optional(v.number()), // actual Uber Direct cost in cents
  // Set once the delivery is booked; the webhook finds the order by this id.
  uberDirectDeliveryId: v.optional(v.string()),
  uberDirectStatus: v.optional(v.union(
    v.literal("SCHEDULED"),
    v.literal("EN_ROUTE_TO_PICKUP"),
    v.literal("ARRIVED_AT_PICKUP"),
    v.literal("EN_ROUTE_TO_DROPOFF"),
    v.literal("ARRIVED_AT_DROPOFF"),
    v.literal("COMPLETED"),
    v.literal("FAILED")
  )),
  uberDirectTrackingUrl: v.optional(v.string()),
  uberDirectStatusAt: v.optional(v.number()),
  /** Set when Uber reports FAILED. The order machine forbids
   *  out_for_delivery -> cancelled, so this needs a human, not a transition. */
  uberDirectFailedAt: v.optional(v.number()),
  deliveryFeeMode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
  promotionId: v.optional(v.id("promotions")),
  discountAmount: v.optional(v.number()),
  total: v.number(),
  deliveryAddress: v.optional(v.object({
    street: v.string(),
    city: v.string(),
    postalCode: v.string(),
    country: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    instructions: v.optional(v.string()),
  })),
  paymentMethod: v.optional(v.string()),
  paymentStatus: v.union(
    v.literal("pending"),
    v.literal("paid"),
    v.literal("failed"),
    // Money is owed back but has NOT moved yet. Cancelling a paid order used to
    // write "refunded" here and on every linked payment without calling a
    // single provider, so the books claimed a refund the customer never got —
    // and because `planRefund` refuses anything that is not "succeeded" or
    // "partially_refunded", that lie permanently blocked the real refund. This
    // status says "an operator still has to press the button".
    v.literal("refund_pending"),
    v.literal("refunded"),
    v.literal("partially_refunded")
  ),
  source: v.union(
    v.literal("website"),
    v.literal("uber_eats"),
    v.literal("deliveroo"),
    v.literal("pos")
  ),
  externalOrderId: v.optional(v.string()), // External platform order ID (Uber Eats, Deliveroo, etc.)
  externalDisplayId: v.optional(v.string()), // Human-readable display ID from platform
  externalPlatformData: v.optional(v.any()), // Raw webhook payload for debugging
  deliveryType: v.optional(v.union(
    v.literal("delivery"),
    v.literal("collection"),
    v.literal("dine_in")
  )),
  isRemake: v.optional(v.boolean()), // Flag for remake orders from delivery platforms
  platformSyncStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("synced"),
    v.literal("failed")
  )),
  notes: v.optional(v.string()),
  estimatedPrepTime: v.optional(v.number()), // in minutes
  estimatedDeliveryTime: v.optional(v.number()),
  scheduledFor: v.optional(v.number()), // timestamp for scheduled orders
  completedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  viewToken: v.optional(v.string()), // Token for public order confirmation access
  /**
   * One checkout attempt, as the browser identifies it.
   *
   * The checkout re-enables its button in `finally` while the redirect to the
   * payment provider is still in flight, and the cart survives a Back
   * navigation — so a second click produced a second order, a second kitchen
   * ticket and a second promotion usage. Replaying the same key returns the
   * order that already exists.
   */
  idempotencyKey: v.optional(v.string()),
  /**
   * The Stripe Checkout Session this order was sent to pay through.
   *
   * WHY IT IS STORED: the session id was returned to the browser and kept
   * nowhere else, so a customer who paid and then closed the tab before landing
   * on the confirmation page left a paid Stripe charge and an order stuck at
   * `paymentStatus: "pending"` — no webhook, no return page, and nothing on our
   * side that could even name the session to ask Stripe about it. The kitchen
   * never saw the order. With the id here, reconciliation is a point lookup
   * against Stripe instead of a blind walk of every session in the window.
   *
   * Optional on purpose: cash, SumUp, PayPal and every platform order have no
   * Stripe session, and every row written before this field existed has none
   * either. Both read as "nothing to reconcile", which is the truth, so no
   * backfill is required for `schemaValidation: true`.
   */
  stripeCheckoutSessionId: v.optional(v.string()),
  /**
   * When the diner's confirmation email was handed to the sender.
   *
   * WHY IT IS STORED: `recordPaymentStatus` patches `paymentStatus` with no
   * "was it already paid" guard, on purpose — a replayed Stripe webhook and the
   * success page racing it both settle the same order, and the kitchen release
   * downstream is idempotent through the ticket it looks for. An email has no
   * such artefact to look for. Without this field the diner gets one
   * confirmation per settlement attempt.
   *
   * It records the DISPATCH, not the delivery: the mutation claims the send
   * transactionally and the action that talks to SES runs afterwards and may
   * still fail. That is the honest guarantee — at most one attempt per order —
   * and it is the one worth having, because the failure the diner notices is
   * three identical receipts, not a missing retry.
   *
   * Optional: unset means "no confirmation has been dispatched", which is true
   * of every order written before this existed, so no backfill is needed.
   */
  confirmationEmailAt: v.optional(v.number()),
  /**
   * The invoice issued for this order, once the sale became definitive.
   *
   * Read before issuing, so a replayed webhook settling the same order twice
   * finds it set and issues nothing — the read is what puts the field in the
   * transaction's read set, so the losing attempt is retried and sees it.
   * Absent means no invoice: an unpaid order, a cancelled one, or a marketplace
   * order that Uber Eats or Deliveroo invoiced themselves.
   */
  invoiceId: v.optional(v.id("invoices")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_storeId_createdAt", ["storeId", "createdAt"])
  /**
   * One status tab of `/dashboard/orders`, in the order the screen prints.
   *
   * `by_storeId_status` carries no timestamp, so `.order("desc")` on it falls
   * back to `_creationTime` — which is when the row was written, not when the
   * order was placed. A platform webhook arriving late writes a row whose
   * `createdAt` is half an hour old, so the "Toutes" tab (ordered by
   * `createdAt`) and a status tab disagreed about which order is newest, and
   * the Date column the table prints was not monotonic. `kitchenTickets` has
   * carried the same three-field shape since #137, for the same reason.
   */
  .index("by_storeId_status_createdAt", ["storeId", "status", "createdAt"])
  .index("by_customerId", ["customerId"])
  .index("by_orderNumber", ["orderNumber"])
  .index("by_source", ["source"])
  .index("by_external_order", ["externalOrderId"])
  .index("by_uberDirectDeliveryId", ["uberDirectDeliveryId"])
  .index("by_storeId_idempotencyKey", ["storeId", "idempotencyKey"])
  // Reconciliation reads exactly one slice: orders still unpaid, created inside
  // the window where asking the provider is still meaningful. Without this the
  // sweep would be a full walk of every order the store has ever taken, run on
  // a schedule.
  .index("by_paymentStatus_createdAt", ["paymentStatus", "createdAt"])
