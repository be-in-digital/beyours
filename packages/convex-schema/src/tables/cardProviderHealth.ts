import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Whether the card provider ACCEPTED our credentials, the last time anything
 * asked it. One row per provider.
 *
 * WHY IT EXISTS. `cardPaymentAvailability` armed the checkout's card tile on
 * `STRIPE_SECRET_KEY.startsWith("sk_")`, which is a check on the SHAPE of a
 * string. A well-formed key that is wrong — revoked, rolled, copied from
 * another account — passed it, so the tile was pre-selected and every diner
 * who chose it reached the redacted "Server Error" that #374 was written to
 * remove (#411). Only the provider can say whether a key works, and a Convex
 * query cannot ask it, so the answer is recorded when something that CAN ask
 * learns it: the hourly `stripe.verifyStripeKey`, and every checkout attempt.
 *
 * WHY ITS OWN TABLE, AND NOT A FIELD ON `globalSettings`. That was the first
 * shape and it was wrong twice over.
 *
 *  - `globalSettings.get` is public, and the storefront reads it before any
 *    sign-in. A provider's refusal message names the key's mode and last four
 *    characters, and sometimes the Stripe account id; putting it on that
 *    document served all of it to anonymous visitors.
 *  - A `globalSettings` row is written by exactly one thing: the owner
 *    pressing Enregistrer in Réglages. No seed, no migration and no bootstrap
 *    creates one, so a deployment whose owner has never opened that screen has
 *    no document to hang a verdict on — and the recorder, which may not invent
 *    an establishment's payment configuration out of a health check, wrote
 *    nothing at all. The fix was inert on exactly the fresh deployments #374
 *    is about.
 *
 * Its own table has neither problem: it is always insertable, and nothing
 * public reads it. `cardPaymentAvailability` returns two booleans and no
 * detail, so a refusal message reaches an operator and never a diner.
 */
export const cardProviderHealthTable = defineTable({
  /**
   * Which provider this verdict is about.
   *
   * A verdict is only consulted for the provider an establishment is actually
   * using, so a leftover Stripe row cannot disarm a tile that has since moved
   * to SumUp. Only the Stripe path writes today; `sumup` is here because the
   * question is the provider's, not Stripe's, and the reader already asks it
   * that way.
   */
  provider: v.union(v.literal("stripe"), v.literal("sumup")),

  /** Did the provider accept our credentials? */
  usable: v.boolean(),

  /**
   * When this verdict was recorded — which is when it last CHANGED.
   *
   * The recorder skips a write that would say what the row already says.
   * `globalSettings` and this table are read on the order path, and a document
   * rewritten on every successful checkout is a write every concurrent order
   * mutation reading it has to lose an OCC round to.
   */
  checkedAt: v.number(),

  /**
   * The provider's own words about the refusal, for whoever has to fix it.
   *
   * Bounded, and never anything this code adds to it. It is safe HERE and was
   * not safe on `globalSettings`: the difference is that nothing public reads
   * this table.
   */
  detail: v.optional(v.string()),
})
  .index("by_provider", ["provider"])
