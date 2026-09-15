/**
 * The no-preselect rule (#374): the checkout never lands a diner on a tile
 * the deployment cannot serve. On a fresh deployment — cash on, no card
 * provider keyed — card was the hardcoded default, every card submit failed,
 * and the failed-card-then-cash retry became the natural first journey.
 */

import { describe, expect, it } from "vitest"

import {
  isPaymentMethodSelectable,
  cardUnavailableMessage,
  hasAlternativeToCard,
  nothingIsDue,
  resolvePaymentMethod,
  type PaymentMethodContext,
} from "../services/payment-method-selection"

function context(overrides: Partial<PaymentMethodContext> = {}): PaymentMethodContext {
  return {
    cardAvailable: true,
    paypalEnabled: false,
    cashEnabled: false,
    isDelivery: false,
    isAuthenticated: false,
    ...overrides,
  }
}

describe("resolvePaymentMethod", () => {
  it("keeps today's card-first default when the deployment can take a card", () => {
    expect(resolvePaymentMethod(null, context())).toBe("card")
  })

  it("treats a still-loading availability as available, so a configured deployment does not flicker", () => {
    expect(resolvePaymentMethod(null, context({ cardAvailable: undefined }))).toBe("card")
  })

  it("never pre-selects card on a deployment that cannot serve it", () => {
    // The fresh-deployment state from #374: cash on, no card provider keyed,
    // diner signed in. The default must be the tile that works.
    const fresh = context({
      cardAvailable: false,
      cashEnabled: true,
      isAuthenticated: true,
    })
    expect(resolvePaymentMethod(null, fresh)).toBe("cash")
    expect(isPaymentMethodSelectable("card", fresh)).toBe(false)
  })

  it("falls to PayPal before cash, matching the tiles' display order", () => {
    const both = context({
      cardAvailable: false,
      paypalEnabled: true,
      cashEnabled: true,
      isAuthenticated: true,
    })
    expect(resolvePaymentMethod(null, both)).toBe("paypal")
  })

  it("answers null when the deployment can serve nothing, instead of a doomed card attempt", () => {
    // Card dead, cash present but the diner is not signed in: submitting card
    // anyway is exactly the #374 journey, so the form must disable submit.
    const nothing = context({ cardAvailable: false, cashEnabled: true })
    expect(resolvePaymentMethod(null, nothing)).toBeNull()
  })

  it("keeps the diner's own choice while it is servable", () => {
    const ctx = context({ cashEnabled: true, isAuthenticated: true })
    expect(resolvePaymentMethod("cash", ctx)).toBe("cash")
  })

  it("resolves a cash choice away when cash stops being selectable", () => {
    // The rule the form used to hardcode: switching to delivery, or signing
    // out, takes cash off the table — and the replacement must itself be a
    // tile the deployment can serve.
    const deliverySwitch = context({
      cashEnabled: true,
      isAuthenticated: true,
      isDelivery: true,
    })
    expect(resolvePaymentMethod("cash", deliverySwitch)).toBe("card")

    const cardDead = context({
      cardAvailable: false,
      cashEnabled: true,
      isAuthenticated: true,
      isDelivery: true,
      paypalEnabled: true,
    })
    expect(resolvePaymentMethod("cash", cardDead)).toBe("paypal")
  })
})

/**
 * What the order costs is a fact about the tiles, and none of them asked it.
 *
 * Stripe will not take less than 0,50 € in EUR, and a 100 % coupon takes an
 * order to zero. The tile was offered anyway, the diner chose it, and the
 * session create threw an SDK error Convex redacts to "Server Error" — on an
 * order no number of retries could ever settle.
 */
