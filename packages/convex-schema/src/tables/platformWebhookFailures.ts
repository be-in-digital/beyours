import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Delivery-platform webhooks that could not be acted on.
 *
 * The handler used to guess. When the follow-up fetch to Uber failed — a 429, a
 * timeout, or sandbox credentials meeting a production order — the order was
 * assigned to `allIntegrations[0]`: on a multi-location account, one owner's
 * order appeared in another owner's kitchen, priced at zero, described as
 * "Commande Uber Eats". A guess is worse than a refusal here, because a refusal
 * can be seen and a guess cannot.
 *
 * So the event is kept instead. The raw body is retained verbatim so it can be
 * replayed once the cause is fixed, which is the whole point of keeping it: an
 * order that merely vanished into a log line is an order nobody can recover.
 */
export const platformWebhookFailuresTable = defineTable({
  platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  /** The platform's event name, as received. */
  eventType: v.optional(v.string()),
  /** The platform's order/resource id, when the payload carried one. */
  externalOrderId: v.optional(v.string()),
  /** The store reference the event named, when it named one. */
  platformStoreId: v.optional(v.string()),
  reason: v.union(
    /** No enabled integration exists for this platform. */
    v.literal("no_integrations"),
    /** The event carried no usable store reference. */
    v.literal("unidentified_store"),
    /** The event named a store we have no enabled integration for. */
    v.literal("unknown_store"),
    v.literal("ambiguous_store"),
    /** The order could not be fetched from the platform. */
    v.literal("fetch_failed"),
    /** The platform refused our accept/reject. */
    v.literal("accept_failed"),
    /** Anything else that stopped the event being applied. */
    v.literal("processing_failed")
  ),
  /** Operator-facing detail: the error message, the status code, the mismatch. */
  detail: v.optional(v.string()),
  /**
   * The raw request body, verbatim, so the event can be replayed.
   *
   * Never re-serialize it: for the platforms that sign the body, a
   * re-serialized copy no longer verifies.
   */
  rawBody: v.optional(v.string()),
  /** Set once somebody has dealt with it. */
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(v.string()),
  receivedAt: v.number(),
})
  .index("by_receivedAt", ["receivedAt"])
  .index("by_platform_receivedAt", ["platform", "receivedAt"])
  // The operator question is "what still needs me?", so unresolved-first is the
  // access path that has to stay cheap as the table grows.
  .index("by_resolvedAt_receivedAt", ["resolvedAt", "receivedAt"])
  .index("by_externalOrderId", ["externalOrderId"])
