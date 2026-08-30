/**
 * Subscribing, and what the confirmation link is worth.
 *
 * Two defects met on this path, and they are the same mistake told twice: the
 * double opt-in token was treated as a formality rather than as the consent
 * record it is.
 *
 * `subscribe` minted it from `Math.random()`. `importBatch` did not mint it at
 * all — it took the token from whoever was doing the importing, which lets that
 * side pre-compute the link that marks their own purchased list as having
 * opted in. Under a double opt-in scheme that is the one thing the mechanism
 * exists to prevent.
 *
 * The same `importBatch` validator is why P0-17 failed 100% of the time: it
 * required per-row fields and a top-level `consentSource` the only caller never
 * sent, so every CSV import died on argument validation before reading a row.
 */

import { beforeEach, describe, expect, it } from "vitest"
import { create, importBatch } from "../emailSubscribers"

/** The parts of a Convex ctx these two handlers touch. */
/**
 * A ctx that knows which table a row was written to.
 *
 * It used to keep one undifferentiated list, which was fine until `create`
 * started consuming a rate limit: the limiter's own row landed first and every
 * assertion about "the subscriber" was reading it instead.
 */
function fakeCtx(existingEmails: string[] = []) {
  const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
  return {
    inserted,
    rows: (table: string) =>
      inserted.filter((r) => r.table === table).map((r) => r.doc),
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        inserted.push({ table, doc })
        return `row_${inserted.length}`
      },
      patch: async () => undefined,
      query: (table: string) => ({
        withIndex: (_name: string, fn: (q: unknown) => unknown) => {
          let captured = ""
          const q = {
            eq: (field: string, value: unknown) => {
              if (field === "email") captured = String(value)
              return q
            },
          }
          fn(q)
          return {
            first: async () => {
              // No counter exists in these fixtures, so every call opens a
              // fresh window and the limiter never interferes.
              if (table === "rateLimits") return null
              return existingEmails.includes(captured) ? { _id: "existing" } : null
            },
          }
        },
      }),
    },
  }
}

const STORE = "stores:a"

/** Convex ids are opaque; the tests only care about the token fields. */
const rows = (ctx: ReturnType<typeof fakeCtx>) =>
  ctx.rows("emailSubscribers") as Array<Record<string, string | number | undefined>>

describe("create", () => {
  it("mints a confirmation token that is not guessable", async () => {
    const ctx = fakeCtx()
    await create.handler(ctx, {
      storeId: STORE,
      email: "Yanis@Resto.example",
      source: "website",
    })

    const token = String(rows(ctx)[0]?.doubleOptInToken)
    // `crypto.randomUUID()`, not 32 bytes of `Math.random()`. The shape is the
    // observable difference: a v4 UUID, with its version and variant nibbles.
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it("gives the token 48 hours and lowercases the address", async () => {
    const ctx = fakeCtx()
    const before = Date.now()
    await create.handler(ctx, {
      storeId: STORE,
      email: "Yanis@Resto.example",
      source: "website",
    })

    const row = rows(ctx)[0]
    expect(row?.email).toBe("yanis@resto.example")
    expect(Number(row?.doubleOptInExpiresAt) - before).toBeGreaterThan(47 * 3600_000)
    expect(Number(row?.doubleOptInExpiresAt) - before).toBeLessThan(49 * 3600_000)
  })

  it("skips confirmation for an address the owner added by hand", async () => {
    const ctx = fakeCtx()
    await create.handler(ctx, {
      storeId: STORE,
      email: "yanis@resto.example",
      source: "manual",
    })
    const row = rows(ctx)[0]
    expect(row?.status).toBe("active")
    expect(row?.doubleOptInToken).toBeUndefined()
  })
})

describe("importBatch", () => {
  const csvRow = { email: "yanis@resto.example", firstName: "Yanis" }

  it("accepts exactly what the CSV dialog can produce", () => {
    // P0-17: the validator demanded `doubleOptInToken` and
    // `doubleOptInExpiresAt` per row plus a top-level `consentSource`, none of
    // which the dialog sent. The contract is what broke, so the contract is
    // what the test pins.
    const rowFields = Object.keys(importBatch.args.subscribers.element.fields)
    expect(rowFields.sort()).toEqual(["email", "firstName", "lastName", "tags"])
    expect(importBatch.args.consentSource.isOptional).toBe("optional")
  })

  it("mints one token per row instead of taking it from the caller", async () => {
    const ctx = fakeCtx()
    await importBatch.handler(ctx, {
      storeId: STORE,
      subscribers: [csvRow, { email: "claire@resto.example" }],
      // Deliberately passing what an importer used to control. It is not in
      // the validator any more, and the handler must ignore it regardless.
      doubleOptInToken: "attacker-chosen",
    })

    const tokens = rows(ctx).map((r) => String(r.doubleOptInToken))
    expect(tokens).toHaveLength(2)
    expect(tokens).not.toContain("attacker-chosen")
    // Distinct per row: a leaked token is one address, not the whole import.
    expect(new Set(tokens).size).toBe(2)
    for (const token of tokens) {
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/)
    }
  })

  it("records a consent source even when the caller names none", async () => {
    const ctx = fakeCtx()
    await importBatch.handler(ctx, { storeId: STORE, subscribers: [csvRow] })
    expect(rows(ctx)[0]?.consentSource).toBe("csv import")
    expect(rows(ctx)[0]?.status).toBe("pending")
  })

  it("counts what it inserted and what it skipped", async () => {
    const ctx = fakeCtx(["yanis@resto.example"])
    const result = await importBatch.handler(ctx, {
      storeId: STORE,
      subscribers: [csvRow, { email: "claire@resto.example" }],
    })
    // The dialog read `result.imported`, which does not exist — so it fell back
    // to the row count of the file and reported every duplicate as imported.
    expect(result).toEqual({ inserted: 1, skipped: 1 })
  })
})
