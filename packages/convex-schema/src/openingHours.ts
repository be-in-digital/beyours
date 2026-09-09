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
 * Does this location follow the deployment-wide week?
 *
 * WHY `undefined` MEANS YES. `useGlobalHours` is `v.optional(v.boolean())` in
 * the schema, so a store nobody has opened in the dashboard since the column
 * was added carries no value at all. Every other layer already calls that
 * `true`: `validators.ts` declares `z.boolean().default(true)`, `stores.create`
 * seeds `useGlobalHours: true`, and `use-store-detail.ts` opens the switch on
 * with `store.useGlobalHours ?? true`. Only this function read the absent value
 * as `false`, and a bare `if (store.useGlobalHours && …)` is how it did it.
 *
 * THE COST OF THE DISAGREEMENT, measured on the bench. The owner opens
 * Horaires, sees the toggle on and the sentence « Cet établissement utilise les
 * horaires globaux », sets the global week to 02:00–03:00 and saves — and the
 * store row still holds no `useGlobalHours`, because saving the GLOBAL hours
 * writes `globalSettings`, not the store. At 18:29 the storefront then resolved
 * the store's own 09:00–22:00, showed no closed banner and enabled every
 * add-to-cart button: open when the owner believed they had closed, taking
 * orders for a kitchen with nobody in it. The same defect had already been seen
 * in the other direction — closed when it should have been open — and it is one
 * `??` either way.
 *
 * An explicit `false` is the only thing that keeps a location on its own hours,
 * which is what the switch writes when an owner turns it off.
 */
export function followsGlobalHours(store: {
  useGlobalHours?: boolean | null
}): boolean {
  return store.useGlobalHours ?? true
}

/**
 * Which hours actually govern an establishment.
 *
 * `useGlobalHours` is a per-store flag the dashboard writes: on, the location
 * follows the deployment-wide week; off, it keeps its own. Resolved on read
 * rather than copied on write, so editing the global hours reaches every
 * location that follows them without a migration.
 *
 * A location that follows the global week and is handed NO global week falls
 * back to its own rather than to nothing: an empty result is read as "no
 * schedule declared" by `isWithinBusinessHoursAt`, which is permission to serve
 * at any hour. The fallback is the conservative half of the same choice.
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