describe("what the order actually owes", () => {
  const EUR_FLOOR = 50

  it("withholds card and PayPal below the provider's floor", () => {
    const tiny = context({
      paypalEnabled: true,
      amountDue: 30,
      cardMinimum: EUR_FLOOR,
    })
    expect(isPaymentMethodSelectable("card", tiny)).toBe(false)
    expect(isPaymentMethodSelectable("paypal", tiny)).toBe(false)
  })

  it("offers them again exactly at the floor", () => {
    const atFloor = context({
      paypalEnabled: true,
      amountDue: EUR_FLOOR,
      cardMinimum: EUR_FLOOR,
    })
    expect(isPaymentMethodSelectable("card", atFloor)).toBe(true)
    expect(isPaymentMethodSelectable("paypal", atFloor)).toBe(true)
  })

  it("leaves an order that owes nothing with a way to be placed", () => {
    // The regression this rule has to avoid introducing: refusing card and
    // PayPal for a free order and stopping there would leave a guest, on a
    // deployment with cash off, unable to complete a checkout at all.
    const free = context({
      amountDue: 0,
      cardMinimum: EUR_FLOOR,
      cashEnabled: false,
      isAuthenticated: false,
      isDelivery: true,
    })
    expect(isPaymentMethodSelectable("card", free)).toBe(false)
    expect(isPaymentMethodSelectable("paypal", free)).toBe(false)
    expect(isPaymentMethodSelectable("cash", free)).toBe(true)
    expect(resolvePaymentMethod(null, free)).toBe("cash")
  })

  it("changes nothing for a caller that has not priced the basket", () => {
    // `undefined` is "still loading", and greying every tile while a delivery
    // quote lands would be worse than the defect being guarded.
    const unknown = context({ paypalEnabled: true, cardMinimum: EUR_FLOOR })
    expect(isPaymentMethodSelectable("card", unknown)).toBe(true)
    expect(isPaymentMethodSelectable("paypal", unknown)).toBe(true)
    expect(resolvePaymentMethod(null, unknown)).toBe("card")
  })

  it("applies no floor when the caller has not supplied one", () => {
    const noFloor = context({ amountDue: 1 })
    expect(isPaymentMethodSelectable("card", noFloor)).toBe(true)
  })

  it("still refuses card for the reasons it always did", () => {
    // A total that clears the floor does not rescue a deployment that cannot
    // charge, or an owner who does not take cards.
    expect(
      isPaymentMethodSelectable(
        "card",
        context({ amountDue: 1_000, cardMinimum: EUR_FLOOR, cardAvailable: false })
      )
    ).toBe(false)
    expect(
      isPaymentMethodSelectable(
        "card",
        context({ amountDue: 1_000, cardMinimum: EUR_FLOOR, cardOffered: false })
      )
    ).toBe(false)
  })
})

describe("nothingIsDue", () => {
  it("is about zero, not about a missing figure", () => {
    expect(nothingIsDue(context({ amountDue: 0 }))).toBe(true)
    expect(nothingIsDue(context({ amountDue: 1 }))).toBe(false)
    // Not priced yet is not free.
    expect(nothingIsDue(context())).toBe(false)
  })
})

/**
 * The sentence a refused card gets, and the half of it that is about the screen
 * rather than the deployment (#531).
 */
describe("cardUnavailableMessage", () => {
  it("points at another method when the page offers one", () => {
    const withCash = context({ cashEnabled: true, isDelivery: false, isAuthenticated: true })

    expect(cardUnavailableMessage(withCash)).toContain("Choisissez un autre moyen de paiement")
  })

  it("does not point at another method when card is the only tile", () => {
    /*
     * THE DEFECT. A delivery order at an establishment that takes no cash and
     * no PayPal renders exactly one tile. « Choisissez un autre moyen de
     * paiement » in front of a single tile reads as the diner's own oversight,
     * and they hunt for a control that was never on the page.
     *
     * Cash is refused here by `isDelivery`, not by `cashEnabled` — the tighter
     * of the two, so this also covers an establishment that does take cash and
     * simply cannot for this order.
     */
    const cardOnly = context({
      cashEnabled: true,
      isDelivery: true,
      isAuthenticated: true,
      paypalEnabled: false,
    })

    expect(cardUnavailableMessage(cardOnly)).not.toContain("autre moyen de paiement")
    expect(cardUnavailableMessage(cardOnly)).toContain("contactez le restaurant")
  })

  it("states the fact either way", () => {
    // The half that is about the deployment and not the screen.
    for (const isDelivery of [true, false]) {
      expect(
        cardUnavailableMessage(context({ cashEnabled: true, isDelivery, isAuthenticated: true }))
      ).toContain("Le paiement par carte est indisponible pour le moment.")
    }
  })

  it("counts PayPal as an alternative", () => {
    const paypalOnly = context({
      cashEnabled: false,
      isDelivery: true,
      paypalEnabled: true,
      amountDue: 2_000,
    })

    expect(hasAlternativeToCard(paypalOnly)).toBe(true)
    expect(cardUnavailableMessage(paypalOnly)).toContain("Choisissez un autre moyen")
  })

  it("does not count PayPal under its own floor", () => {
    // A tile the page will not render is not an alternative, and this is the
    // reason the check runs `isPaymentMethodSelectable` rather than reading the
    // settings a second time.
    const tooSmall = context({
      cashEnabled: false,
      isDelivery: true,
      paypalEnabled: true,
      amountDue: 10,
      cardMinimum: 50,
    })

    expect(hasAlternativeToCard(tooSmall)).toBe(false)
  })

  it("never suggests card itself", () => {
    // Anti-vacuity on the exclusion: card is the method that just failed, so a
    // helper that folded it in would call every screen an alternative.
    const cardOnly = context({ cashEnabled: false, paypalEnabled: false, isDelivery: true })

    expect(hasAlternativeToCard(cardOnly)).toBe(false)
  })
})
