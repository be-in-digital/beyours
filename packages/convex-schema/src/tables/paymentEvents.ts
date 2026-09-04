import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Payment provider webhook deliveries, recorded so the same one is not
 * processed twice.
 *
 * WHY THIS EXISTS: Stripe retries a webhook until it gets a 2xx, and it is
 * explicit that a delivery can arrive more than once even after a success.
 * `stripeWebhook.handleWebhook` had no memory of what it had already seen, so
 * every retry re-ran the settlement path from the top.
 *
 * `provider` is part of the key rather than the table name: the same row shape
 * serves SumUp and PayPal callbacks, and two providers are free to mint the
 * same opaque event id. Keying on `eventId` alone would let one provider's
 * replay silence another's genuine event.
 *
 * This is NOT the same guard as the `by_externalId` lookup in
 * `payments.settlePayment`. This one stops ONE delivery being handled twice;
 * that one stops two DIFFERENT events — the return page and the webhook —
 * writing two payment rows for one charge. Neither subsumes the other.
 */
export const paymentEventsTable = defineTable({
  /** Provider key: "stripe" | "sumup" | "paypal". */
  provider: v.string(),
  /** The provider's own id for this delivery, e.g. Stripe's `evt_…`. */
  eventId: v.string(),
  /** The provider's event type, kept for diagnosis, e.g. "checkout.session.completed". */
  eventType: v.string(),
  /**
   * False between accepting the delivery and finishing it. A row that is
   * present but unprocessed means a previous attempt died mid-flight, so the
   * retry is allowed through rather than being swallowed as a duplicate.
   */
  processed: v.boolean(),
  createdAt: v.number(),
  /**
   * `createdAt` + 30 days. The table is a replay window, not an audit log:
   * without an expiry it grows forever on a busy store, and no provider retries
   * anything for anywhere near that long.
   */
  expiresAt: v.number(),
})
  // Compound, not `by_eventId`: the key is the pair, for the reason above.
  .index("by_provider_eventId", ["provider", "eventId"])
  // So the nightly sweep is a range scan over what has expired, not a walk of
  // every event the store has ever received.
  .index("by_expiresAt", ["expiresAt"])
