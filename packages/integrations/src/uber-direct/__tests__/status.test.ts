import { describe, it, expect } from "vitest"
import {
  UBER_DIRECT_STATUSES,
  isUberDirectStatus,
  isTerminalUberDirectStatus,
  orderStatusForDeliveryStatus,
  requiresManualIntervention,
} from "../status"

describe("isUberDirectStatus", () => {
  it("accepts every documented status", () => {
    for (const status of UBER_DIRECT_STATUSES) {
      expect(isUberDirectStatus(status)).toBe(true)
    }
  })

  it("rejects unknown values rather than letting them through", () => {
    // A status we do not know must not reach the order: an Uber vocabulary
    // change should stall the delivery, not move the order somewhere wrong.
    for (const value of ["", "completed", "DELIVERED", "PICKUP", "null"]) {
      expect(isUberDirectStatus(value)).toBe(false)
    }
  })
})

describe("orderStatusForDeliveryStatus", () => {
  it("leaves the order alone until the courier has the food", () => {
    expect(orderStatusForDeliveryStatus("SCHEDULED")).toBeNull()
    expect(orderStatusForDeliveryStatus("EN_ROUTE_TO_PICKUP")).toBeNull()
    expect(orderStatusForDeliveryStatus("ARRIVED_AT_PICKUP")).toBeNull()
  })

  it("moves the order out for delivery once the courier is en route", () => {
    expect(orderStatusForDeliveryStatus("EN_ROUTE_TO_DROPOFF")).toBe(
      "out_for_delivery"
    )
  })

  it("keeps the order out for delivery on arrival, not delivered", () => {
    // Arriving is not handing over. Marking it delivered here would close the
    // order before the customer has the bag.
    expect(orderStatusForDeliveryStatus("ARRIVED_AT_DROPOFF")).toBe(
      "out_for_delivery"
    )
  })

  it("marks the order delivered only on completion", () => {
    expect(orderStatusForDeliveryStatus("COMPLETED")).toBe("delivered")
  })

  it("does not touch the order on failure", () => {
    // out_for_delivery -> cancelled is not a legal transition, so a failed
    // delivery cannot unwind the order on its own.
    expect(orderStatusForDeliveryStatus("FAILED")).toBeNull()
  })

  it("only ever targets statuses the order machine allows", () => {
    const reachable = new Set(["out_for_delivery", "delivered"])
    for (const status of UBER_DIRECT_STATUSES) {
      const target = orderStatusForDeliveryStatus(status)
      if (target !== null) expect(reachable.has(target)).toBe(true)
    }
  })
})

describe("terminal statuses", () => {
  it("treats completion and failure as the end of the delivery", () => {
    expect(isTerminalUberDirectStatus("COMPLETED")).toBe(true)
    expect(isTerminalUberDirectStatus("FAILED")).toBe(true)
  })

  it("treats everything else as in flight", () => {
    expect(isTerminalUberDirectStatus("SCHEDULED")).toBe(false)
    expect(isTerminalUberDirectStatus("ARRIVED_AT_DROPOFF")).toBe(false)
  })
})

describe("requiresManualIntervention", () => {
  it("flags a failed delivery and nothing else", () => {
    expect(requiresManualIntervention("FAILED")).toBe(true)
    for (const status of UBER_DIRECT_STATUSES.filter((s) => s !== "FAILED")) {
      expect(requiresManualIntervention(status)).toBe(false)
    }
  })
})
