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
import {
  SUBSCRIBE_REFUSALS,
  create,
  importBatch,
  markBounced,
  normalizeBounceType,
  normalizeSubscriberEmail,
} from "../emailSubscribers"

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

  /**
   * `create` is what every signup surface goes through, and `subscribe` — the
   * storefront's door to it — is public. It accepted `pas-un-email`, inserted
   * it, and left the footer telling the visitor to check their inbox. Every one
   * of those rows is a guaranteed SES bounce, on the 5% ratio AWS suspends the
   * account over.
   */
  it("refuses an address that is not one, before writing anything", async () => {
    const ctx = fakeCtx()

    await expect(
      create.handler(ctx, {
        storeId: STORE,
        email: "pas-un-email",
        source: "storefront_form",
      })
    ).rejects.toMatchObject({ data: { code: SUBSCRIBE_REFUSALS.invalidEmail } })

    expect(rows(ctx)).toHaveLength(0)
  })

  it("refuses before spending a rate-limit slot, so a typo is correctable", async () => {
    const ctx = fakeCtx()

    await expect(
      create.handler(ctx, { storeId: STORE, email: "  ", source: "storefront_form" })
    ).rejects.toMatchObject({ data: { code: SUBSCRIBE_REFUSALS.invalidEmail } })

    expect(ctx.rows("rateLimits")).toHaveLength(0)
  })

  it("names the duplicate refusal, so the storefront need not guess", async () => {
    // A plain thrown message is redacted to "Server Error" in production, which
    // is why the footer used to hedge with "déjà inscrit, ou une erreur".
    const ctx = fakeCtx(["yanis@resto.example"])

    await expect(
      create.handler(ctx, {
        storeId: STORE,
        email: "yanis@resto.example",
        source: "storefront_form",
      })
    ).rejects.toMatchObject({ data: { code: SUBSCRIBE_REFUSALS.alreadySubscribed } })
  })
})

describe("normalizeSubscriberEmail", () => {
  it("accepts an address and returns it ready to store", () => {
    expect(normalizeSubscriberEmail("  Yanis@Resto.Example  ")).toBe(
      "yanis@resto.example"
    )
  })

  it.each([
    ["pas-un-email", "no @ at all"],
    ["yanis@resto", "no dot in the domain"],
    ["@resto.example", "no local part"],
    ["yanis@", "no domain"],
    ["yanis @resto.example", "a space inside"],
    ["", "empty"],
    ["   ", "whitespace only"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeSubscriberEmail(input)).toBeNull()
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
    expect(result).toEqual({
      inserted: 1,
      skipped: 1,
      pendingIds: [expect.any(String)],
    })
  })

  it("names the rows it inserted, so each can be sent a confirmation", async () => {
    const ctx = fakeCtx(["yanis@resto.example"])
    const result = await importBatch.handler(ctx, {
      storeId: STORE,
      subscribers: [csvRow, { email: "claire@resto.example" }],
    })
    // A count cannot say WHICH rows were inserted, and the caller has to
    // schedule one confirmation email per row. The duplicate is not among them.
    // `fakeCtx.db.insert` returns `row_N`, so that is what a real id looks like
    // here. The previous spelling compared the value to itself through a `??`
    // and could not fail.
    expect(result.pendingIds).toEqual(["row_1"])
  })
})

/**
 * A ctx holding one subscriber, for the mutations that patch an existing row.
 *
 * Separate from `fakeCtx` because these read before they write: `fakeCtx.db.get`
 * does not exist, and `patch` there is a no-op that records nothing.
 */
function subscriberCtx(doc: Record<string, unknown>) {
  const row = { ...doc }
  return {
    row,
    db: {
      get: async () => row,
      patch: async (_id: unknown, fields: Record<string, unknown>) => {
        Object.assign(row, fields)
      },
    },
  }
}

const SUBSCRIBER = "emailSubscribers:a"

