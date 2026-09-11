import { describe, expect, it } from "vitest"

import { TRANSLATION_JOB_PAGE, listJobs } from "../autoTranslate"

/**
 * What a catalogue back-fill actually did, readable by somebody.
 *
 * WHAT WAS BROKEN (#95). `translateCatalogue` writes a `translationJobs` row,
 * and the batch keeps it up to date: `completedItems`, `status`, and the
 * `error` when the daily quota stops a run. Nothing read any of it:
 *
 *     $ grep -rn 'query("translationJobs")' packages apps
 *     (no output)
 *
 * So a run that stopped on the quota looked exactly like one that finished. The
 * owner adds German, the toast says « Traduction du catalogue lancée : 300
 * éléments », the run stops at 80, and the first evidence anybody gets is a
 * German storefront with French dish names on it.
 *
 * `languages-page.tsx` said so in its own comment — *"The row is not the
 * missing half: a query over `by_storeId` and somewhere on this page to render
 * it is"*.
 */

const NOW = 1_700_000_000_000

type Job = Record<string, unknown>

function ctxWith(rows: Job[]) {
  return {
    db: {
      query: () => ({
        withIndex: () => ({
          take: async (n: number) => rows.slice(0, n),
        }),
      }),
    },
  }
}

function job(over: Job = {}): Job {
  return {
    _id: "job_1",
    storeId: "store_1",
    targetLanguage: "de",
    entityType: "products",
    status: "completed",
    totalItems: 300,
    completedItems: 300,
    updatedAt: NOW,
    ...over,
  }
}

const list = (rows: Job[], limit?: number) =>
  listJobs.handler(ctxWith(rows), { storeId: "store_1", ...(limit ? { limit } : {}) })

describe("listJobs", () => {
  it("reports what the run completed, not just that it ran", async () => {
    const found = await list([job({ completedItems: 80, status: "failed" })])
    expect(found).toEqual([
      {
        _id: "job_1",
        targetLanguage: "de",
        entityType: "products",
        status: "failed",
        totalItems: 300,
        completedItems: 80,
        updatedAt: NOW,
      },
    ])
  })

  it("carries the reason a run stopped", async () => {
    // The whole point. Without it, 80 of 300 is a number with no explanation
    // and the owner cannot tell a quota from a crash.
    const found = await list([
      job({
        status: "failed",
        completedItems: 80,
        error: "Daily translation quota reached — resumes after the next reset",
      }),
    ])
    expect(found[0]!.error).toMatch(/quota/)
  })

  it("omits `error` entirely when there is none", async () => {
    // Rather than an empty string, which a screen would render as a blank red
    // line under a run that succeeded.
    const found = await list([job()])
    expect(found[0]).not.toHaveProperty("error")
  })

  it("puts the most recent run first", async () => {
    // The screen shows a window, so the order decides what an owner sees at
    // all. `by_storeId` is not an index on time.
    const found = await list([
      job({ _id: "old", updatedAt: NOW - 86_400_000 }),
      job({ _id: "new", updatedAt: NOW }),
      job({ _id: "mid", updatedAt: NOW - 3_600_000 }),
    ])
    expect(found.map((row) => row._id)).toEqual(["new", "mid", "old"])
  })

  it("defaults to a window rather than the whole history", async () => {
    // An establishment adding languages for two years must not turn opening a
    // screen into a table walk.
    const rows = Array.from({ length: 60 }, (_, i) =>
      job({ _id: `job_${i}`, updatedAt: NOW - i })
    )
    expect(await list(rows)).toHaveLength(TRANSLATION_JOB_PAGE)
  })

  it("clamps a caller's limit at both ends", async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      job({ _id: `job_${i}`, updatedAt: NOW - i })
    )
    expect(await list(rows, 3)).toHaveLength(3)
    expect(await list(rows, 9_999)).toHaveLength(50)
    expect(await list(rows, 0)).toHaveLength(TRANSLATION_JOB_PAGE)
  })

  it("survives a row written before the fields it reads existed", async () => {
    // `completedItems` and `updatedAt` are both optional in the schema, and a
    // screen rendering `undefined / undefined` is worse than one rendering 0.
    const found = await list([
      { _id: "old", storeId: "store_1", targetLanguage: "de", entityType: "menus", status: "pending", createdAt: NOW },
    ])
    expect(found[0]).toMatchObject({ totalItems: 0, completedItems: 0, updatedAt: NOW })
  })

  it("returns nothing for a store that has never run one", async () => {
    expect(await list([])).toEqual([])
  })
})
