import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * The establishment's own book of the people who have ordered from it.
 *
 * WHY IT EXISTS (#364, #98). Three surfaces sell it, and the strongest is
 * inside the product: the onboarding tour said « Clients — Votre carnet
 * d'adresses intelligent ! Retrouvez chaque client, son historique de
 * commandes, ses coordonnées et ses préférences » and navigated to
 * `/dashboard/customers`, which was `<ComingSoon/>`. #363 removed the step
 * rather than let it lead somewhere empty.
 *
 * Nothing held the person. `orders.customerInfo` holds a name and possibly an
 * e-mail per ORDER, and `emailSubscribers.metadata` holds the aggregate — but
 * only for people who subscribed to marketing, which most diners are not. So
 * the data was collected four times and grouped nowhere.
 *
 * ## THE CONSENT LINE, WHICH THIS DELIBERATELY DOES NOT CROSS
 *
 * `orders.ts` states the rule it was already following: *"an order is a
 * purchase, not consent to be marketed to"*, and `source: "order"` exists on
 * `emailSubscribers` for a decision nobody has taken.
 *
 * This table is not that decision and must never become it. A customer row
 * records a fact the establishment already holds in `orders` — this person
 * bought from us, this often, this much — and is the trade record every
 * business keeps. Subscribing them to a mailing list is a separate act with a
 * separate lawful basis, and it still happens only through
 * `emailSubscribers`, only on an opt-in. Writing here creates no subscriber,
 * and `customers.list` is not a segment.
 *
 * ## THE IDENTITY, AND WHAT IT LEAVES OUT
 *
 * The key is the LOWER-CASED E-MAIL, per store. It is what `emailSubscribers`,
 * `gamePlays` and the promotion per-customer cap all key on already, so
 * choosing anything else would create a fifth identity rather than settle the
 * four.
 *
 * What that leaves out is stated rather than hidden: **an order with no e-mail
 * is not a person here.** A cash walk-in who gave nothing but a first name has
 * no contact, and inventing an identity for them would put a row in an address
 * book that cannot be addressed. `customers.list` reports how many orders that
 * covers, so the number on the screen is never quietly short.
 *
 * ## WHY A TABLE AND NOT A GROUP-BY
 *
 * Grouping orders on read is a whole-table scan, and Convex refuses a
 * transaction past 16,384 documents — the ceiling #432.4 was about. A
 * restaurant with two years of trade would open this screen once and never
 * again. The aggregate is maintained incrementally by the same hook that
 * already maintains `emailSubscribers.metadata`, on the same status
 * transitions, so there is one rule rather than two that drift.
 */
export const customersTable = defineTable({
  storeId: v.id("stores"),
  /** Lower-cased, always. The key, and the only identity this table has. */
  email: v.string(),
  /** The most recent name the person gave; a diner may correct it. */
  name: v.string(),
  phone: v.optional(v.string()),

  /**
   * Counted on entering `confirmed` and given back on `confirmed → cancelled`,
   * exactly as `emailSubscribers.metadata` is. The state machine allows each
   * once, so no retry double-counts.
   */
  totalOrders: v.number(),
  /** Minor units. Integer cents, like every other money field here. */
  totalSpent: v.number(),
  averageOrderValue: v.number(),

  firstOrderAt: v.number(),
  lastOrderAt: v.number(),

  /** `delivery` / `pickup` / `dine_in`, deduplicated. */
  orderTypes: v.array(v.string()),
  /** Product ids, most recent first, capped — see `FAVOURITE_PRODUCT_CAP`. */
  favoriteProducts: v.array(v.string()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  // The lookup every write does: one point read before a patch.
  .index("by_storeId_email", ["storeId", "email"])
  // The screen's default order. On an index rather than sorted in memory,
  // because this is the one table here that grows with every new diner and a
  // sort would have to read all of them to show twenty.
  .index("by_storeId_lastOrderAt", ["storeId", "lastOrderAt"])
  // « Meilleurs clients », which is the second question an owner asks.
  .index("by_storeId_totalSpent", ["storeId", "totalSpent"])
