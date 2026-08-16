/**
 * Order status machine
 *
 * The single source of truth for how an order may move between statuses.
 *
 * It lives here, next to the schema, because three layers need the same answer
 * and none of them can depend on the others: the storefront services
 * (`@be-in-digital/restaurant`), the admin UI (`@be-in-digital/admin`) and the
 * `updateStatus` mutation (`@be-in-digital/convex-functions`). They each used
 * to carry their own opinion, and the opinions had drifted — the UI offered
 * "Envoyer en livraison" on a ready order while the service table forbade it.
 */

import type { OrderStatus } from "./types"

/** Every order status, in lifecycle order. */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
] as const satisfies readonly OrderStatus[]

/** Statuses an order can never leave. */
export const ORDER_TERMINAL_STATUSES = ["completed", "cancelled"] as const

/**
 * Allowed moves, keyed by current status.
 *
 * The cancellation window stops at `confirmed` on purpose: Deliveroo refuses to
 * cancel an order that is already being made, ready for collection, or with a
 * rider. Accepting it on our side would desync the two systems.
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "out_for_delivery"],
  ready: ["completed", "out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
}

/**
 * Statuses reachable from `from`.
 *
 * An unrecognised status yields no moves rather than a free pass — a corrupt
 * or legacy value should freeze the order, not unlock every transition.
 */
export function getNextOrderStatuses(
  from: OrderStatus
): readonly OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[from] ?? []
}

/**
 * Whether an order may move from one status to another.
 *
 * Staying on the same status is **not** a transition: callers that replay a
 * status (webhook retries, a double-clicked button) should treat it as a no-op
 * rather than ask this function for permission.
 */
export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return getNextOrderStatuses(from).includes(to)
}
