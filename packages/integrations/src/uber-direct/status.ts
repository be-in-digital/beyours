/**
 * Uber Direct — mapping courier status onto our order status
 *
 * The order status machine (`@be-yours/convex-schema`) is deliberately
 * narrow, and that shapes this mapping more than the Uber vocabulary does:
 *
 *   out_for_delivery -> delivered        (the only move out of a live delivery)
 *   delivered        -> completed
 *
 * Two consequences worth stating, because they are not obvious:
 *
 * 1. Nothing before `EN_ROUTE_TO_DROPOFF` touches the order. A courier being
 *    assigned or standing in the kitchen is delivery news, not order news, and
 *    forcing an order to `out_for_delivery` while the food is still on the pass
 *    would lie to the kitchen display.
 *
 * 2. **`FAILED` maps to nothing.** `out_for_delivery -> cancelled` is not a
 *    legal move, so a failed delivery cannot cancel the order on its own. It is
 *    surfaced for a human instead. Silently swallowing it would leave a paid
 *    order stuck at `out_for_delivery` with no food and nobody told.
 */

import type { UberDirectStatus } from "./types"

/** Statuses Uber may send, used to reject anything we do not recognise. */
export const UBER_DIRECT_STATUSES: readonly UberDirectStatus[] = [
  "SCHEDULED",
  "EN_ROUTE_TO_PICKUP",
  "ARRIVED_AT_PICKUP",
  "EN_ROUTE_TO_DROPOFF",
  "ARRIVED_AT_DROPOFF",
  "COMPLETED",
  "FAILED",
] as const

/** Statuses that end the delivery, successfully or not. */
export const UBER_DIRECT_TERMINAL_STATUSES: readonly UberDirectStatus[] = [
  "COMPLETED",
  "FAILED",
] as const

export function isUberDirectStatus(value: string): value is UberDirectStatus {
  return (UBER_DIRECT_STATUSES as readonly string[]).includes(value)
}

export function isTerminalUberDirectStatus(status: UberDirectStatus): boolean {
  return (UBER_DIRECT_TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * The order status a courier update should drive the order to, if any.
 *
 * `null` means "record the delivery status, leave the order alone" — which is
 * the answer for most of the lifecycle.
 */
export function orderStatusForDeliveryStatus(
  status: UberDirectStatus
): "out_for_delivery" | "delivered" | null {
  switch (status) {
    case "EN_ROUTE_TO_DROPOFF":
    case "ARRIVED_AT_DROPOFF":
      return "out_for_delivery"
    case "COMPLETED":
      return "delivered"
    case "SCHEDULED":
    case "EN_ROUTE_TO_PICKUP":
    case "ARRIVED_AT_PICKUP":
    case "FAILED":
      return null
  }
}

/**
 * Whether this status needs a human to look at the order.
 *
 * Only `FAILED` does: the order stays paid and `out_for_delivery` with no
 * courier, and the status machine gives us no way to unwind it automatically.
 */
export function requiresManualIntervention(status: UberDirectStatus): boolean {
  return status === "FAILED"
}
