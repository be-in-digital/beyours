import { describe, it, expect, vi } from "vitest"
import {
  claimForPrint,
  getByStore,
  getPrintQueue,
  getPrintStuckCount,
  isClaimExpired,
  isRetryable,
  markPrintFailed,
  markPrintSent,
  purgeExpiredTickets,
  requestReprint,
  MAX_PRINT_ATTEMPTS,
  PRINT_CLAIM_TTL_MS,
  PRINT_RETRY_DELAY_MS,
  TICKET_RETENTION_DAYS,
} from "../kitchenTickets"

/**
 * The print queue's three unkept promises, and the retention that has to exist
 * for the bounded reads to mean anything.
 *
 * Every case here is one of #164's sub-points, and each was reproduced before
 * it was fixed:
 *  - two tablets both took `printQueue[0]` and both printed the slip, because
 *    nothing claimed the ticket until `onafterprint` fired 1–20s later;
 *  - `printAttempts` was incremented on every failure and read by nobody, so a
 *    slip that failed once never came back;
 *  - and nothing ever deleted a finished ticket, so bounding the KDS reads on
 *    its own would only have moved the failure.
 */

const NOW = 1_700_000_000_000

type Ticket = Record<string, any>

/**
 * A fake `ctx.db` that indexes on the fields the print queue actually filters
 * on, because a fake that returns everything makes `getPrintQueue` look correct
 * whatever it asks for.
 */
function createDb(tickets: Record<string, Ticket>) {
  const store: Record<string, Ticket> = { ...tickets }

  /**
   * `.order()` is honoured, because ignoring it is how the truncation bug got
   * through: a fake that always sorted ascending agreed with the doc comment
   * while production took `.order("desc").take(n)` and kept the opposite end.
   */
  const chainFor = (rows: Ticket[], sortField: string) => {
    let direction: "asc" | "desc" = "asc"
    const sorted = () => {
      const copy = [...rows].sort(
        (a, b) => (a[sortField] ?? 0) - (b[sortField] ?? 0)
      )
      return direction === "asc" ? copy : copy.reverse()
    }
    const chain: any = {
      order: (dir: "asc" | "desc") => {
        direction = dir
        return chain
      },
      take: async (n: number) => sorted().slice(0, n),
      collect: async () => sorted(),
      first: async () => sorted()[0] ?? null,
    }
    return chain
  }

  return {
    store,
    get: vi.fn(async (id: string) => store[id] ?? null),
    delete: vi.fn(async (id: string) => {
      delete store[id]
    }),
    patch: vi.fn(async (id: string, updates: Ticket) => {
      if (store[id]) Object.assign(store[id], updates)
    }),
    query: vi.fn(() => ({
      withIndex: (index: string, build: (q: any) => any) => {
        const equalities: Record<string, unknown> = {}
        const bounds: Array<(row: Ticket) => boolean> = []
        const q: any = {
          eq: (field: string, value: unknown) => {
            equalities[field] = value
            return q
          },
          lt: (field: string, value: any) => {
            bounds.push((row) => row[field] < value)
            return q
          },
        }
        build(q)

        const rows = Object.values(store)
          .filter((row) =>
            Object.entries(equalities).every(([f, val]) => row[f] === val)
          )
          .filter((row) => bounds.every((pass) => pass(row)))

        // Order on the index's own trailing field, as Convex does — the whole
        // point of `by_store_printStatus_printFailedAt` is that a fresh failure
        // is not crowded out by an old backlog.
        const trailing = index.endsWith("printFailedAt")
          ? "printFailedAt"
          : index.endsWith("printRequestedAt")
            ? "printRequestedAt"
            : "createdAt"

        return chainFor(rows, trailing)
      },
    })),
  }
}

