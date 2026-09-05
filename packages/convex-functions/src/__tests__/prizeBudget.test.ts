/**
 * The bound on what a game may give away.
 *
 * #341 bounded the RATE of the public gamification endpoints. Measured against
 * the real backend afterwards, 500 anonymous calls over 40 table codes still
 * issued 200 prizes in an hour, because nothing bounded the BUDGET. These cases
 * pin the window that does, and — just as importantly — the two places it must
 * not fire: a losing spin, and a window that has run out.
 */

import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_PRIZE_BUDGET,
  PRIZE_BUDGET_LIMITS,
  prizeBudgetKey,
  prizeBudgetRule,
  readPrizeBudget,
  recordPrizeIssued,
  resolvePrizeBudget,
} from "../prizeBudget"

const T = 1_700_000_000_000
const HOUR = 60 * 60_000

describe("resolvePrizeBudget", () => {
  it("applies the default to a game whose owner configured nothing", () => {
    // ON by default on purpose: the establishment that never opens the setting
    // is exactly the one the drain was measured against.
    expect(resolvePrizeBudget({})).toEqual(DEFAULT_PRIZE_BUDGET)
    expect(resolvePrizeBudget({ config: {} })).toEqual(DEFAULT_PRIZE_BUDGET)
  })

  it("honours what the owner set", () => {
    expect(
      resolvePrizeBudget({ config: { prizeBudget: { maxPrizes: 12, windowHours: 6 } } })
    ).toEqual({ maxPrizes: 12, windowHours: 6 })
  })

  it("clamps a value that would restore the unbounded behaviour", () => {
    expect(
      resolvePrizeBudget({ config: { prizeBudget: { maxPrizes: 1e9, windowHours: 1e9 } } })
    ).toEqual({
      maxPrizes: PRIZE_BUDGET_LIMITS.maxPrizes,
      windowHours: PRIZE_BUDGET_LIMITS.maxWindowHours,
    })
  })

  it("clamps a value that would switch the game off by accident", () => {
    expect(
      resolvePrizeBudget({ config: { prizeBudget: { maxPrizes: 0, windowHours: 0 } } })
    ).toEqual({
      maxPrizes: PRIZE_BUDGET_LIMITS.minPrizes,
      windowHours: PRIZE_BUDGET_LIMITS.minWindowHours,
    })
  })

  it("survives a malformed row rather than taking the game down", () => {
    // `games.update` takes `config: v.any()`, so a bad value can genuinely
    // reach the public play path. Clamping beats throwing there.
    expect(
      resolvePrizeBudget({
        config: { prizeBudget: { maxPrizes: Number.NaN, windowHours: -3 } },
      })
    ).toEqual({
      maxPrizes: PRIZE_BUDGET_LIMITS.minPrizes,
      windowHours: PRIZE_BUDGET_LIMITS.minWindowHours,
    })
  })
})

describe("prizeBudgetRule / prizeBudgetKey", () => {
  it("turns hours into the window the shared limiter understands", () => {
    expect(prizeBudgetRule({ maxPrizes: 7, windowHours: 3 })).toEqual({
      limit: 7,
      windowMs: 3 * HOUR,
      foldSubjectCase: false,
    })
  })

  it("never folds case, because the subject is a Convex id", () => {
    // Folding would let one establishment consume another's budget: ids are
    // case-sensitive and two stores can differ by one character's case.
    expect(prizeBudgetRule(DEFAULT_PRIZE_BUDGET).foldSubjectCase).toBe(false)
    expect(prizeBudgetKey("stores:AB")).not.toBe(prizeBudgetKey("stores:ab"))
  })

  it("keys one row per establishment", () => {
    expect(prizeBudgetKey("stores:1")).toBe("prizeBudget:stores:1")
    expect(prizeBudgetKey("stores:1")).not.toBe(prizeBudgetKey("stores:2"))
  })
})

