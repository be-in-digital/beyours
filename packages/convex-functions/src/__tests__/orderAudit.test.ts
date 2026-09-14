import { describe, expect, it } from "vitest"

import {
  MAX_ORDER_AUDIT_DETAILS,
  orderStatusAuditDetails,
} from "../orderAudit"

/**
 * The sentence an order's status change leaves behind (#104).
 *
 * An order's status releases the kitchen, flags money as owed back and cancels
 * tickets, and nothing recorded who changed it. `systemAuditLog` existed and
 * carried the RGPD runs and nothing else.
 */

describe("orderStatusAuditDetails", () => {
  it("names the order and both statuses", () => {
    expect(
      orderStatusAuditDetails({ orderNumber: "ORD-2026-0042", from: "pending", to: "confirmed" })
    ).toBe("commande ORD-2026-0042 — pending → confirmed")
  })

  it("names the platform an order came from", () => {
    // A cancellation Deliveroo sent and one a member of staff made are the same
    // two statuses and very different facts.
    expect(
      orderStatusAuditDetails({
        orderNumber: "ORD-1",
        from: "pending",
        to: "cancelled",
        source: "deliveroo",
      })
    ).toContain("source deliveroo")
  })

  it("says nothing about the source for a website order", () => {
    // Every order is a website order unless it says otherwise; printing it would
    // be noise on the majority of lines.
    expect(
      orderStatusAuditDetails({
        orderNumber: "ORD-1",
        from: "pending",
        to: "confirmed",
        source: "website",
      })
    ).not.toContain("source")
  })

  it("carries the cancellation reason when there is one", () => {
    expect(
      orderStatusAuditDetails({
        orderNumber: "ORD-1",
        from: "confirmed",
        to: "cancelled",
        reason: "Refusée : ingredient_unavailable",
      })
    ).toContain("motif : Refusée : ingredient_unavailable")
  })

  it("is bounded", () => {
    // The log is read, not parsed, and a reason is free text from a form.
    const long = orderStatusAuditDetails({
      orderNumber: "ORD-1",
      from: "confirmed",
      to: "cancelled",
      reason: "x".repeat(2_000),
    })
    expect(long.length).toBe(MAX_ORDER_AUDIT_DETAILS)
  })

  it("names no diner", () => {
    /*
     * The omission is the point. `systemAuditLog` is read by the whole team and
     * sits OUTSIDE the erasure set — `DINER_TABLES` does not list it — so a
     * customer's name or address in here would be a copy of their data that
     * `eraseDataSubject` cannot reach. The order number is the link.
     */
    const details = orderStatusAuditDetails({
      orderNumber: "ORD-2026-0042",
      from: "pending",
      to: "confirmed",
      source: "website",
      reason: undefined,
    })
    expect(details).toBe("commande ORD-2026-0042 — pending → confirmed")
  })
})