function ticket(overrides: Ticket = {}): Ticket {
  return {
    _id: overrides._id ?? "kitchenTickets:1",
    storeId: "stores:1",
    status: "pending",
    printStatus: "pending",
    printAttempts: 0,
    printRequestedAt: NOW,
    createdAt: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// The rules, on their own
// ---------------------------------------------------------------------------

describe("isRetryable", () => {
  it("waits out the retry delay before offering a failed slip again", () => {
    const failed = ticket({ printStatus: "failed", printFailedAt: NOW })
    expect(isRetryable(failed, NOW + PRINT_RETRY_DELAY_MS - 1)).toBe(false)
    expect(isRetryable(failed, NOW + PRINT_RETRY_DELAY_MS)).toBe(true)
  })

  it("stops after the attempt ceiling, so a printer that is off does not spin", () => {
    const exhausted = ticket({
      printStatus: "failed",
      printFailedAt: NOW,
      printAttempts: MAX_PRINT_ATTEMPTS,
    })
    expect(isRetryable(exhausted, NOW + PRINT_RETRY_DELAY_MS * 10)).toBe(false)
  })

  it("never retries a ticket the kitchen has finished with", () => {
    for (const status of ["completed", "cancelled"]) {
      const done = ticket({ status, printStatus: "failed", printFailedAt: NOW })
      expect(isRetryable(done, NOW + PRINT_RETRY_DELAY_MS)).toBe(false)
    }
  })
})

describe("isClaimExpired", () => {
  it("holds the claim for its full window, then releases it", () => {
    const claimed = ticket({ printStatus: "printing", printClaimedAt: NOW })
    expect(isClaimExpired(claimed, NOW + PRINT_CLAIM_TTL_MS - 1)).toBe(false)
    expect(isClaimExpired(claimed, NOW + PRINT_CLAIM_TTL_MS)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// #164.2 — two tablets, one slip
// ---------------------------------------------------------------------------

describe("claimForPrint", () => {
  it("is won by exactly one of two tablets watching the same queue", async () => {
    const db = createDb({ "kitchenTickets:1": ticket() })
    const ctx = { db }

    const first = await claimForPrint.handler(ctx, { id: "kitchenTickets:1" })
    const second = await claimForPrint.handler(ctx, { id: "kitchenTickets:1" })

    // The winner gets a claim id; the loser gets nothing.
    expect(typeof first).toBe("string")
    expect(second).toBeNull()
    expect(db.store["kitchenTickets:1"]!.printStatus).toBe("printing")
  })

  it("lets another tablet take a ticket whose holder never came back", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "printing",
        printClaimedAt: NOW - PRINT_CLAIM_TTL_MS - 1,
      }),
    })

    expect(await claimForPrint.handler({ db }, { id: "kitchenTickets:1" })).toEqual(
      expect.any(String)
    )
  })

  it("refuses a ticket somebody is printing right now", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "printing",
        printClaimedAt: Date.now(),
      }),
    })

    expect(await claimForPrint.handler({ db }, { id: "kitchenTickets:1" })).toBeNull()
  })

  it("refuses a ticket that is already printed", async () => {
    const db = createDb({ "kitchenTickets:1": ticket({ printStatus: "printed" }) })
    expect(await claimForPrint.handler({ db }, { id: "kitchenTickets:1" })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// #164.3 — a failed print comes back
// ---------------------------------------------------------------------------

describe("getPrintQueue", () => {
  it("offers a failed slip again once its delay has passed", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        _id: "kitchenTickets:1",
        printStatus: "failed",
        printAttempts: 1,
        printFailedAt: Date.now() - PRINT_RETRY_DELAY_MS - 1_000,
      }),
    })

    const queue = await getPrintQueue.handler({ db }, { storeId: "stores:1" })
    expect(queue.map((t: Ticket) => t._id)).toEqual(["kitchenTickets:1"])
  })

  it("leaves an exhausted slip out of the automatic loop", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "failed",
        printAttempts: MAX_PRINT_ATTEMPTS,
        printFailedAt: Date.now() - PRINT_RETRY_DELAY_MS - 1_000,
      }),
    })

    expect(await getPrintQueue.handler({ db }, { storeId: "stores:1" })).toEqual([])
  })

  it("does not offer a ticket another tablet is printing", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "printing",
        printClaimedAt: Date.now(),
      }),
    })

    expect(await getPrintQueue.handler({ db }, { storeId: "stores:1" })).toEqual([])
  })

  it("reclaims a ticket stranded by a tablet that went away", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "printing",
        printClaimedAt: Date.now() - PRINT_CLAIM_TTL_MS - 1_000,
      }),
    })

    expect(
      (await getPrintQueue.handler({ db }, { storeId: "stores:1" })).length
    ).toBe(1)
  })
})

