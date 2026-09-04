import { describe, it, expect } from "vitest"
import { reserveRefund, confirmRefund, releaseRefund } from "../payments"

/**
 * The two-phase refund.
 *
 * The write that recorded a refund re-validated against a fresh document, so
 * the stored balance could never overshoot. What it could not do was run
 * before the provider — and it has since been deleted outright, having had no
 * callers left once the reservation moved in front of the provider call: two
 * refunds arriving together both read `refundedAmount: 0`, both passed
 * validation, and both sent money back. The database stayed consistent and the
 * till did not.
 *
 * These tests drive the handlers against an in-memory document, which is what a
 * Convex mutation sees — the point being that the balance moves at RESERVE
 * time, not at record time.
 */

type Doc = Record<string, any>

function createDb(payment: Doc, order: Doc = { paymentStatus: "paid" }) {
  const docs: Record<string, Doc> = { "p1": payment, "o1": order }
  return {
    // The handler receives a ctx, and reads `ctx.db` — not the db itself.
    ctx: {
      db: {
        get: async (id: string) => docs[id] ?? null,
        patch: async (id: string, updates: Doc) => {
          docs[id] = { ...docs[id], ...updates }
        },
      },
    },
    docs,
  }
}

function paidCard(overrides: Doc = {}): Doc {
  return {
    orderId: "o1",
    provider: "stripe",
    status: "succeeded",
    amount: 10_000,
    externalId: "pi_123",
    currency: "EUR",
    ...overrides,
  }
}

describe("reserveRefund commits before the provider is called", () => {
  it("moves the balance immediately", async () => {
    const { ctx, docs } = createDb(paidCard())

    const { plan, index } = await reserveRefund.handler(ctx, {
      id: "p1",
      amount: 4_000,
      refundMethod: "api",
    })

    expect(plan.refundedAmount).toBe(4_000)
    expect(index).toBe(0)
    expect(docs.p1.refundedAmount).toBe(4_000)
    expect(docs.p1.refunds).toHaveLength(1)
    expect(docs.p1.refunds[0].state).toBe("reserved")
  })

  it("refuses a second refund that would overshoot the balance", async () => {
    const { ctx } = createDb(paidCard())

    await reserveRefund.handler(ctx, { id: "p1", amount: 7_000, refundMethod: "api" })

    // The second caller reads the first caller's committed amount.
    await expect(
      reserveRefund.handler(ctx, { id: "p1", amount: 7_000, refundMethod: "api" })
    ).rejects.toThrow()
  })

  it("allows two partial refunds that fit", async () => {
    const { ctx, docs } = createDb(paidCard())

    await reserveRefund.handler(ctx, { id: "p1", amount: 4_000, refundMethod: "api" })
    await reserveRefund.handler(ctx, { id: "p1", amount: 6_000, refundMethod: "api" })

    expect(docs.p1.refundedAmount).toBe(10_000)
    expect(docs.p1.refunds).toHaveLength(2)
  })
})

describe("confirmRefund keeps every provider reference", () => {
  it("records each refund's own reference", async () => {
    const { ctx, docs } = createDb(paidCard())

    const first = await reserveRefund.handler(ctx, { id: "p1", amount: 4_000, refundMethod: "api" })
    await confirmRefund.handler(ctx, { id: "p1", index: first.index, externalRefundId: "re_first" })

    const second = await reserveRefund.handler(ctx, { id: "p1", amount: 6_000, refundMethod: "api" })
    await confirmRefund.handler(ctx, { id: "p1", index: second.index, externalRefundId: "re_second" })

    // The scalar field only ever held the last one; the array holds both.
    expect(docs.p1.externalRefundId).toBe("re_second")
    expect(docs.p1.refunds.map((r: Doc) => r.externalRefundId)).toEqual([
      "re_first",
      "re_second",
    ])
    expect(docs.p1.refunds.every((r: Doc) => r.state === "confirmed")).toBe(true)
  })

  it("refuses to confirm a reservation that does not exist", async () => {
    const { ctx } = createDb(paidCard())

    await expect(
      confirmRefund.handler(ctx, { id: "p1", index: 3, externalRefundId: "re_x" })
    ).rejects.toThrow()
  })
})

