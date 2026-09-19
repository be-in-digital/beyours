/**
 * Recurring time windows — re-exported from `@be-yours/convex-schema`.
 *
 * WHY IT MOVED: the storefront asks the same question this module answers, and
 * gave a different answer. `packages/restaurant`'s `isProductScheduledNow` read
 * `now.getDay()` / `now.getHours()` on the *visitor's* clock and compared
 * `"HH:MM"` strings with no wrap, so a 22:00–02:00 late menu read as an empty
 * set — greyed out for every hour it was actually served — while this module
 * said the dish was on. A diner in another timezone got the opposite pair: the
 * dish on the menu, and refused at payment.
 *
 * `packages/restaurant` cannot import `packages/convex-functions`; both depend
 * on `convex-schema`. So the implementation lives there now, beside
 * `storeStatus` and `openingHours`, which are in that package for exactly the
 * same reason. This file stays because `./timeWindow` is a published subpath.
 */

export {
  type RecurringWindow,
  restaurantClock,
  parseClockTime,
  isWithinWindow,
} from "@be-yours/convex-schema"
