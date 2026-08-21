import { describe, it, expect } from "vitest"
import {
  assertQuoteApplies,
  quotedDeliveryFee,
  QuoteRejectedError,
  QUOTE_COORD_TOLERANCE,
  type StoredQuote,
} from "../deliveryQuote"

const NOW = 1_700_000_000_000

function quote(overrides: Partial<StoredQuote> = {}): StoredQuote {
  return {
    estimateId: "est_1",
    storeId: "store_1",
    fee: 600,
    dropoffLatitude: 48.8566,
    dropoffLongitude: 2.3522,
    expiresAt: NOW + 60_000,
    ...overrides,
  }
}

const AT_THE_DOOR = { latitude: 48.8566, longitude: 2.3522 }

function reasonOf(fn: () => void): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof QuoteRejectedError) return error.reason
    throw error
  }
  throw new Error("expected a rejection, got none")
}

describe("a quote that applies", () => {
  it("accepts the address it was priced for", () => {
    expect(() =>
      assertQuoteApplies({
        quote: quote(),
        storeId: "store_1",
        dropoff: AT_THE_DOOR,
        now: NOW,
      })
    ).not.toThrow()
  })

  it("tolerates a geocoder disagreeing by a few metres", () => {
    expect(() =>
      assertQuoteApplies({
        quote: quote(),
        storeId: "store_1",
        dropoff: {
          latitude: 48.8566 + QUOTE_COORD_TOLERANCE * 0.9,
          longitude: 2.3522 - QUOTE_COORD_TOLERANCE * 0.9,
        },
        now: NOW,
      })
    ).not.toThrow()
  })
})

describe("a quote that does not", () => {
  it("refuses a missing quote", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: null,
          storeId: "store_1",
          dropoff: AT_THE_DOOR,
          now: NOW,
        })
      )
    ).toBe("missing")
  })

  it("refuses another restaurant's quote", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote({ storeId: "store_2" }),
          storeId: "store_1",
          dropoff: AT_THE_DOOR,
          now: NOW,
        })
      )
    ).toBe("wrong_store")
  })

  it("refuses an expired quote", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote({ expiresAt: NOW }),
          storeId: "store_1",
          dropoff: AT_THE_DOOR,
          now: NOW,
        })
      )
    ).toBe("expired")
  })

  it("refuses a quote that already paid for an order", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote({ consumedByOrderId: "order_1" }),
          storeId: "store_1",
          dropoff: AT_THE_DOOR,
          now: NOW,
        })
      )
    ).toBe("already_used")
  })

  it("refuses an address the quote was not priced for", () => {
    // Same city, thirty kilometres away.
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote(),
          storeId: "store_1",
          dropoff: { latitude: 49.1269, longitude: 2.5477 },
          now: NOW,
        })
      )
    ).toBe("address_mismatch")
  })

  it("refuses a shift of a single street", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote(),
          storeId: "store_1",
          dropoff: { latitude: 48.8566, longitude: 2.3522 + 0.0025 },
          now: NOW,
        })
      )
    ).toBe("address_mismatch")
  })

  it("refuses an address with no coordinates, and says what to do", () => {
    // The saved-address dead end: the customer HAS entered an address, so
    // "un devis est requis" told them nothing.
    try {
      assertQuoteApplies({
        quote: quote(),
        storeId: "store_1",
        dropoff: { latitude: undefined, longitude: undefined },
        now: NOW,
      })
      throw new Error("expected a rejection")
    } catch (error) {
      expect((error as QuoteRejectedError).reason).toBe("address_not_located")
      expect((error as Error).message).toContain("suggestions")
    }
  })

  it("refuses a half-located address", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote(),
          storeId: "store_1",
          dropoff: { latitude: 48.8566 },
          now: NOW,
        })
      )
    ).toBe("address_not_located")
  })

  it("checks the store before anything else, so a foreign quote never leaks its expiry", () => {
    expect(
      reasonOf(() =>
        assertQuoteApplies({
          quote: quote({ storeId: "store_2", expiresAt: NOW - 1 }),
          storeId: "store_1",
          dropoff: AT_THE_DOOR,
          now: NOW,
        })
      )
    ).toBe("wrong_store")
  })
})

describe("quotedDeliveryFee", () => {
  it("charges the configured percentage of the quoted fee", () => {
    expect(quotedDeliveryFee({ quote: { fee: 600 }, percentage: 50 })).toBe(300)
  })

  it("charges the whole fee at 100%", () => {
    expect(quotedDeliveryFee({ quote: { fee: 600 }, percentage: 100 })).toBe(600)
  })

  it("rounds to the cent rather than truncating", () => {
    expect(quotedDeliveryFee({ quote: { fee: 601 }, percentage: 50 })).toBe(301)
  })

  it("applies the cap", () => {
    expect(
      quotedDeliveryFee({ quote: { fee: 2000 }, percentage: 100, maxFee: 500 })
    ).toBe(500)
  })

  it("leaves a fee under the cap alone", () => {
    expect(
      quotedDeliveryFee({ quote: { fee: 400 }, percentage: 100, maxFee: 500 })
    ).toBe(400)
  })
})
