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
 * CANCELLATION RUNS UNTIL THE FOOD IS HANDED OVER (#111). It used to stop at
 * `confirmed`, and the reason given was Deliveroo: the platform refuses to cancel
 * an order already being made, ready for collection, or with a rider, so
 * accepting it on our side would desync the two systems.
 *
 * That reasoning is sound and it is about ONE KIND OF ORDER. The table is global,
 * so applying it to everything left an establishment unable to record the
 * commonest cancellation there is — the diner who telephones while the kitchen is
 * cooking. There was no way to say so: the only status reachable from `preparing`
 * was `ready`, and the staff's only recourse was to complete an order that never
 * happened, which puts money in the takings, issues an invoice in a fiscal series
 * and writes a sale into the customer book, for food nobody received.
 *
 * So the platform constraint moved to where the platform is known.
 * `orders.updateStatus` refuses a late cancellation when `isMarketplaceOrder`
 * — it has `order.source`, and this table does not.
 *
 * `delivered` and `completed` still cannot be cancelled, and that is not the same
 * question: the diner has the food. Money comes back through
 * `payments.refundPayment`, which calls the provider.
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "out_for_delivery", "cancelled"],
  ready: ["completed", "out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
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
