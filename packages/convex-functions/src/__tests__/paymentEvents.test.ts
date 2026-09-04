/**
 * Webhook delivery deduplication.
 *
 * `stripeWebhook.handleWebhook` verified the signature and then processed
 * whatever arrived, every time it arrived. Stripe retries until it gets a 2xx
 * and says a delivery may repeat even after one, so a retry re-ran the whole
 * settlement path. `apps/site` had solved this for the commercial account and
 * the engine never got the same treatment.
 *
 * The state machine is the whole point, and it is not a boolean: a delivery
 * that was accepted but never finished must be let through again, or a handler
 * that died halfway would leave the work permanently undone while every retry
 * was silently swallowed as a duplicate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  EVENT_RETENTION_MS,
  beginEvent,
  markProcessed,
  sweepExpired,
} from "../paymentEvents"

const NOW = 1_700_000_000_000

interface Row {
  _id: string
  provider: string
  eventId: string
  eventType: string
  processed: boolean
  createdAt: number
  expiresAt: number
}

/**
 * The slice of `ctx.db` these handlers touch: the compound index, the
 * expiry range scan, insert, patch and delete.
 */
function makeCtx() {
  const rows: Row[] = []
  let seq = 0

  const ctx = {
    db: {
      insert: async (table: string, doc: Omit<Row, "_id">) => {
        const _id = `${table}:${++seq}`
        rows.push({ _id, ...doc })
        return _id
      },
      patch: async (id: string, updates: Partial<Row>) => {
        const row = rows.find((r) => r._id === id)
        if (!row) throw new Error(`no such row: ${id}`)
        Object.assign(row, updates)
      },
      delete: async (id: string) => {
        const at = rows.findIndex((r) => r._id === id)
        if (at >= 0) rows.splice(at, 1)
      },
      query: (_table: string) => ({
        withIndex: (name: string, fn: (q: unknown) => unknown) => {
          const eq: Record<string, unknown> = {}
          let lt: number | undefined

          const builder: Record<string, unknown> = {
            eq: (field: string, value: unknown) => {
              eq[field] = value
              return builder
            },
            lt: (_field: string, value: number) => {
              lt = value
              return builder
            },
          }
          fn(builder)

          const matched = rows.filter((row) => {
            if (name === "by_expiresAt") return lt !== undefined && row.expiresAt < lt
            return Object.entries(eq).every(
              ([field, value]) => (row as unknown as Record<string, unknown>)[field] === value
            )
          })

          return {
            unique: async () => {
              if (matched.length > 1) throw new Error("expected at most one row")
              return matched[0] ?? null
            },
            take: async (n: number) => matched.slice(0, n),
            collect: async () => matched,
          }
        },
      }),
    },
  }

  return { ctx, rows }
}

const STRIPE = { provider: "stripe", eventId: "evt_1", eventType: "checkout.session.completed" }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("beginEvent", () => {
  it("admits a delivery it has never seen, and records it", async () => {
    const { ctx, rows } = makeCtx()

    expect(await beginEvent.handler(ctx, STRIPE)).toBe("fresh")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: "stripe",
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      processed: false,
      createdAt: NOW,
      expiresAt: NOW + EVENT_RETENTION_MS,
    })
  })

  it("refuses the same delivery once it has been processed", async () => {
    const { ctx, rows } = makeCtx()

    await beginEvent.handler(ctx, STRIPE)
    await markProcessed.handler(ctx, { provider: "stripe", eventId: "evt_1" })

    expect(await beginEvent.handler(ctx, STRIPE)).toBe("already_processed")
    // And writes nothing: a duplicate must not accumulate rows either.
    expect(rows).toHaveLength(1)
  })

  it("lets a retry through while the first attempt is unfinished", async () => {
    // The failure this distinguishes: a handler that threw halfway leaves the
    // row unprocessed. Reading "present" as "done" would drop the retry and the
    // work would never be completed by anyone.
    const { ctx } = makeCtx()

    expect(await beginEvent.handler(ctx, STRIPE)).toBe("fresh")
    expect(await beginEvent.handler(ctx, STRIPE)).toBe("in_flight")
  })

  it("keys on the provider as well as the id", async () => {
    // Two providers are free to mint the same opaque string. Keying on the id
    // alone would let one provider's replay silence the other's real event.
    const { ctx, rows } = makeCtx()

    await beginEvent.handler(ctx, STRIPE)
    await markProcessed.handler(ctx, { provider: "stripe", eventId: "evt_1" })

    expect(
      await beginEvent.handler(ctx, {
        provider: "sumup",
        eventId: "evt_1",
        eventType: "checkout.paid",
      })
    ).toBe("fresh")
    expect(rows).toHaveLength(2)
  })

  it("refuses a delivery with no id at all", async () => {
    // An empty key deduplicates against nothing; every event would collide.
    const { ctx } = makeCtx()
    await expect(
      beginEvent.handler(ctx, { ...STRIPE, eventId: "" })
    ).rejects.toThrow(/event id/i)
  })
})

