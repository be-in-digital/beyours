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

import { cardPaymentAvailability, resolveCardPaymentAvailability } from "../globalSettings"

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

  it("reads a malformed Stripe key as unavailable, mirroring getSiteEnv's sk_ rule", async () => {
    const previous = process.env.STRIPE_SECRET_KEY
    try {
      process.env.STRIPE_SECRET_KEY = "pk_live_pasted_by_mistake"
      const answer = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "stripe" } }] })
      )
      expect(answer).toEqual({ card: false })

      process.env.STRIPE_SECRET_KEY = "sk_test_123"
      const usable = await cardPaymentAvailability.handler(
        ctxWith({ globalSettings: [{ payments: { cardProvider: "stripe" } }] })
      )
      expect(usable).toEqual({ card: true })
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY
      else process.env.STRIPE_SECRET_KEY = previous
    }
  })
})
