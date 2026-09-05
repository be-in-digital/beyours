import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Customer delivery addresses
 *
 * These used to live in the browser's localStorage, which meant a customer who
 * ordered on their phone found nothing on their laptop, and lost everything by
 * clearing the browser. Favourites were already server-side; addresses had
 * simply never followed.
 *
 * Guests still keep their address locally — they have no account to attach it
 * to. The moment they sign in, what they had is imported here once.
 */
export const customerAddressesTable = defineTable({
  /** Better Auth subject, as on `favorites`. */
  userId: v.string(),
  label: v.optional(v.string()),
  street: v.string(),
  city: v.string(),
  postalCode: v.string(),
  country: v.string(),
  /** From the address autocomplete. Uber Direct cannot quote without them, so
   *  an address saved without coordinates asks to be re-entered at checkout
   *  rather than being geocoded blind. */
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  instructions: v.optional(v.string()),
  isDefault: v.boolean(),
  /** The `id` this address had in localStorage, kept so a repeated import
   *  updates the same row instead of duplicating it. */
  importedFromLocalId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_localId", ["userId", "importedFromLocalId"])
  // Retention. The table has no `storeId`, so a store cascade never reaches it
  // and only time can. Both existing indexes start with `userId`, which cannot
  // answer "everything older than three years".
  .index("by_updatedAt", ["updatedAt"])
