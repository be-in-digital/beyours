/**
 * The bound on what a game may give away.
 *
 * #341 bounded the RATE of the public gamification endpoints. Measured against
 * the real backend afterwards, 500 anonymous calls over 40 table codes still
 * issued 200 prizes in an hour, because nothing bounded the BUDGET.
 *
 * The first version of this counted into a `rateLimits` row and inherited that
 * table's FIXED window. An adversarial pass broke it three ways — a budget
 * spendable twice across a boundary, a second game with a shorter window
 * resetting the first, and an owner refunding the budget by tightening the
 * setting. The cases below pin the rolling ledger that replaced it, and each of
 * those three defects has a test named after it.
 */

import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_PRIZE_BUDGET,
  PRIZE_BUDGET_LIMITS,
  appendPrizeIssuance,
  prizeBudgetAllows,
  readPrizeIssuance,
  recordPrizeIssued,
  prizeBudgetAllowsAll,
  resolvePrizeBudget,
} from "../prizeBudget"

const T = 1_700_000_000_000
const HOUR = 60 * 60_000
const DAY = 24 * HOUR

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

  it("discards the WHOLE record when either field is non-finite", () => {
    // The schema types both fields as numbers and rejects a string, so `NaN`
    // and `±Infinity` are what actually survive to here. Falling back per field
    // looked tidier and landed looser than the default in both directions:
    // `{1000, NaN}` resolved to 1000 a day (20x the default rate) and
    // `{NaN, 1}` to 50 an hour — the exact number the round before had just
    // finished fixing. A record with a corrupt half is not half trustworthy.
    for (const prizeBudget of [
      { maxPrizes: Number.NaN, windowHours: Number.NaN },
      { maxPrizes: 1000, windowHours: Number.NaN },
      { maxPrizes: Number.NaN, windowHours: 1 },
      { maxPrizes: 10, windowHours: Number.POSITIVE_INFINITY },
      { maxPrizes: Number.NEGATIVE_INFINITY, windowHours: 24 },
    ]) {
      expect(resolvePrizeBudget({ config: { prizeBudget } })).toEqual(DEFAULT_PRIZE_BUDGET)
    }
  })
})

describe("prizeBudgetAllowsAll", () => {
  const tight = { config: { prizeBudget: { maxPrizes: 2, windowHours: 24 } } }
  const loose = { config: { prizeBudget: { maxPrizes: 50, windowHours: 24 } } }

  it("applies the default to an establishment with no active game", () => {
    const spent = Array.from({ length: DEFAULT_PRIZE_BUDGET.maxPrizes }, (_, i) => T + i)
    expect(prizeBudgetAllowsAll([], [], T)).toBe(true)
    expect(prizeBudgetAllowsAll([], spent, T + 1)).toBe(false)
  })

  it("lets the tightest game refuse, whichever game the caller named", () => {
    // The ledger is per establishment but `play` takes `gameId` from the
    // caller. Reading the rule off that game let an owner who tightened the
    // wheel and left the scratch card on the default get the default: 2 prizes
    // through the tight game, then 48 more through the loose one.
    expect(prizeBudgetAllowsAll([tight, loose], [T, T + 1], T + 2)).toBe(false)
    expect(prizeBudgetAllowsAll([loose, tight], [T, T + 1], T + 2)).toBe(false)
    expect(prizeBudgetAllowsAll([tight, loose], [T], T + 1)).toBe(true)
  })

  it("never lets a long-window game license a burst a short-window one forbids", () => {
    // The defect this replaced. Picking ONE budget by issuance rate made
    // `100 per week` (0.6/h) look tighter than `1 per hour` (1/h), and then
    // permitted a burst of 100 inside the hour the other forbids: measured at
    // 100 prizes in one hour against a game set to 1. "Tightest governs" is the
    // intersection of the constraints, not a budget you can pick.
    const perHour = { config: { prizeBudget: { maxPrizes: 1, windowHours: 1 } } }
    const perWeek = { config: { prizeBudget: { maxPrizes: 100, windowHours: 168 } } }
    expect(prizeBudgetAllowsAll([perHour, perWeek], [T], T + 1)).toBe(false)
    // ...and once the hour has passed, the weekly one is what still binds.
    expect(prizeBudgetAllowsAll([perHour, perWeek], [T], T + 2 * HOUR)).toBe(true)
  })

  it("counts an unconfigured game as the default, so it can be the one that refuses", () => {
    const spent = Array.from({ length: DEFAULT_PRIZE_BUDGET.maxPrizes }, (_, i) => T + i)
    const generous = { config: { prizeBudget: { maxPrizes: 1000, windowHours: 24 } } }
    expect(prizeBudgetAllowsAll([{}, generous], spent, T + 1)).toBe(false)
  })
})