/**
 * How many sends a dead address is worth.
 *
 * `markBounced` counted to three before suppressing, whatever SES said about
 * the address. For a `Permanent` bounce — the mailbox does not exist — the
 * other two sends buy nothing and are spent on the one number AWS suspends an
 * account over: the bounce *ratio*. The published threshold is 5%, and a list
 * built over two years reaches that on its own once every dead address is
 * counted three times. Losing the sending identity takes order confirmations
 * with it, since they leave through the same one.
 *
 * The classification was already arriving from SES and being thrown away —
 * `markBounced` had no argument to receive it with.
 */
describe("markBounced", () => {
  it("suppresses a permanent bounce on the first one", async () => {
    const ctx = subscriberCtx({ status: "active", bounceCount: 0 })
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Permanent" })
    // `pageForSending` selects on `status === "active"`, so this flip is the
    // whole suppression — anything less mails the address again.
    expect(ctx.row.status).toBe("bounced")
    expect(ctx.row.bounceCount).toBe(1)
  })

  it("gives a transient bounce three strikes", async () => {
    const ctx = subscriberCtx({ status: "active", bounceCount: 0 })

    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Transient" })
    expect(ctx.row.status).toBe("active")
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Transient" })
    // A full mailbox or a greylisting recovers. Suppressing on the first would
    // quietly delete paying customers from the list.
    expect(ctx.row.status).toBe("active")

    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Transient" })
    expect(ctx.row.status).toBe("bounced")
    expect(ctx.row.bounceCount).toBe(3)
  })

  it("treats an undetermined bounce as transient", async () => {
    const ctx = subscriberCtx({ status: "active", bounceCount: 0 })
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Undetermined" })
    // SES could not classify it. An address we cannot prove dead keeps its
    // place.
    expect(ctx.row.status).toBe("active")
  })

  it("keeps the counter when the caller names no type", async () => {
    const ctx = subscriberCtx({ status: "active", bounceCount: 0 })
    await markBounced.handler(ctx, { id: SUBSCRIBER })
    // The cautious reading. An absent classification is not a permanent one,
    // and the argument is optional so an older caller still type-checks.
    expect(ctx.row.status).toBe("active")
    expect(ctx.row.bounceCount).toBe(1)
  })

  it("does not overwrite a spam complaint", async () => {
    const ctx = subscriberCtx({ status: "complained", bounceCount: 0 })
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Permanent" })
    // Both statuses suppress, but only one of them answers "why did you stop
    // mailing this person" the way a regulator asks it.
    expect(ctx.row.status).toBe("complained")
    expect(ctx.row.bounceCount).toBe(1)
  })

  it("does not resurrect an unsubscribe", async () => {
    const ctx = subscriberCtx({ status: "unsubscribed", bounceCount: 2 })
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Transient" })
    expect(ctx.row.status).toBe("unsubscribed")
  })

  it("suppresses a pending subscriber who never confirmed", async () => {
    const ctx = subscriberCtx({ status: "pending", bounceCount: 0 })
    await markBounced.handler(ctx, { id: SUBSCRIBER, bounceType: "Permanent" })
    // The confirmation mail itself bounced, so the address is dead and the
    // token can never be used. Leaving the row `pending` would keep it as a
    // candidate for a re-send.
    expect(ctx.row.status).toBe("bounced")
  })
})

/**
 * The classification arrives over the wire, so it is not ours to assume.
 *
 * `markBounced`'s validator is a closed union of SES's three values, and the
 * webhook's whole dispatch sits in a `catch` that only logs. Forwarding a
 * fourth value raw would therefore fail validation, be swallowed, and lose the
 * bounce entirely — strictly worse than the three-strike rule it replaced,
 * which at least counted it.
 */
describe("normalizeBounceType", () => {
  it("passes SES's own three classifications through", () => {
    expect(normalizeBounceType("Permanent")).toBe("Permanent")
    expect(normalizeBounceType("Transient")).toBe("Transient")
    expect(normalizeBounceType("Undetermined")).toBe("Undetermined")
  })

  it("reduces anything else to no classification at all", () => {
    // `undefined` is the cautious branch in `markBounced`: the counter moves
    // and nothing is suppressed. An unreadable classification must land there
    // rather than throw.
    for (const raw of ["SomethingAwsAddedLater", "permanent", "", null, undefined, 42, {}, []]) {
      expect(normalizeBounceType(raw)).toBeUndefined()
    }
  })
})
