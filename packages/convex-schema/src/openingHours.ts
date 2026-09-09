/**
 * When an establishment is open
 *
 * The weekly schedule an owner writes in the dashboard, and the one question
 * everything asks of it: is the restaurant serving right now?
 *
 * WHY IT LIVES HERE: it was answered in the browser and nowhere else.
 * `isOrderableStore` next door checks `status === "open"` and says so in its own
 * comment — "hours are a separate question, answered by `isStoreOpen` in the
 * storefront". Nothing flips `status` on a schedule; there is no such cron. So
 * the only gate on the weekly hours was a `toast.error` on the checkout page,
 * and a tab left open past closing, a cart restored from localStorage or a
 * direct call to the mutation each produced an order and a kitchen ticket at
 * 4 a.m. in an empty building. The same hole was closed one level up for the
 * manual `closed` status and left open for the weekly schedule — which is the
 * one restaurants actually rely on.
 *
 * It is in `convex-schema` because that is the only package both ends can
 * import: `orders.create` lives in `convex-functions`, the storefront's
 * `useStoreStatus` in `restaurant`, and the two cannot depend on one another.
 * Same reasoning as `storeStatus` and `storeServices`, which are here already.
 */

import { restaurantClock, parseClockTime } from "./timeWindow"
import type { BusinessHours } from "./types"

/**
 * What an unwritten `useGlobalHours` means — declared once, for both ends.
 *
 * THE DISAGREEMENT THIS SETTLES. `useGlobalHours` is `v.optional(v.boolean())`,
 * so a store written before the field existed carries no value at all. The
 * dashboard read that as `?? true` and drew the switch ON — "this location
 * follows the deployment-wide week". `resolveStoreHours` read it as a falsy
 * `&&` and served the store's OWN week. So an owner could edit the global
 * hours, watch the screen agree that this location follows them, and have the
 * order path enforce something else entirely. Neither side was wrong on its
 * own; there were simply two answers, and no one place to change.
 *
 * FALSE IS THE ANSWER, and it is chosen for what it does not do. This is a
 * live product where the wrong week means orders refused during service, or a
 * kitchen ticket at four in the morning. `false` is what the order path has
 * always enforced, so adopting it changes no establishment's actual opening
 * hours — it only stops the dashboard claiming otherwise. `true` would have
 * silently moved every legacy store onto the global week.
 *
 * It costs nothing going forward: `stores.create` writes `useGlobalHours: true`
 * explicitly, so a store made through the product never reaches this default,
 * and the first save from the hours screen writes the flag either way. The
 * default is only ever consulted for rows that predate the field.
 */
export const FOLLOWS_GLOBAL_HOURS_BY_DEFAULT = false

/**
 * Does this establishment follow the deployment-wide week?
 *
 * The single reading of the flag. The screen and the order path both call it,
 * so they cannot answer the question differently again — which is what went
 * wrong, rather than either answer being indefensible.
 */
export function followsGlobalHours(
  store: { useGlobalHours?: boolean | null } | null | undefined
): boolean {
  return store?.useGlobalHours ?? FOLLOWS_GLOBAL_HOURS_BY_DEFAULT
}

/**
 * Which hours actually govern an establishment.
 *
 * `useGlobalHours` is a per-store flag the dashboard writes: on, the location
 * follows the deployment-wide week; off, it keeps its own. Resolved on read
 * rather than copied on write, so editing the global hours reaches every
 * location that follows them without a migration.
 */
export function resolveStoreHours(
  store:
    | { hours?: BusinessHours[] | null; useGlobalHours?: boolean | null }
    | null
    | undefined,
  globalSettings?: { hours?: BusinessHours[] | null } | null
): BusinessHours[] {
  if (!store) return []
  const globalHours = globalSettings?.hours
  if (followsGlobalHours(store) && globalHours && globalHours.length > 0) {
    return globalHours
  }
  return store.hours ?? []
}