describe("releaseRefund gives the amount back when the provider refuses", () => {
  it("restores the balance so the refund can be retried", async () => {
    const { ctx, docs } = createDb(paidCard())

    const { index } = await reserveRefund.handler(ctx, { id: "p1", amount: 4_000, refundMethod: "api" })
    expect(docs.p1.refundedAmount).toBe(4_000)

    await releaseRefund.handler(ctx, { id: "p1", index })

    expect(docs.p1.refundedAmount).toBe(0)
    expect(docs.p1.refunds[0].state).toBe("released")
    expect(docs.o1.paymentStatus).toBe("paid")

    // And the full amount is refundable again.
    await expect(
      reserveRefund.handler(ctx, { id: "p1", amount: 10_000, refundMethod: "api" })
    ).resolves.toBeTruthy()
  })

  it("keeps a cancelled order at refund_pending instead of calling it paid", async () => {
    // A cancelled order sits at "refund_pending": paid once, cancelled since,
    // money still owed back. Releasing a refused refund used to write "paid"
    // unconditionally, which erased the only marker saying an operator still
    // has to send that money — the refund would be forgotten, not retried.
    const { ctx, docs } = createDb(paidCard(), {
      status: "cancelled",
      paymentStatus: "refund_pending",
    })

    const { index } = await reserveRefund.handler(ctx, {
      id: "p1",
      amount: 10_000,
      refundMethod: "api",
    })
    expect(docs.o1.paymentStatus).toBe("refunded")

    await releaseRefund.handler(ctx, { id: "p1", index })

    expect(docs.p1.refundedAmount).toBe(0)
    expect(docs.o1.paymentStatus).toBe("refund_pending")
  })

  it("leaves a partial balance intact when only the second refund failed", async () => {
    const { ctx, docs } = createDb(paidCard())

    const first = await reserveRefund.handler(ctx, { id: "p1", amount: 4_000, refundMethod: "api" })
    await confirmRefund.handler(ctx, { id: "p1", index: first.index, externalRefundId: "re_first" })
    const second = await reserveRefund.handler(ctx, { id: "p1", amount: 3_000, refundMethod: "api" })

    await releaseRefund.handler(ctx, { id: "p1", index: second.index })

    expect(docs.p1.refundedAmount).toBe(4_000)
    expect(docs.p1.status).toBe("partially_refunded")
  })

  it("is a no-op on an already-confirmed refund", async () => {
    const { ctx, docs } = createDb(paidCard())

    const { index } = await reserveRefund.handler(ctx, { id: "p1", amount: 4_000, refundMethod: "api" })
    await confirmRefund.handler(ctx, { id: "p1", index, externalRefundId: "re_first" })
    await releaseRefund.handler(ctx, { id: "p1", index })

    expect(docs.p1.refundedAmount).toBe(4_000)
    expect(docs.p1.refunds[0].state).toBe("confirmed")
  })
})

describe("a released refund is retryable", () => {
  it("returns the payment to a status planRefund accepts", async () => {
    const { ctx, docs } = createDb(paidCard())

    const { index } = await reserveRefund.handler(ctx, {
      id: "p1",
      amount: 10_000,
      refundMethod: "api",
    })
    await releaseRefund.handler(ctx, { id: "p1", index })

    // The first version of releaseRefund wrote "completed" here, which
    // REFUNDABLE_STATUSES rejects — releasing a failed refund would have made
    // the money permanently unrefundable, the exact opposite of the point.
    expect(docs.p1.status).toBe("succeeded")

    await expect(
      reserveRefund.handler(ctx, {
        id: "p1",
        amount: 10_000,
        refundMethod: "api",
      })
    ).resolves.toBeTruthy()
  })
})

