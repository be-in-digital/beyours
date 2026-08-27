import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Delivery quotes
 *
 * Server-side record of an Uber Direct estimate, so the delivery fee charged at
 * checkout comes from something the server issued rather than from the browser.
 *
 * WHY THIS EXISTS: in `percentage` fee mode, `orders.create` took the Uber
 * Direct fee as a client argument (`uberDirectFee`) and billed a percentage of
 * whatever number arrived. Sending `uberDirectFee: 0` bought free delivery —
 * the same class of hole as the client-supplied discount. The order now carries
 * only the estimate id, and the fee is read from this table.
 */
export const deliveryQuotesTable = defineTable({
  /** Uber Direct's estimate id — the handle the storefront sends back. */
  estimateId: v.string(),
  storeId: v.id("stores"),
  /** Quoted delivery fee in cents, exactly as Uber Direct returned it. */
  fee: v.number(),
  currency: v.string(),
  /** Dropoff the quote was issued for, to detect a changed address. */
  dropoffLatitude: v.number(),
  dropoffLongitude: v.number(),
  /** Uber's own expiry for the quote, in ms. */
  expiresAt: v.number(),
  createdAt: v.number(),
})
  .index("by_estimateId", ["estimateId"])
  .index("by_storeId", ["storeId"])
