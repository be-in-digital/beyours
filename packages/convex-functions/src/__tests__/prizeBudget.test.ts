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
  resolvePrizeBudget,
  strictestPrizeBudget,
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

  it("falls back to the DEFAULT on a non-finite value, never to the bounds", () => {
    // The schema types both fields as numbers and rejects a string, so `NaN`
    // and `±Infinity` are what actually survive to here. Sending a non-finite
    // `windowHours` to `minWindowHours` was a bug found by an adversarial pass:
    // the minimum window is the LOOSEST setting, so a stored `NaN` turned
    // "50 a day" into "50 an hour" — 24 times more generous than the default it
    // was meant to be falling back to. Probed at 150 prizes in 3 hours.
    expect(
      resolvePrizeBudget({
        config: { prizeBudget: { maxPrizes: Number.NaN, windowHours: Number.NaN } },
      })
    ).toEqual(DEFAULT_PRIZE_BUDGET)
    expect(
      resolvePrizeBudget({
        config: { prizeBudget: { maxPrizes: 10, windowHours: Number.POSITIVE_INFINITY } },
      })
    ).toEqual({ maxPrizes: 10, windowHours: DEFAULT_PRIZE_BUDGET.windowHours })
  })
})

describe("strictestPrizeBudget", () => {
  const tight = { config: { prizeBudget: { maxPrizes: 2, windowHours: 24 } } }
  const loose = { config: { prizeBudget: { maxPrizes: 50, windowHours: 24 } } }

  it("falls back to the default for an establishment with no active game", () => {
    expect(strictestPrizeBudget([])).toEqual(DEFAULT_PRIZE_BUDGET)
  })

  it("takes the tightest of the establishment's games, in either order", () => {
    // The ledger is per establishment but `play` takes `gameId` from the
    // caller. Reading the rule off that game let an owner who tightened the
    // wheel and left the scratch card on the default get the default: 2 prizes
    // through the tight game, then 48 more through the loose one.
    expect(strictestPrizeBudget([tight, loose])).toEqual({ maxPrizes: 2, windowHours: 24 })
    expect(strictestPrizeBudget([loose, tight])).toEqual({ maxPrizes: 2, windowHours: 24 })
  })

  it("compares as an issuance rate, so a long window can be the tighter one", () => {
    // "50 a week" is tighter than "2 an hour", and comparing `maxPrizes` alone
    // would get that backwards.
    const perWeek = { config: { prizeBudget: { maxPrizes: 50, windowHours: 168 } } }
    const perHour = { config: { prizeBudget: { maxPrizes: 2, windowHours: 1 } } }
    expect(strictestPrizeBudget([perHour, perWeek])).toEqual({
      maxPrizes: 50,
      windowHours: 168,
    })
  })

  it("breaks a tie on the smaller burst", () => {
    const a = { config: { prizeBudget: { maxPrizes: 24, windowHours: 24 } } }
    const b = { config: { prizeBudget: { maxPrizes: 1, windowHours: 1 } } }
    expect(strictestPrizeBudget([a, b])).toEqual({ maxPrizes: 1, windowHours: 1 })
  })

  it("treats an unconfigured game as the default, so it can still be the tighter", () => {
    expect(strictestPrizeBudget([{}, loose])).toEqual(DEFAULT_PRIZE_BUDGET)
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
    expect(appendPrizeIssuance([T], BUDGET, T + HOUR)).toEqual([T, T + HOUR])
  })

  it("prunes by COUNT, keeping the most recent that could still matter", () => {
    const full = [T, T + 1, T + 2]
    expect(appendPrizeIssuance(full, BUDGET, T + 3)).toEqual([T + 1, T + 2, T + 3])
  })

  it("never prunes by age, so lengthening the window still has history to count", () => {
    // Pruning by age would have thrown away exactly the entries an owner
    // widening their window needs, and quietly refunded the budget.
    const old = [T - 10 * DAY, T - 9 * DAY]
    const next = appendPrizeIssuance(old, { maxPrizes: 10, windowHours: 1 }, T)
    expect(next).toEqual([...old, T])
    expect(prizeBudgetAllows(next, { maxPrizes: 3, windowHours: 168 }, T)).toBe(true)
    expect(prizeBudgetAllows(next, { maxPrizes: 2, windowHours: 24 * 11 }, T)).toBe(false)
  })

  it("bounds the ledger by the owner's own ceiling", () => {
    let ledger: number[] = []
    for (let i = 0; i < 50; i++) ledger = appendPrizeIssuance(ledger, BUDGET, T + i)
    expect(ledger).toHaveLength(BUDGET.maxPrizes)
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
    await recordPrizeIssued(ctx, "stores:1", issuance, BUDGET, T)
    expect(store).toEqual([
      { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [T], updatedAt: T },
    ])
  })

  it("appends to the ledger it was handed, never to one it re-read", async () => {
    const { ctx, store } = fakeDb([
      { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [T] },
    ])
    const issuance = await readPrizeIssuance(ctx, "stores:1")
    await recordPrizeIssued(ctx, "stores:1", issuance, BUDGET, T + HOUR)
    expect(store[0]?.issuedAt).toEqual([T, T + HOUR])
  })

  it("admits exactly the budget inside one window and no more", async () => {
    const { ctx } = fakeDb()
    for (let i = 0; i < BUDGET.maxPrizes; i++) {
      const issuance = await readPrizeIssuance(ctx, "stores:1")
      expect(prizeBudgetAllows(issuance.issuedAt, BUDGET, T + i)).toBe(true)
      await recordPrizeIssued(ctx, "stores:1", issuance, BUDGET, T + i)
    }
    const after = await readPrizeIssuance(ctx, "stores:1")
    expect(prizeBudgetAllows(after.issuedAt, BUDGET, T + 99)).toBe(false)
    // ...and lets the establishment give again once the oldest falls out.
    expect(prizeBudgetAllows(after.issuedAt, BUDGET, T + DAY + 1)).toBe(true)
  })
})
