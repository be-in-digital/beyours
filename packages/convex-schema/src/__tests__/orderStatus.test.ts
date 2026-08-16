import { describe, it, expect } from "vitest"
import type { OrderStatus } from "../types"
import {
  ORDER_STATUSES,
  ORDER_TERMINAL_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  canTransitionOrderStatus,
  getNextOrderStatuses,
} from "../orderStatus"

// ============================================================================
// Table shape
// ============================================================================

describe("ORDER_STATUS_TRANSITIONS", () => {
  it("covers every order status", () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual(
      [...ORDER_STATUSES].sort()
    )
  })

  it("only targets known statuses", () => {
    for (const [from, targets] of Object.entries(ORDER_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(ORDER_STATUSES, `${from} -> ${to}`).toContain(to)
      }
    }
  })

  it("never lists a self-transition", () => {
    // Staying put is handled as an idempotent no-op, not as a transition.
    for (const [from, targets] of Object.entries(ORDER_STATUS_TRANSITIONS)) {
      expect(targets, `${from} -> ${from}`).not.toContain(from)
    }
  })

  it("leaves terminal statuses with no way out", () => {
    for (const terminal of ORDER_TERMINAL_STATUSES) {
      expect(getNextOrderStatuses(terminal), terminal).toEqual([])
    }
  })

  it("lets every non-terminal status reach a terminal one", () => {
    // Guards against a status that traps an order forever.
    const terminal = new Set<string>(ORDER_TERMINAL_STATUSES)
    for (const status of ORDER_STATUSES) {
      if (terminal.has(status)) continue

      const seen = new Set<string>()
      const queue: OrderStatus[] = [status]
      let reached = false

      while (queue.length > 0) {
        const current = queue.shift() as OrderStatus
        if (seen.has(current)) continue
        seen.add(current)
        if (terminal.has(current)) {
          reached = true
          break
        }
        queue.push(...getNextOrderStatuses(current))
      }

      expect(reached, `${status} never reaches a terminal status`).toBe(true)
    }
  })
})

// ============================================================================
// canTransitionOrderStatus
// ============================================================================

describe("canTransitionOrderStatus", () => {
  it("accepts the documented happy path", () => {
    expect(canTransitionOrderStatus("pending", "confirmed")).toBe(true)
    expect(canTransitionOrderStatus("confirmed", "preparing")).toBe(true)
    expect(canTransitionOrderStatus("preparing", "ready")).toBe(true)
    expect(canTransitionOrderStatus("out_for_delivery", "delivered")).toBe(true)
    expect(canTransitionOrderStatus("delivered", "completed")).toBe(true)
  })

  it("allows a ready order to be sent out for delivery", () => {
    // The admin UI offers this ("Envoyer en livraison") — the table has to
    // agree, or the button writes a state the server would refuse.
    expect(canTransitionOrderStatus("ready", "out_for_delivery")).toBe(true)
  })

  it("refuses to skip the acceptance step", () => {
    expect(canTransitionOrderStatus("pending", "preparing")).toBe(false)
    expect(canTransitionOrderStatus("pending", "completed")).toBe(false)
  })

  it("refuses to walk an order backwards", () => {
    expect(canTransitionOrderStatus("preparing", "confirmed")).toBe(false)
    expect(canTransitionOrderStatus("delivered", "out_for_delivery")).toBe(false)
  })

  it("refuses to revive a terminal order", () => {
    expect(canTransitionOrderStatus("completed", "preparing")).toBe(false)
    expect(canTransitionOrderStatus("cancelled", "confirmed")).toBe(false)
  })

  it("refuses a self-transition", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransitionOrderStatus(status, status), status).toBe(false)
    }
  })

  it("denies an unknown source status instead of trusting it", () => {
    expect(
      canTransitionOrderStatus("legacy_status" as OrderStatus, "cancelled")
    ).toBe(false)
  })
})

// ============================================================================
// Cancellation window — mirrors what Deliveroo allows
// ============================================================================

describe("cancellation window", () => {
  it("allows cancelling before the kitchen starts", () => {
    expect(canTransitionOrderStatus("pending", "cancelled")).toBe(true)
    expect(canTransitionOrderStatus("confirmed", "cancelled")).toBe(true)
  })

  it("refuses cancelling once preparing, ready or with a rider", () => {
    // Deliveroo forbids it, so accepting it internally would desync the two.
    expect(canTransitionOrderStatus("preparing", "cancelled")).toBe(false)
    expect(canTransitionOrderStatus("ready", "cancelled")).toBe(false)
    expect(canTransitionOrderStatus("out_for_delivery", "cancelled")).toBe(false)
  })
})
