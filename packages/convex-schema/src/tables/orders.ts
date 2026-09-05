import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Orders table
 * Complete order lifecycle with multi-source support
 */
export const ordersTable = defineTable({
  storeId: v.id("stores"),
  orderNumber: v.string(), // ex: "ORD-2026-0001"
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
    notes: v.optional(v.string()),
    externalId: v.optional(v.string()), // External platform item ID
  })),
  subtotal: v.number(),
  taxAmount: v.number(),
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
  scheduledAt: v.optional(v.number()), // Alternative field for platform scheduled orders
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
   * When this order stopped naming a person.
   *
   * WHY IT IS NEEDED: an anonymised order and an order placed by a walk-in who
   * gave no details are otherwise the same row — the engine already writes the
   * second, with `customerInfo: { name: "Anonyme" }` and nothing else. Without
   * the marker the retention sweep cannot tell "already done" from "never
   * touched", so it would re-process the same rows every night for ever, and
   * the report would count them again each time.
   *
   * Set by `privacy.ts`. Optional, so no row written before it existed needs a
   * backfill.
   */
  anonymisedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_storeId_createdAt", ["storeId", "createdAt"])
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
