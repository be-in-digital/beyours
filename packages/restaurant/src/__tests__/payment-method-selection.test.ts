/**
 * The no-preselect rule (#374): the checkout never lands a diner on a tile
 * the deployment cannot serve. On a fresh deployment — cash on, no card
 * provider keyed — card was the hardcoded default, every card submit failed,
 * and the failed-card-then-cash retry became the natural first journey.
 */

import { describe, expect, it } from "vitest"

import {
  isPaymentMethodSelectable,
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