/** A `rateLimits` table small enough to reason about. */
function fakeDb(rows: { _id: string; key: string; windowStart: number; count: number }[] = []) {
  const store = rows.map((r) => ({ ...r }))
  const db = {
    query: (_table: string) => {
      let docs = [...store]
      const chain = {
        withIndex: (_index: string, fn: (q: unknown) => unknown) => {
          const filters: Array<[string, unknown]> = []
          const q = {
            eq: (field: string, value: unknown) => {
              filters.push([field, value])
              return q
            },
          }
          fn(q)
          docs = docs.filter((d) =>
            filters.every(([f, v]) => (d as Record<string, unknown>)[f] === v)
          )
          return chain
        },
        first: async () => docs[0] ?? null,
      }
      return chain
    },
    insert: vi.fn(async (_table: string, doc: Record<string, unknown>) => {
      store.push({ _id: `rateLimits:${store.length + 1}`, ...doc } as (typeof store)[number])
    }),
    patch: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const row = store.find((r) => r._id === id)
      if (row) Object.assign(row, updates)
    }),
  }
  return { ctx: { db } as { db: unknown }, store, db }
}

const BUDGET = { maxPrizes: 3, windowHours: 24 }

describe("readPrizeBudget", () => {
  it("allows the first prize of an establishment that has never issued one", async () => {
    const { ctx } = fakeDb()
    expect(await readPrizeBudget(ctx, "stores:1", BUDGET, T)).toEqual({
      allowed: true,
      issued: 0,
      resetsAt: T + 24 * HOUR,
    })
  })

  it("allows a prize while the window has room, and reports what is spent", async () => {
    const { ctx } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 2 },
    ])
    const state = await readPrizeBudget(ctx, "stores:1", BUDGET, T + HOUR)
    expect(state.allowed).toBe(true)
    expect(state.issued).toBe(2)
  })

  it("refuses once the window is full", async () => {
    const { ctx } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 3 },
    ])
    const state = await readPrizeBudget(ctx, "stores:1", BUDGET, T + HOUR)
    expect(state.allowed).toBe(false)
    expect(state.resetsAt).toBe(T + 24 * HOUR)
  })

  it("allows again once the window has run out", async () => {
    const { ctx } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 3 },
    ])
    const state = await readPrizeBudget(ctx, "stores:1", BUDGET, T + 24 * HOUR)
    expect(state.allowed).toBe(true)
    // The spent window is behind us: nothing of it is carried forward.
    expect(state.issued).toBe(0)
  })

  it("reads without consuming, so a losing spin costs nothing", async () => {
    const { ctx, db } = fakeDb()
    await readPrizeBudget(ctx, "stores:1", BUDGET, T)
    await readPrizeBudget(ctx, "stores:1", BUDGET, T)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.patch).not.toHaveBeenCalled()
  })

  it("keeps one establishment's budget out of another's", async () => {
    const { ctx } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 3 },
    ])
    expect((await readPrizeBudget(ctx, "stores:2", BUDGET, T)).allowed).toBe(true)
  })
})

describe("recordPrizeIssued", () => {
  it("opens a window on the first prize", async () => {
    const { ctx, store } = fakeDb()
    await recordPrizeIssued(ctx, "stores:1", BUDGET, T)
    expect(store).toEqual([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 1 },
    ])
  })

  it("counts up inside the window without moving its start", async () => {
    const { ctx, store } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 1 },
    ])
    await recordPrizeIssued(ctx, "stores:1", BUDGET, T + HOUR)
    expect(store[0]).toMatchObject({ windowStart: T, count: 2 })
  })

  it("starts a fresh window once the old one has run out", async () => {
    const { ctx, store } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 3 },
    ])
    await recordPrizeIssued(ctx, "stores:1", BUDGET, T + 24 * HOUR)
    expect(store[0]).toMatchObject({ windowStart: T + 24 * HOUR, count: 1 })
  })

  it("never throws, and keeps the row truthful, when called past the limit", async () => {
    // By the time this runs the prize has left the stock. Dropping the count to
    // protect the invariant would understate what the restaurant gave away.
    const { ctx, store } = fakeDb([
      { _id: "rateLimits:1", key: prizeBudgetKey("stores:1"), windowStart: T, count: 3 },
    ])
    await expect(recordPrizeIssued(ctx, "stores:1", BUDGET, T + HOUR)).resolves.toBeUndefined()
    expect(store[0]).toMatchObject({ windowStart: T, count: 4 })
  })

  it("counts a run of prizes up to the limit and no further in the same window", async () => {
    const { ctx } = fakeDb()
    for (let i = 0; i < BUDGET.maxPrizes; i++) {
      expect((await readPrizeBudget(ctx, "stores:1", BUDGET, T + i)).allowed).toBe(true)
      await recordPrizeIssued(ctx, "stores:1", BUDGET, T + i)
    }
    expect((await readPrizeBudget(ctx, "stores:1", BUDGET, T + 99)).allowed).toBe(false)
  })
})