describe("the claim is released whichever way the print ends", () => {
  it("clears it on success", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({ printStatus: "printing", printClaimedAt: NOW }),
    })
    await markPrintSent.handler({ db }, { id: "kitchenTickets:1" })

    expect(db.store["kitchenTickets:1"]!.printStatus).toBe("printed")
    expect(db.store["kitchenTickets:1"]!.printClaimedAt).toBeUndefined()
  })

  it("clears it on failure, so the retry is a fresh race", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({ printStatus: "printing", printClaimedAt: NOW }),
    })
    await markPrintFailed.handler({ db }, { id: "kitchenTickets:1", reason: "timeout" })

    expect(db.store["kitchenTickets:1"]!.printStatus).toBe("failed")
    expect(db.store["kitchenTickets:1"]!.printClaimedAt).toBeUndefined()
  })

  it("starts the attempt count over when a person asks for the slip again", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        printStatus: "failed",
        printAttempts: MAX_PRINT_ATTEMPTS,
        printFailedAt: NOW,
      }),
    })
    await requestReprint.handler({ db }, { id: "kitchenTickets:1" })

    const after = db.store["kitchenTickets:1"]!
    expect(after.printStatus).toBe("pending")
    expect(after.printAttempts).toBe(0)
    expect(after.printFailedAt).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// #137 — retention, without which the bounded reads only move the failure
// ---------------------------------------------------------------------------

describe("purgeExpiredTickets", () => {
  const OLD = Date.now() - (TICKET_RETENTION_DAYS + 1) * 86_400_000
  const RECENT = Date.now() - 86_400_000

  it("deletes finished tickets past the window and keeps the recent ones", async () => {
    const db = createDb({
      "kitchenTickets:old": ticket({
        _id: "kitchenTickets:old",
        status: "completed",
        createdAt: OLD,
      }),
      "kitchenTickets:recent": ticket({
        _id: "kitchenTickets:recent",
        status: "completed",
        createdAt: RECENT,
      }),
    })

    const result = await purgeExpiredTickets.handler({ db }, {})

    expect(result.deleted).toBe(1)
    expect(db.store["kitchenTickets:old"]).toBeUndefined()
    expect(db.store["kitchenTickets:recent"]).toBeDefined()
  })

  it("never sweeps a ticket still on the pass, however old", async () => {
    const db = createDb({
      "kitchenTickets:stale": ticket({
        _id: "kitchenTickets:stale",
        status: "in_progress",
        createdAt: OLD,
      }),
    })

    const result = await purgeExpiredTickets.handler({ db }, {})

    expect(result.deleted).toBe(0)
    expect(db.store["kitchenTickets:stale"]).toBeDefined()
  })

  it("sweeps cancelled tickets too", async () => {
    const db = createDb({
      "kitchenTickets:x": ticket({
        _id: "kitchenTickets:x",
        status: "cancelled",
        createdAt: OLD,
      }),
    })

    expect((await purgeExpiredTickets.handler({ db }, {})).deleted).toBe(1)
  })

  it("works in batches and says when there is more to do", async () => {
    const many: Record<string, Ticket> = {}
    for (let i = 0; i < 5; i++) {
      many[`kitchenTickets:${i}`] = ticket({
        _id: `kitchenTickets:${i}`,
        status: "completed",
        createdAt: OLD + i,
      })
    }
    const db = createDb(many)

    const first = await purgeExpiredTickets.handler({ db }, { limit: 2 })
    expect(first).toEqual({ deleted: 2, hasMore: true })

    const rest = await purgeExpiredTickets.handler({ db }, { limit: 50 })
    expect(rest.deleted).toBe(3)
    expect(rest.hasMore).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The alarm must still see what the claim lock hides
// ---------------------------------------------------------------------------

describe("getPrintStuckCount", () => {
  it("counts a slip a tablet took and never finished", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        status: "pending",
        printStatus: "printing",
        printClaimedAt: Date.now() - PRINT_CLAIM_TTL_MS - 1_000,
        printRequestedAt: Date.now() - 120_000,
      }),
    })

    // Before the claim lock this ticket sat at "pending" and the alarm saw it.
    // It must not become invisible by moving to "printing".
    expect(await getPrintStuckCount.handler({ db }, { storeId: "stores:1" })).toBe(1)
  })

  it("stays quiet while a tablet is actually printing", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        status: "pending",
        printStatus: "printing",
        printClaimedAt: Date.now(),
        printRequestedAt: Date.now(),
      }),
    })

    expect(await getPrintStuckCount.handler({ db }, { storeId: "stores:1" })).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Found by adversarial verification, after the first fix looked complete
