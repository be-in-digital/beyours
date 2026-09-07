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
