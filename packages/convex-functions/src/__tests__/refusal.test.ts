import { describe, it, expect } from "vitest"
import { ConvexError, convexToJson, jsonToConvex } from "convex/values"
import { RefusalError } from "../refusal"
import { LineRejectedError } from "../orderLine"
import { OrderZoneRejectedError } from "../deliveryZone"
import { QuoteRejectedError } from "../deliveryQuote"
import { PromotionRejectedError } from "../promotionDiscount"
import { FieldTooLongError, RateLimitedError } from "../rateLimit"
import { OrderRefusedError } from "../orders"

/**
 * Every refusal on the checkout path has to survive the wire.
 *
 * Convex redacts a thrown `Error` in production: the browser receives "Server
 * Error", and the eight French sentences this path writes never arrive. Only
 * `ConvexError` keeps its `data`. These are the classes the customer's order
 * can be refused by, and this is the one property that makes their messages
 * readable at all.
 */

const CASES: Array<[string, RefusalError, string]> = [
  [
    "LineRejectedError",
    new LineRejectedError("insufficient_stock", "Pizza", "« Pizza » est épuisé."),
    "insufficient_stock",
  ],
  [
    "OrderZoneRejectedError",
    new OrderZoneRejectedError("below_minimum", "Commande minimum de 15,00 € requise."),
    "below_minimum",
  ],
  [
    "QuoteRejectedError",
    new QuoteRejectedError("expired", "Le devis de livraison a expiré : recalculez les frais."),
    "expired",
  ],
  [
    "PromotionRejectedError",
    new PromotionRejectedError("expired", "Ce code promo a expiré."),
    "expired",
  ],
  ["FieldTooLongError", new FieldTooLongError("name", 120), "field_too_long"],
  ["RateLimitedError", new RateLimitedError(1_800_000_000_000), "rate_limited"],
  [
    "OrderRefusedError",
    new OrderRefusedError("outside_opening_hours", "Ce restaurant est fermé pour le moment."),
    "outside_opening_hours",
  ],
]

describe.each(CASES)("%s", (_name, error, code) => {
  it("is a ConvexError, which is what stops Convex redacting it", () => {
    expect(error).toBeInstanceOf(ConvexError)
    expect(error).toBeInstanceOf(RefusalError)
  })

  it("carries the code the UI switches on", () => {
    expect(error.data.code).toBe(code)
  })

  it("carries the sentence in data, where it survives", () => {
    expect(typeof error.data.message).toBe("string")
    expect(error.data.message.length).toBeGreaterThan(0)
  })

  it("keeps `message` the sentence, not the JSON of its own payload", () => {
    // `ConvexError` sets `message` to `stringifyValueForError(data)`. Half this
    // repository — and a good part of the suite — reads `error.message`, so the
    // base restores it. Without that, a toast would render a serialized object.
    expect(error.message).toBe(error.data.message)
    expect(error.message).not.toContain("{")
  })

  it("survives the round trip Convex puts `data` through", () => {
    // This is the part convex-test cannot fail for you: a payload holding a
    // value Convex cannot serialize throws at the boundary in production only.
    const roundTripped = jsonToConvex(convexToJson(error.data))
    expect(roundTripped).toEqual(error.data)
  })
})

describe("the specifics each class carries beyond code and message", () => {
  it("names the dish the customer has to act on", () => {
    const error = new LineRejectedError("inactive", "Pizza", "« Pizza » n'est plus disponible.")
    expect(error.productName).toBe("Pizza")
    expect(error.data.productName).toBe("Pizza")
    expect(error.reason).toBe("inactive")
  })

  it("keeps the field and its limit machine-readable", () => {
    const error = new FieldTooLongError("street", 200)
    expect(error.field).toBe("street")
    expect(error.limit).toBe(200)
    expect(error.data.limit).toBe(200)
  })

  it("keeps the retry time as a number, not a sentence", () => {
    const error = new RateLimitedError(1_800_000_000_000)
    expect(error.retryAt).toBe(1_800_000_000_000)
    expect(error.data.retryAt).toBe(1_800_000_000_000)
  })

  it("keeps `reason` on every class that already exposed one", () => {
    // `orders.ts` catches `PromotionRejectedError` by `instanceof` and the
    // checkout page reads `.message` off it. Extending ConvexError must not
    // have cost either.
    const promo = new PromotionRejectedError("not_applicable", "Ce code promo ne s'applique pas à votre commande.")
    expect(promo instanceof PromotionRejectedError).toBe(true)
    expect(promo.reason).toBe("not_applicable")
    expect(promo.name).toBe("PromotionRejectedError")
  })
})