// ---------------------------------------------------------------------------

describe("what the pass keeps when there are more tickets than the bound", () => {
  it("keeps the OLDEST active tickets, which are the ones people are waiting for", async () => {
    const many: Record<string, Ticket> = {}
    for (let i = 0; i < 250; i++) {
      many[`kitchenTickets:${i}`] = ticket({
        _id: `kitchenTickets:${i}`,
        status: "pending",
        printStatus: "not_required",
        createdAt: NOW + i * 1_000,
      })
    }

    const live = await getByStore.handler({ db: createDb(many) }, { storeId: "stores:1" })

    // Truncating to the NEWEST 200 drops the orders that have waited longest —
    // they vanish from the kitchen screen entirely and are never cooked.
    expect(live[0]!._id).toBe("kitchenTickets:0")
  })
})

describe("a cancelled order", () => {
  it("does not keep a slip in the print queue", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({ status: "cancelled", printStatus: "pending" }),
    })

    expect(await getPrintQueue.handler({ db }, { storeId: "stores:1" })).toEqual([])
  })

  it("cannot be claimed for printing", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({ status: "cancelled", printStatus: "pending" }),
    })

    expect(await claimForPrint.handler({ db }, { id: "kitchenTickets:1" })).toBeNull()
  })
})

describe("a slip that has exhausted its retries", () => {
  it("keeps counting toward the alarm, as the retry ceiling promises", async () => {
    const db = createDb({
      "kitchenTickets:1": ticket({
        status: "pending",
        printStatus: "failed",
        printAttempts: MAX_PRINT_ATTEMPTS,
        // Well outside the ten-minute recent-failure window.
        printFailedAt: Date.now() - 20 * 60_000,
      }),
    })

    // It will never print again on its own. Dropping it from the count means
    // nobody is told the order has no slip.
    expect(await getPrintStuckCount.handler({ db }, { storeId: "stores:1" })).toBe(1)
  })
})

describe("a late tablet", () => {
  it("cannot report success on a slip another tablet has since taken", async () => {
    const db = createDb({ "kitchenTickets:1": ticket() })
    const ctx = { db }

    // Tablet A takes it.
    const claimA = await claimForPrint.handler(ctx, { id: "kitchenTickets:1" })
    expect(claimA).toBeTruthy()

    // A's claim goes stale and tablet B takes it.
    db.store["kitchenTickets:1"]!.printClaimedAt = Date.now() - PRINT_CLAIM_TTL_MS - 1
    const claimB = await claimForPrint.handler(ctx, { id: "kitchenTickets:1" })
    expect(claimB).toBeTruthy()

    // A's print dialog finally returns. It must not close a slip B is printing.
    await markPrintSent.handler(ctx, {
      id: "kitchenTickets:1",
      claimId: claimA as string,
    })

    expect(db.store["kitchenTickets:1"]!.printStatus).toBe("printing")
  })
})
