/**
 * Can this deployment actually take a card right now? (#374)
 *
 * The rule the storefront's tile pre-selection stands on. It must mirror
 * exactly the checks the charge-starting actions make — a tile offered here
 * and refused there is the defect it exists to remove — including
 * `getSiteEnv()`'s own `sk_` validation: a pasted publishable key makes the
 * Stripe action throw before it can say anything readable, so it must read
 * as unavailable, not as an active tile in front of a redacted crash.
 */

import { describe, expect, it } from "vitest"

import {
  cardPaymentAvailability,
  normalizeCardProvider,
  recordCardProviderHealth,
  resolveCardPaymentAvailability,
} from "../globalSettings"

describe("resolveCardPaymentAvailability", () => {
  it("answers with the platform key when Stripe is the provider", () => {
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "stripe",
        stripeSecretKeyPresent: true,
        connection: null,
      })
    ).toBe(true)
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "stripe",
        stripeSecretKeyPresent: false,
        connection: null,
      })
    ).toBe(false)
  })

  it("refuses the connection state the charge path refuses", () => {
    // `resolveStripeCharge` throws for status "connected" — the tripwire for
    // a routing claim the platform key cannot honour. The tile must go dark
    // for the same state the action refuses.
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "stripe",
        stripeSecretKeyPresent: true,
        connection: { status: "connected" },
      })
    ).toBe(false)
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "stripe",
        stripeSecretKeyPresent: true,
        connection: { status: "onboarding_complete" },
      })
    ).toBe(true)
  })

  it("answers with the SumUp connection exactly as createCheckout checks it", () => {
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: false,
        connection: { status: "connected", encryptedAccessToken: "iv:tag:ct" },
      })
    ).toBe(true)
    // Not connected, and connected-without-token: both refuse at the action.
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: true,
        connection: { status: "onboarding_complete", encryptedAccessToken: "iv:tag:ct" },
      })
    ).toBe(false)
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: true,
        connection: { status: "connected" },
      })
    ).toBe(false)
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: true,
        connection: null,
      })
    ).toBe(false)
  })
})

describe("cardPaymentAvailability def", () => {
  function ctxWith(rows: Record<string, Record<string, unknown>[]>) {
    return {
      db: {
        query: (table: string) => ({
          withIndex: () => ({
            first: async () => rows[table]?.[0] ?? null,
          }),
          first: async () => rows[table]?.[0] ?? null,
        }),
      },
    }
  }

  it("answers both questions for an establishment that takes no cards", async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    try {
      // A perfectly configured deployment. The owner has still said no.
      process.env.STRIPE_SECRET_KEY = "sk_test_123"
      const answer = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "none" } }] })
      )
      expect(answer).toEqual({ card: false, cardOffered: false })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })

  it("distinguishes an unconfigured provider from a withdrawn one", async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    try {
      delete process.env.STRIPE_SECRET_KEY
      const answer = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "stripe" } }] })
      )
      // Means to take cards, cannot yet: the tile stays and says why.
      expect(answer).toEqual({ card: false, cardOffered: true })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })

  it("reads a malformed Stripe key as unavailable, mirroring getSiteEnv's sk_ rule", async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    try {
      process.env.STRIPE_SECRET_KEY = "pk_live_pasted_by_mistake"
      const answer = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "stripe" } }] })
      )
      expect(answer).toEqual({ card: false, cardOffered: true })

      process.env.STRIPE_SECRET_KEY = "sk_test_123"
      const usable = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "stripe" } }] })
      )
      expect(usable).toEqual({ card: true, cardOffered: true })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })
})


/**
 * An establishment that does not take cards at all (#376, item 5).
 *
 * `payments.cardProvider` was a `stripe | sumup` union: there was no way to
 * say "no cards", and this handler folded every value that was not `sumup`
 * onto `stripe`. So a cash-only food truck — one of the five verticals this
 * engine is sold for — reported a card as available the moment a Stripe key
 * was present on the deployment, and its checkout rendered a pre-selected
 * tile it could not honour.
 *
 * The two answers are deliberately separate. `card` is "can a card be taken
 * right now", which greys the tile; `cardOffered` is "does this establishment
 * take cards", which removes it. Greying is for a fault that might clear.
 */