const BUDGET = { maxPrizes: 3, windowHours: 24 }

describe("prizeBudgetAllows", () => {
  it("allows an establishment that has never issued a prize", () => {
    expect(prizeBudgetAllows([], BUDGET, T)).toBe(true)
  })

  it("allows while the window has room and refuses once it is full", () => {
    expect(prizeBudgetAllows([T, T + 1], BUDGET, T + HOUR)).toBe(true)
    expect(prizeBudgetAllows([T, T + 1, T + 2], BUDGET, T + HOUR)).toBe(false)
  })

  it("counts a genuinely ROLLING window, not one anchored to the first prize", () => {
    // The defect this replaced: with a fixed window, one prize at T followed by
    // 49 just before it expired and 50 more just after paid out 100 against a
    // "50 per rolling 24 h" budget, in two minutes. Here the oldest prize
    // simply falls out of view as time passes, one at a time.
    const issued = [T, T + HOUR, T + 2 * HOUR]
    expect(prizeBudgetAllows(issued, BUDGET, T + 23 * HOUR)).toBe(false)
    expect(prizeBudgetAllows(issued, BUDGET, T + DAY + 1)).toBe(true)
    // ...and only by one: the other two are still inside the window.
    expect(prizeBudgetAllows([...issued, T + DAY + 2], BUDGET, T + DAY + 3)).toBe(false)
  })

  it("answers for the window in force right now, not the one that was in force", () => {
    // An owner tightening from 50/24 h to 50/1 h used to refund the budget,
    // because the stored window looked stale under the new rule. Nothing is
    // stored about the window here, so the change simply applies.
    const issued = [T, T + 1, T + 2]
    expect(prizeBudgetAllows(issued, { maxPrizes: 3, windowHours: 24 }, T + 2 * HOUR)).toBe(
      false
    )
    expect(prizeBudgetAllows(issued, { maxPrizes: 3, windowHours: 1 }, T + 2 * HOUR)).toBe(true)
  })

  it("treats the cutoff itself as out of the window", () => {
    expect(prizeBudgetAllows([T, T, T], BUDGET, T + DAY)).toBe(true)
  })
})

describe("appendPrizeIssuance", () => {
  it("records the prize and keeps the ledger ordered", () => {
    expect(appendPrizeIssuance([T], T + HOUR)).toEqual([T, T + HOUR])
  })

  it("never prunes by the budget in force, however far the owner tightens it", () => {
    // The defect this replaced, and it was the ORIGINAL defect returning by
    // another route. Pruning to `budget.maxPrizes` is enough while that number
    // only grows; the moment an owner shrinks it, one write destroys the
    // history a later, wider budget needs. Measured: 50 issued on 50-a-day,
    // owner types the stricter-looking "1 per hour", one play truncates the
    // ledger to a single entry, and reverting to 50-a-day issues 49 more inside
    // the same 24 hours. 100 against a fifty-prize ceiling, by an owner
    // tightening their own setting.
    let ledger = Array.from({ length: 50 }, (_, i) => T + i)
    ledger = appendPrizeIssuance(ledger, T + HOUR)
    expect(ledger).toHaveLength(51)
    expect(prizeBudgetAllows(ledger, { maxPrizes: 50, windowHours: 24 }, T + HOUR)).toBe(false)
  })

  it("keeps history a widened window still needs", () => {
    const old = [T - 3 * DAY, T - 2 * DAY]
    const next = appendPrizeIssuance(old, T)
    expect(next).toEqual([...old, T])
    expect(prizeBudgetAllows(next, { maxPrizes: 3, windowHours: 1 }, T)).toBe(true)
    expect(prizeBudgetAllows(next, { maxPrizes: 3, windowHours: 168 }, T)).toBe(false)
  })

  it("bounds the ledger by the LIMITS, which no configuration can move", () => {
    let ledger: number[] = []
    for (let i = 0; i < PRIZE_BUDGET_LIMITS.maxPrizes + 25; i++) {
      ledger = appendPrizeIssuance(ledger, T + i)
    }
    expect(ledger).toHaveLength(PRIZE_BUDGET_LIMITS.maxPrizes)
  })

  it("drops what no configurable window could ever count again", () => {
    const ancient = T - (PRIZE_BUDGET_LIMITS.maxWindowHours + 1) * HOUR
    expect(appendPrizeIssuance([ancient], T)).toEqual([T])
  })
})

