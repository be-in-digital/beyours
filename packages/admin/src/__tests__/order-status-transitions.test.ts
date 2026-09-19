import { describe, it, expect } from "vitest"
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getNextOrderStatuses,
} from "@be-yours/convex-schema"
import { statusTransitions } from "../pages/orders/order-status-transitions"

/**
 * The admin UI may offer fewer transitions than the server allows — product
 * choice. It must never offer more: that button would write a state
 * `updateStatus` refuses, and the operator would meet a raw error.
 *
 * This suite failed before the status machine was unified: the UI offered
 * "Envoyer en livraison" on a ready order while the transition table forbade
 * `ready -> out_for_delivery`.
 */
describe("admin order actions vs the status machine", () => {
  it("covers every order status", () => {
    expect(Object.keys(statusTransitions).sort()).toEqual(
      [...ORDER_STATUSES].sort()
    )
  })

  it("never offers a transition the server would refuse", () => {
    for (const status of ORDER_STATUSES) {
      for (const action of statusTransitions[status]) {
        expect(
          canTransitionOrderStatus(status, action.nextStatus),
          `UI offers "${action.label}" (${status} -> ${action.nextStatus}), which updateStatus rejects`
        ).toBe(true)
      }
    }
  })

  it("offers no action on a terminal status", () => {
    expect(statusTransitions.completed).toEqual([])
    expect(statusTransitions.cancelled).toEqual([])
  })

  it("asks for a reason on every cancellation it offers", () => {
    for (const status of ORDER_STATUSES) {
      for (const action of statusTransitions[status]) {
        if (action.nextStatus !== "cancelled") continue
        expect(
          action.requiresReason,
          `cancelling from ${status} should ask for a reason`
        ).toBe(true)
      }
    }
  })

  it("keeps the delivery hand-off reachable from a ready order", () => {
    // The regression that started all this: the button existed, the table said no.
    expect(getNextOrderStatuses("ready")).toContain("out_for_delivery")
    expect(
      statusTransitions.ready.map((a) => a.nextStatus)
    ).toContain("out_for_delivery")
  })
})