describe("cardProvider: none", () => {
  it("reads as unavailable even with a valid platform key", () => {
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "none",
        stripeSecretKeyPresent: true,
        connection: null,
      })
    ).toBe(false)
  })

  it("reads as unavailable even with a live SumUp connection", () => {
    // The owner's decision outranks a working connection: this is the case no
    // amount of auto-detection can infer.
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "none",
        stripeSecretKeyPresent: true,
        connection: { status: "connected", encryptedAccessToken: "tok" },
      })
    ).toBe(false)
  })

  it("is preserved rather than folded onto stripe", () => {
    expect(normalizeCardProvider("none")).toBe("none")
    expect(normalizeCardProvider("sumup")).toBe("sumup")
    expect(normalizeCardProvider("stripe")).toBe("stripe")
    // An absent block still means "Stripe, not yet configured" — which reads
    // as unavailable through the key check, not as "no cards".
    expect(normalizeCardProvider(undefined)).toBe("stripe")
    expect(normalizeCardProvider("square")).toBe("stripe")
  })
})
/**
 * A key that LOOKS right and that Stripe refuses (#411, B2-F8).
 *
 * `startsWith("sk_")` is a check on the shape of a string. It catches a pasted
 * publishable key and nothing else — a secret key that is revoked, rolled,
 * copied from another account, or a test key on a live deployment all pass it.
 * The card tile was therefore armed and pre-selected, and every diner who
 * chose it reached the redacted "Server Error" that #374 was written to remove.
 *
 * Only Stripe can answer whether a key works, and a query cannot ask Stripe.
 * So the answer is recorded when something that CAN ask learns it — the
 * nightly `stripe.verifyStripeKey`, and every checkout attempt — and read back
 * here.
 */
describe("what the provider said about our credentials", () => {
  const ARMED = {
    cardProvider: "stripe" as const,
    stripeSecretKeyPresent: true,
    connection: null,
  }

  it("disarms the tile when Stripe refused the key", () => {
    expect(
      resolveCardPaymentAvailability({
        ...ARMED,
        providerHealth: { provider: "stripe", usable: false },
      })
    ).toBe(false)
  })

  it("leaves it armed when Stripe accepted the key", () => {
    expect(
      resolveCardPaymentAvailability({
        ...ARMED,
        providerHealth: { provider: "stripe", usable: true },
      })
    ).toBe(true)
  })

  it("leaves it armed when nothing has ever asked", () => {
    // A guard may not invent the fact it is checking. Absent is "never asked",
    // not "refused" — reading it as a refusal would take card payments away
    // from every correctly configured deployment on the day this shipped.
    expect(resolveCardPaymentAvailability({ ...ARMED })).toBe(true)
    expect(
      resolveCardPaymentAvailability({ ...ARMED, providerHealth: null })
    ).toBe(true)
  })

  it("ignores a verdict about a provider the establishment has left", () => {
    // An owner who moves from Stripe to SumUp leaves a stale Stripe verdict
    // behind. It must not disarm a SumUp tile that works.
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: false,
        connection: { status: "connected", encryptedAccessToken: "cipher" },
        providerHealth: { provider: "stripe", usable: false },
      })
    ).toBe(true)
  })

  it("disarms a SumUp tile on a SumUp refusal", () => {
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "sumup",
        stripeSecretKeyPresent: false,
        connection: { status: "connected", encryptedAccessToken: "cipher" },
        providerHealth: { provider: "sumup", usable: false },
      })
    ).toBe(false)
  })

  it("still says no to an owner who takes no cards, whatever Stripe says", () => {
    // The owner's decision outranks every measurement. A working key does not
    // put a card tile in front of a cash-only food truck.
    expect(
      resolveCardPaymentAvailability({
        cardProvider: "none",
        stripeSecretKeyPresent: true,
        connection: null,
        providerHealth: { provider: "stripe", usable: true },
      })
    ).toBe(false)
  })
})

/**
 * A table-aware fake `ctx.db`: enough of one for a reader and a recorder that
 * do `query(table).withIndex(...).first()`, `patch` and `insert`.
 */
function fakeCtx(tables: Record<string, any[]>) {
  const writes: Array<{ op: string; table?: string; id?: any; fields: any }> = []
  const ctx = {
    db: {
      query: (table: string) => {
        const rows = tables[table] ?? []
        return {
          first: async () => rows[0] ?? null,
          collect: async () => rows,
          withIndex: () => ({
            first: async () => rows[0] ?? null,
            collect: async () => rows,
          }),
        }
      },
      patch: async (id: any, fields: any) => {
        writes.push({ op: "patch", id, fields })
      },
      insert: async (table: string, fields: any) => {
        writes.push({ op: "insert", table, fields })
        return `${table}:1`
      },
    },
  } as any
  return { ctx, writes }
}