/** A `prizeIssuance` table small enough to reason about. */
function fakeDb(rows: { _id: string; storeId: string; issuedAt: number[] }[] = []) {
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
      store.push({ _id: `prizeIssuance:${store.length + 1}`, ...doc } as (typeof store)[number])
    }),
    patch: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const row = store.find((r) => r._id === id)
      if (row) Object.assign(row, updates)
    }),
  }
  return { ctx: { db } as { db: unknown }, store, db }
}

describe("readPrizeIssuance", () => {
  it("reports an empty ledger for an establishment that has issued nothing", async () => {
    const { ctx } = fakeDb()
    expect(await readPrizeIssuance(ctx, "stores:1")).toEqual({ id: null, issuedAt: [] })
  })

  it("reads without writing, so a losing spin costs nothing", async () => {
    const { ctx, db } = fakeDb()
    await readPrizeIssuance(ctx, "stores:1")
    await readPrizeIssuance(ctx, "stores:1")
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.patch).not.toHaveBeenCalled()
  })

  it("keeps one establishment's ledger out of another's", async () => {
    const { ctx } = fakeDb([{ _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [T] }])
    expect((await readPrizeIssuance(ctx, "stores:2")).issuedAt).toEqual([])
    expect((await readPrizeIssuance(ctx, "stores:1")).issuedAt).toEqual([T])
  })
})

describe("recordPrizeIssued", () => {
  it("opens a ledger on the first prize", async () => {
    const { ctx, store } = fakeDb()
    const issuance = await readPrizeIssuance(ctx, "stores:1")
    await recordPrizeIssued(ctx, "stores:1", issuance, T)
    expect(store).toEqual([
      { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [T], updatedAt: T },
    ])
  })

  it("appends to the ledger it was handed, never to one it re-read", async () => {
    const { ctx, store } = fakeDb([
      { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [T] },
    ])
    const issuance = await readPrizeIssuance(ctx, "stores:1")
    await recordPrizeIssued(ctx, "stores:1", issuance, T + HOUR)
    expect(store[0]?.issuedAt).toEqual([T, T + HOUR])
  })

  it("admits exactly the budget inside one window and no more", async () => {
    const { ctx } = fakeDb()
    for (let i = 0; i < BUDGET.maxPrizes; i++) {
      const issuance = await readPrizeIssuance(ctx, "stores:1")
      expect(prizeBudgetAllows(issuance.issuedAt, BUDGET, T + i)).toBe(true)
      await recordPrizeIssued(ctx, "stores:1", issuance, T + i)
    }
    const after = await readPrizeIssuance(ctx, "stores:1")
    expect(prizeBudgetAllows(after.issuedAt, BUDGET, T + 99)).toBe(false)
    // ...and lets the establishment give again once the oldest falls out.
    expect(prizeBudgetAllows(after.issuedAt, BUDGET, T + DAY + 1)).toBe(true)
  })
})