describe("markProcessed", () => {
  it("is a no-op on a delivery that was never begun", async () => {
    // A webhook whose `beginEvent` never ran must not have a row invented for
    // it here — that row would carry no expiry and never be swept.
    const { ctx, rows } = makeCtx()
    await markProcessed.handler(ctx, { provider: "stripe", eventId: "ghost" })
    expect(rows).toHaveLength(0)
  })
})

describe("sweepExpired", () => {
  it("deletes what has expired and keeps what has not", async () => {
    const { ctx, rows } = makeCtx()

    await beginEvent.handler(ctx, STRIPE)
    vi.setSystemTime(NOW + EVENT_RETENTION_MS)
    await beginEvent.handler(ctx, { ...STRIPE, eventId: "evt_2" })

    const cutoff = NOW + EVENT_RETENTION_MS + 1
    expect(await sweepExpired.handler(ctx, { now: cutoff })).toEqual({ deleted: 1 })
    expect(rows.map((r) => r.eventId)).toEqual(["evt_2"])
  })

  it("leaves a row that expires exactly now", async () => {
    // The boundary is `lt`, not `lte`: a row expiring at this instant has not
    // expired yet, and the replay window is meant to be inclusive of its last
    // millisecond.
    const { ctx, rows } = makeCtx()
    await beginEvent.handler(ctx, STRIPE)

    expect(
      await sweepExpired.handler(ctx, { now: NOW + EVENT_RETENTION_MS })
    ).toEqual({ deleted: 0 })
    expect(rows).toHaveLength(1)

    expect(
      await sweepExpired.handler(ctx, { now: NOW + EVENT_RETENTION_MS + 1 })
    ).toEqual({ deleted: 1 })
  })

  it("caps how much it removes in one pass", async () => {
    // A Convex mutation has a transaction budget. A store with a year of
    // backlog must not take the sweep down with it; the next night's run
    // continues where this one stopped.
    const { ctx, rows } = makeCtx()
    for (let i = 0; i < 5; i++) {
      await beginEvent.handler(ctx, { ...STRIPE, eventId: `evt_${i}` })
    }

    expect(
      await sweepExpired.handler(ctx, { now: NOW + EVENT_RETENTION_MS + 1, limit: 2 })
    ).toEqual({ deleted: 2 })
    expect(rows).toHaveLength(3)
  })

  it("sweeps against the wall clock when given no cutoff", async () => {
    // The cron passes {}, so the default has to be the one that works.
    const { ctx, rows } = makeCtx()
    await beginEvent.handler(ctx, STRIPE)

    vi.setSystemTime(NOW + EVENT_RETENTION_MS + 1)
    expect(await sweepExpired.handler(ctx, {})).toEqual({ deleted: 1 })
    expect(rows).toHaveLength(0)
  })
})