/**
 * Is this a service that runs past midnight?
 *
 * `18:00 – 02:00` closes on the *next* calendar day: a service ending before it
 * starts can only mean it crossed midnight. `open === close` is the 24-hour day
 * that `00:00 – 00:00` has always meant; a day that is shut says so with
 * `isClosed`.
 *
 * WHY IT TAKES MINUTES: this comparison used to be made on the `"HH:MM"`
 * strings, and `parseClockTime` accepts `H:MM` as well. The two then disagreed
 * about what a time is, in both directions. `"17:00" <= "9:00"` is
 * lexicographically TRUE, so a 9-to-5 bakery written `9:00` was read as an
 * overnight service and took orders at four in the morning. And `"2:00" <=
 * "18:00"` is FALSE, so a food truck written `18:00 – 2:00` was read as a
 * same-day window that never opens, and could not sell at any hour of its own
 * service. Comparing what was parsed leaves nothing for the two to disagree on.
 */
function crossesMidnight(open: number, close: number): boolean {
  return close <= open
}

/** The day and minute-of-day a schedule is read at, on somebody's clock. */
export interface HoursClock {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  /** Minutes past midnight. */
  minutes: number
}

/**
 * Whether the establishment is serving at `now`, on its own clock.
 *
 * An empty week is not a closure: `hours` is required by the schema and
 * `stores.create` seeds a full week, so an empty array means nobody has
 * declared anything — and there is nothing to be outside of. What decides then
 * is `status`, which every caller checks alongside this.
 *
 * `timezone` is the establishment's, never the visitor's. Convex runs in UTC
 * and a browser runs on whatever the customer's laptop says; both close a lunch
 * service at the wrong hour, and one of them is settable by the customer.
 */
export function isWithinBusinessHours(
  hours: BusinessHours[],
  now: number,
  timezone?: string
): boolean {
  return isWithinBusinessHoursAt(hours, restaurantClock(now, timezone))
}

/**
 * The same rule, asked about a moment somebody else has already read.
 *
 * `isStoreOpen` in `@be-in-digital/restaurant` keeps its own reading frame —
 * it has to, because it also reports when the service next changes and that
 * arithmetic is done on a `Date`. Handing it the rule rather than the clock is
 * what stops one call describing two different moments: it reported "open, no
 * current service, opens again in two hours" when the two frames fell back
 * differently on a timezone `Intl` would not accept.
 *
 * The rule is shared; the clock is each caller's own. That is the seam.
 */
export function isWithinBusinessHoursAt(
  hours: BusinessHours[],
  clock: HoursClock
): boolean {
  if (hours.length === 0) return true

  const { day, minutes } = clock

  // Yesterday's service, if it runs into today. A Friday 18:00–02:00 is still
  // serving at 01:00 on Saturday, and Saturday's own row says nothing about it:
  // Saturday's service starts at 18:00, and Saturday may even be shut.
  const yesterday = hours.find((h) => h.day === (day + 6) % 7)
  if (yesterday && !yesterday.isClosed) {
    const from = parseClockTime(yesterday.open)
    const until = parseClockTime(yesterday.close)
    if (
      from !== undefined &&
      until !== undefined &&
      crossesMidnight(from, until) &&
      minutes < until
    ) {
      return true
    }
  }

  const today = hours.find((h) => h.day === day)
  if (!today || today.isClosed) return false

  const open = parseClockTime(today.open)
  const close = parseClockTime(today.close)
  // A row the owner cannot have written — a migration, an import, a
  // hand-edited document. `<input type="time">` cannot produce one. There is no
  // schedule here to be inside of, and this file's whole reason for existing is
  // that failing open means a kitchen ticket at 4 a.m.: the same call the
  // publication rule next door makes, where forgetting hides a restaurant
  // rather than letting one take orders it cannot honour.
  if (open === undefined || close === undefined) return false

  // An overnight service is open from its opening time until midnight; the
  // hours after midnight belong to yesterday's row, handled above.
  if (crossesMidnight(open, close)) return minutes >= open

  return minutes >= open && minutes < close
}
