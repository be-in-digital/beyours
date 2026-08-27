/**
 * Store publication rule
 *
 * The single source of truth for which establishments a visitor may order from.
 *
 * It lives here, next to the schema, because the layers that need the same
 * answer cannot depend on one another: the `stores.list` query and the order
 * mutation (`@be-in-digital/convex-functions`), and the storefront selector
 * (`@be-in-digital/restaurant`).
 *
 * `stores.create` opens every new establishment in `draft`, and nothing used to
 * take it back out of the storefront: the selector listed it beside the real
 * restaurants, with an active "Commander ici" button, and the automatic
 * selection could land a visitor on it. A location whose owner had not
 * finished setting it up could take a real order.
 */

import type { StoreStatus } from "./types"

/**
 * Statuses that make an establishment a storefront.
 *
 * `closed` and `temporarily_unavailable` are states of a *published* location —
 * outside its hours, or paused for the evening. They stay listed, and the
 * storefront shows them as unavailable. `draft` is the one that was never
 * published, and it is deliberately absent.
 *
 * This is an allow-list rather than `!== "draft"` on purpose: a status added to
 * the union later stays out of the storefront until someone decides it belongs
 * there. The failure mode of forgetting is a hidden restaurant, not a
 * restaurant taking orders it cannot honour.
 */
export const PUBLISHED_STORE_STATUSES = [
  "open",
  "closed",
  "temporarily_unavailable",
] as const satisfies readonly StoreStatus[]

/**
 * Whether an establishment is published — i.e. may be listed and ordered from.
 *
 * Anything without a recognised status is not published. A missing or corrupt
 * value should keep a location out of the storefront, not wave it through.
 */
export function isPublishedStore(
  store: { status?: string | null } | null | undefined
): boolean {
  if (!store?.status) return false
  return (PUBLISHED_STORE_STATUSES as readonly string[]).includes(store.status)
}