describe("recordCardProviderHealth", () => {
  it("writes the verdict into its own table", async () => {
    const { ctx, writes } = fakeCtx({ cardProviderHealth: [] })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: false,
      detail: "Invalid API Key provided",
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].op).toBe("insert")
    expect(writes[0].table).toBe("cardProviderHealth")
    expect(writes[0].fields).toMatchObject({
      provider: "stripe",
      usable: false,
      detail: "Invalid API Key provided",
    })
    expect(typeof writes[0].fields.checkedAt).toBe("number")
  })

  it("writes it whether or not the owner has ever saved Réglages", async () => {
    // THE BUG in the first shape of this fix. The verdict hung on the
    // `globalSettings` document, which is created by exactly one thing — the
    // owner pressing Enregistrer. On a fresh deployment there was nothing to
    // write it onto, so nothing was recorded and every diner met the broken
    // key in turn, for ever. Its own table has no such precondition.
    const { ctx, writes } = fakeCtx({ cardProviderHealth: [], globalSettings: [] })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: false,
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe("cardProviderHealth")
  })

  it("records a success too", async () => {
    const { ctx, writes } = fakeCtx({ cardProviderHealth: [] })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: true,
    })
    expect(writes[0].fields.usable).toBe(true)
    expect(writes[0].fields.detail).toBeUndefined()
  })

  it("bounds the provider's own words rather than storing them whole", async () => {
    const { ctx, writes } = fakeCtx({ cardProviderHealth: [] })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: false,
      detail: "x".repeat(5_000),
    })
    expect(writes[0].fields.detail).toHaveLength(500)
  })

  it("writes nothing when the verdict has not moved", async () => {
    // This row is read on the order path, and Convex conflicts a write with
    // every concurrent transaction that read the document. A rewrite on every
    // successful checkout would make a busy service lose OCC rounds over
    // bookkeeping.
    const { ctx, writes } = fakeCtx({
      cardProviderHealth: [
        { _id: "h:1", provider: "stripe", usable: true, checkedAt: 1 },
      ],
    })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: true,
    })
    expect(writes).toEqual([])
  })

  it("patches when the verdict HAS moved", async () => {
    const { ctx, writes } = fakeCtx({
      cardProviderHealth: [
        { _id: "h:1", provider: "stripe", usable: true, checkedAt: 1 },
      ],
    })
    await recordCardProviderHealth.handler(ctx, {
      provider: "stripe",
      usable: false,
      detail: "Invalid API Key",
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].op).toBe("patch")
    expect(writes[0].id).toBe("h:1")
    expect(writes[0].fields).toMatchObject({ usable: false, detail: "Invalid API Key" })
  })

  it("never throws — its callers are a money path and a cron", async () => {
    const exploding = {
      db: {
        query: () => ({
          withIndex: () => ({
            first: async () => {
              throw new Error("db unavailable")
            },
          }),
        }),
      },
    } as any
    await expect(
      recordCardProviderHealth.handler(exploding, {
        provider: "stripe",
        usable: true,
      })
    ).resolves.toBeUndefined()
  })
})

describe("the query, end to end", () => {
  it("reports a refused key as unavailable, not as an armed tile", async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    try {
      // Well-formed — it clears `startsWith("sk_")` — and Stripe said no.
      // Short and dull for the same reason as everywhere else in this repo: a
      // realistic-looking literal is a secret-scan finding for no coverage.
      process.env.STRIPE_SECRET_KEY = "sk_live_abc"
      const { ctx } = fakeCtx({
        globalSettings: [{ payments: { cardProvider: "stripe" } }],
        paymentConnections: [],
        cardProviderHealth: [
          { provider: "stripe", usable: false, checkedAt: 1 },
        ],
      })
      const answer = await cardPaymentAvailability.handler(ctx)
      // The tile stays visible — this establishment does take cards — and is
      // greyed rather than removed, because a key can be fixed.
      expect(answer).toEqual({ card: false, cardOffered: true })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })

  it("does not read the table at all for an establishment that takes no cards", async () => {
    const { ctx } = fakeCtx({
      globalSettings: [{ payments: { cardProvider: "none" } }],
      cardProviderHealth: [
        { provider: "stripe", usable: false, checkedAt: 1 },
      ],
    })
    expect(await cardPaymentAvailability.handler(ctx)).toEqual({
      card: false,
      cardOffered: false,
    })
  })
})
