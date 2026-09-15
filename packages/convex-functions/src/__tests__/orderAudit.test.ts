import { describe, expect, it } from "vitest"

import {
  MAX_ORDER_AUDIT_DETAILS,
  orderStatusAuditDetails,
  recordOrderStatusChange,
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

/**
 * The promise in the docblock, kept (#531).
 *
 * `recordOrderStatusChange` says "Never throws. An audit line is not a reason
 * for a kitchen status change to fail" — and only the identity lookup was
 * inside the `try`. The `ctx.db.insert` sat outside it, in the same transaction
 * as the order's own status patch, so an insert that failed rolled the status
 * change back and gave the caller a generic error about an audit line they
 * never asked for.
 *
 * A promise in a comment is not a control. This is the control.
 */
describe("recordOrderStatusChange", () => {
  const input = {
    orderNumber: "ORD-2026-0042",
    from: "pending",
    to: "confirmed",
    now: 1_800_000_000_000,
  }

  function ctxWith(insert: (table: string, doc: any) => unknown, identity?: unknown) {
    const written: any[] = []
    return {
      written,
      ctx: {
        auth: { getUserIdentity: async () => identity ?? null },
        db: {
          insert: async (table: string, doc: any) => {
            written.push({ table, doc })
            return insert(table, doc)
          },
        },
      },
    }
  }

  it("writes the line when the insert works", async () => {
    // Anti-vacuity: without this, "does not throw" would also pass on a
    // function that writes nothing at all.
    const { ctx, written } = ctxWith(() => "audit_1")
    await recordOrderStatusChange(ctx as any, input)

    expect(written).toHaveLength(1)
    expect(written[0].table).toBe("systemAuditLog")
    expect(written[0].doc.action).toBe("order_status_change")
    expect(written[0].doc.details).toContain("ORD-2026-0042")
  })

  it("does not throw when the insert fails", async () => {
    /*
     * THE DEFECT. This rejected, and it runs inside the caller's transaction:
     * a failed audit line took the status change with it. A cook marking an
     * order ready got « Erreur », the ticket stayed open, and the reason was a
     * write nobody on the pass had asked for.
     */
    const { ctx } = ctxWith(() => {
      throw new Error("write conflict")
    })

    await expect(recordOrderStatusChange(ctx as any, input)).resolves.toBeUndefined()
  })

  it("does not throw when the insert rejects asynchronously", async () => {
    // A `try` around a call whose promise is not awaited catches nothing. The
    // insert IS awaited here, and this is what proves it.
    const { ctx } = ctxWith(() => Promise.reject(new Error("document too large")))

    await expect(recordOrderStatusChange(ctx as any, input)).resolves.toBeUndefined()
  })

  it("records the identity's subject as the actor", async () => {
    const { ctx, written } = ctxWith(() => "audit_1", { subject: "user_42" })
    await recordOrderStatusChange(ctx as any, input)

    expect(written[0].doc.performedBy).toBe("user_42")
  })

  it("falls back to « système » when there is no identity", async () => {
    // A platform webhook, the scheduler and a payment confirmation all move
    // orders with no session.
    const { ctx, written } = ctxWith(() => "audit_1")
    await recordOrderStatusChange(ctx as any, input)

    expect(written[0].doc.performedBy).toBe("système")
  })
})
