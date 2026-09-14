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
// Cancellation window — open until the food is handed over
// ============================================================================

describe("cancellation window", () => {
  it("allows cancelling before the kitchen starts", () => {
    expect(canTransitionOrderStatus("pending", "cancelled")).toBe(true)
    expect(canTransitionOrderStatus("confirmed", "cancelled")).toBe(true)
  })

  it("allows cancelling once the kitchen has started (#111)", () => {
    /*
     * THIS USED TO BE `toBe(false)`, with "Deliveroo forbids it" as the reason.
     * That reasoning is sound and it is about ONE KIND OF ORDER. This table is
     * global, so applying it to everything left an establishment unable to record
     * the commonest cancellation there is — the diner who telephones while the
     * kitchen is cooking. The staff's only recourse was to COMPLETE an order that
     * never happened: money in the takings, an invoice in a fiscal series, and a
     * sale in the customer book, for food nobody received.
     *
     * The platform constraint moved to where the platform is known:
     * `orders.updateStatus` refuses a late cancellation when
     * `isMarketplaceOrder(order.source)`, and `order-cancel-window.test.ts` in
     * both apps holds that half.
     */
    expect(canTransitionOrderStatus("preparing", "cancelled")).toBe(true)
    expect(canTransitionOrderStatus("ready", "cancelled")).toBe(true)
    expect(canTransitionOrderStatus("out_for_delivery", "cancelled")).toBe(true)
  })

  it("refuses cancelling once the diner has the food", () => {
    // Not the same question. Money comes back through `payments.refundPayment`,
    // which calls the provider; a cancellation would claim the food never left.
    expect(canTransitionOrderStatus("delivered", "cancelled")).toBe(false)
    expect(canTransitionOrderStatus("completed", "cancelled")).toBe(false)
  })
})
