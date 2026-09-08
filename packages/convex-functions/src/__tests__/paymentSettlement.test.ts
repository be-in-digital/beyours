import { describe, it, expect } from "vitest"
import {
  assertSettlesOrder,
  toMinorUnits,
  readPayPalCapture,
  readStripeCheckoutSession,
  paymentStatusAfterSettlement,
  orderAlreadyCollected,
  deliberateSettlementRefusal,
  isDeliberateSettlementRefusal,
  DoubleCollectionError,
  SettlementRejectedError,
  type SettlementClaim,
  type OrderToSettle,
} from "../paymentSettlement"

const ORDER: OrderToSettle = { orderId: "orders:1", total: 11_500 }

function claim(over: Partial<SettlementClaim> = {}): SettlementClaim {
  return {
    provider: "sumup",
    reference: "orders:1",
    amountMajor: 115,
    currency: "EUR",
    ...over,
  }
}

function rejection(fn: () => unknown): SettlementRejectedError {
  try {
    fn()
  } catch (error) {
    if (error instanceof SettlementRejectedError) return error
    throw error
  }
  throw new Error("expected the settlement to be rejected, but it was accepted")
}

// ============================================================================
// toMinorUnits
// ============================================================================

describe("toMinorUnits", () => {
  it("converts a number in euros to cents", () => {
    expect(toMinorUnits(115)).toBe(11_500)
    expect(toMinorUnits(11.5)).toBe(1_150)
  })

  it("converts a decimal string, as PayPal reports it", () => {
    expect(toMinorUnits("115.00")).toBe(11_500)
    expect(toMinorUnits("11.51")).toBe(1_151)
    expect(toMinorUnits(" 9.99 ")).toBe(999)
  })

  it("survives IEEE-754 rounding", () => {
    // 11.51 * 100 is 1150.9999999999998 before rounding
    expect(toMinorUnits(11.51)).toBe(1_151)
    expect(toMinorUnits(0.29)).toBe(29)
    expect(toMinorUnits(1.005)).toBe(101)
  })

  it("returns null rather than 0 for anything unparseable", () => {
    // Coercing to 0 would make a missing amount match a free order.
    expect(toMinorUnits(null)).toBeNull()
    expect(toMinorUnits(undefined)).toBeNull()
    expect(toMinorUnits("")).toBeNull()
    expect(toMinorUnits("gratuit")).toBeNull()
    expect(toMinorUnits(Number.NaN)).toBeNull()
    expect(toMinorUnits(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("keeps a genuine zero distinct from a missing value", () => {
    expect(toMinorUnits(0)).toBe(0)
    expect(toMinorUnits("0.00")).toBe(0)
  })
})

// ============================================================================
// The replay attack this module exists for
// ============================================================================

describe("cross-order replay", () => {
  it("accepts a payment that matches the order", () => {
    expect(() => assertSettlesOrder(claim(), ORDER)).not.toThrow()
  })

  it("refuses a payment made for a different order", () => {
    // The audit scenario: pay a 1 € order, replay its id on a 200 € order.
    const error = rejection(() =>
      assertSettlesOrder(claim({ reference: "orders:cheap", amountMajor: 1 }), ORDER)
    )
    expect(error.reason).toBe("reference_mismatch")
    expect(error.message).toContain("orders:cheap")
  })

  it("refuses a payment whose reference the provider did not return", () => {
    expect(rejection(() => assertSettlesOrder(claim({ reference: undefined }), ORDER)).reason)
      .toBe("reference_missing")
    expect(rejection(() => assertSettlesOrder(claim({ reference: null }), ORDER)).reason)
      .toBe("reference_missing")
    expect(rejection(() => assertSettlesOrder(claim({ reference: "" }), ORDER)).reason)
      .toBe("reference_missing")
  })

  it("checks the reference before the amount, so the error names the real problem", () => {
    const error = rejection(() =>
      assertSettlesOrder(claim({ reference: "orders:other", amountMajor: 999 }), ORDER)
    )
    expect(error.reason).toBe("reference_mismatch")
  })
})

// ============================================================================
// Amount
// ============================================================================

describe("amount verification", () => {
  it("refuses an under-payment", () => {
    const error = rejection(() => assertSettlesOrder(claim({ amountMajor: 1 }), ORDER))
    expect(error.reason).toBe("amount_mismatch")
    expect(error.message).toContain("11500")
  })

  it("refuses an over-payment — the two sides disagree about what was bought", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: 200 }), ORDER)).reason)
      .toBe("amount_mismatch")
  })

  it("refuses a payment that reports no amount", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: null }), ORDER)).reason)
      .toBe("amount_missing")
  })

  it("refuses a one-cent discrepancy", () => {
    expect(rejection(() => assertSettlesOrder(claim({ amountMajor: 114.99 }), ORDER)).reason)
      .toBe("amount_mismatch")
  })

  it("accepts a PayPal-style decimal string", () => {
    expect(() =>
      assertSettlesOrder(
        claim({ provider: "paypal", amountMajor: "115.00" }),
        ORDER
      )
    ).not.toThrow()
  })

  it("accepts a free order settled for zero", () => {
    expect(() =>
      assertSettlesOrder(claim({ amountMajor: 0 }), { orderId: "orders:1", total: 0 })
    ).not.toThrow()
  })
})

// ============================================================================
// Currency
// ============================================================================

describe("currency verification", () => {
  it("refuses a payment in another currency", () => {
    const error = rejection(() => assertSettlesOrder(claim({ currency: "USD" }), ORDER))
    expect(error.reason).toBe("currency_mismatch")
  })

  it("is case-insensitive", () => {
    expect(() => assertSettlesOrder(claim({ currency: "eur" }), ORDER)).not.toThrow()
  })

  it("skips the check when the provider reports no currency", () => {
    expect(() => assertSettlesOrder(claim({ currency: null }), ORDER)).not.toThrow()
  })

  it("honours an explicit order currency", () => {
    expect(() =>
      assertSettlesOrder(claim({ currency: "CHF" }), {
        orderId: "orders:1",
        total: 11_500,
        currency: "CHF",
      })
    ).not.toThrow()
  })
})

// ============================================================================
// PayPal capture parsing
// ============================================================================

describe("readPayPalCapture", () => {
  it("pulls the reference and captured amount out of a real capture shape", () => {
    const parsed = readPayPalCapture({
      purchase_units: [
        {
          reference_id: "orders:1",
          payments: {
            captures: [{ amount: { currency_code: "EUR", value: "115.00" } }],
          },
        },
      ],
    })

    expect(parsed).toEqual({
      reference: "orders:1",
      amountMajor: "115.00",
      currency: "EUR",
    })
  })

  it("returns undefined fields rather than throwing on a truncated response", () => {
    expect(readPayPalCapture({})).toEqual({
      reference: undefined,
      amountMajor: undefined,
      currency: undefined,
    })
    expect(readPayPalCapture({ purchase_units: [] }).reference).toBeUndefined()
    expect(
      readPayPalCapture({ purchase_units: [{ reference_id: "orders:1" }] }).amountMajor
    ).toBeUndefined()
  })

  it("feeds a truncated capture straight into a rejection", () => {
    // A response missing purchase_units must not settle anything.
    const parsed = readPayPalCapture({})
    const error = rejection(() =>
      assertSettlesOrder({ provider: "paypal", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("reference_missing")
  })
})

// ============================================================================
// Stripe
//
// Stripe reached this guard last, and for a different reason than the other
// two. `verifyCheckoutSession` derives the order from the SAME session's
// metadata, so there is no cross-order replay to close on that path. What the
// binding closes is the amount: `amount_total` was written to the payment
// record with nothing ever compared to it.
// ============================================================================

describe("Stripe settlement", () => {
  it("accepts stripe as a provider", () => {
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    ).not.toThrow()
  })

  it("refuses Stripe's minor units fed into the major-unit field", () => {
    // THE 100x TRAP, and the reason `amountMinor` exists at all.
    //
    // `amountMajor` is documented as euros and runs through `toMinorUnits`,
    // which multiplies by 100. Stripe's `amount_total` is ALREADY cents. Wiring
    // it to `amountMajor` turns a correct 115 EUR payment into 1_150_000 c
    // against an 11_500 c order and rejects EVERY legitimate Stripe payment —
    // the product goes down, not the attack.
    //
    // The naive repair is worse than the bug: dividing by 100 at the call site
    // reintroduces the float rounding `toMinorUnits` exists to avoid, and it is
    // simply wrong for zero-decimal currencies like JPY.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMajor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_mismatch")

    // The same number in the right field is the same payment, accepted.
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "EUR",
        },
        ORDER
      )
    ).not.toThrow()
  })

  it("refuses a session that settled less than the order total", () => {
    // An order edited after the session was created, a Stripe-side coupon, or a
    // stale session for an earlier cart. All three used to mark the order paid.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 10_000,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_mismatch")
  })

  it("refuses a non-integer minor amount rather than rounding it", () => {
    // Cents are integers. Rounding 11500.5 into 11500 would be the guard
    // inventing the number it is meant to be checking.
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500.5,
          currency: "EUR",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("amount_missing")
  })

  it("accepts a zero-amount settlement against a zero-total order", () => {
    // `amountMinor: 0` is a real amount, not a missing one — the falsy-check
    // mistake that `toMinorUnits` was written to avoid on the major side.
    expect(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:free",
          amountMinor: 0,
          currency: "EUR",
        },
        { orderId: "orders:free", total: 0 }
      )
    ).not.toThrow()
  })

  it("refuses a session paid in another currency", () => {
    const error = rejection(() =>
      assertSettlesOrder(
        {
          provider: "stripe",
          reference: "orders:1",
          amountMinor: 11_500,
          currency: "USD",
        },
        ORDER
      )
    )
    expect(error.reason).toBe("currency_mismatch")
  })
})

// ============================================================================
// Stripe checkout session parsing
// ============================================================================

describe("readStripeCheckoutSession", () => {
  it("pulls the reference, minor amount and intent out of a real session", () => {
    expect(
      readStripeCheckoutSession({
        id: "cs_test_1",
        amount_total: 11_500,
        currency: "eur",
        payment_intent: "pi_123",
        metadata: { orderId: "orders:1", storeId: "stores:1" },
      })
    ).toEqual({
      reference: "orders:1",
      amountMinor: 11_500,
      currency: "EUR",
      paymentIntentId: "pi_123",
    })
  })

  it("reads an expanded payment_intent object as well as a bare id", () => {
    expect(
      readStripeCheckoutSession({
        id: "cs_test_1",
        amount_total: 11_500,
        currency: "eur",
        payment_intent: { id: "pi_expanded" },
        metadata: { orderId: "orders:1" },
      }).paymentIntentId
    ).toBe("pi_expanded")
  })

  it("falls back to the session id when there is no intent", () => {
    // Never an empty string: `routeRefund` treats a payment with no externalId
    // as unrefundable, so a charge recorded that way could never be given back.
    expect(
      readStripeCheckoutSession({ id: "cs_test_1", metadata: { orderId: "orders:1" } })
        .paymentIntentId
    ).toBe("cs_test_1")
  })

  it("feeds a truncated session straight into a rejection", () => {
    const parsed = readStripeCheckoutSession({ id: "cs_test_1" })
    const error = rejection(() =>
      assertSettlesOrder({ provider: "stripe", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("reference_missing")
  })

  it("rejects on the amount when the reference is present but the total is not", () => {
    const parsed = readStripeCheckoutSession({
      id: "cs_test_1",
      metadata: { orderId: "orders:1" },
    })
    const error = rejection(() =>
      assertSettlesOrder({ provider: "stripe", ...parsed }, ORDER)
    )
    expect(error.reason).toBe("amount_missing")
  })
})

// ============================================================================
// What a settlement does to the ORDER
// ============================================================================

// ============================================================================
// One order is collected once — #378
// ============================================================================

describe("collection through a method the order has left", () => {
  /** A card claim, as Stripe reports one: minor units, our order id. */
  function card(over: Partial<SettlementClaim> = {}): SettlementClaim {
    return { provider: "stripe", reference: "orders:1", amountMinor: 11_500, currency: "EUR", ...over }
  }

  it("refuses a card settlement on an order already paid in cash", () => {
    // THE BUG. A diner abandons Stripe, confirms « Espèces » on the same
    // checkout attempt (#374 re-methods the reused order), and staff take the
    // notes. The Stripe session stays payable for ~24 h; completing it settled
    // the SAME order a second time. Identity, currency and amount all match —
    // it is genuinely this order at this total — so nothing above this check
    // could refuse it, and `paymentStatusAfterSettlement` answers null for an
    // already-paid order so even the order looked untouched.
    const error = rejection(() =>
      assertSettlesOrder(card(), {
        ...ORDER,
        paymentMethod: "cash",
        paymentStatus: "paid",
      })
    )

    expect(error.reason).toBe("method_mismatch")
    expect(error.provider).toBe("stripe")
    expect(error.message).toContain("déjà")
  })

  it("still settles a card payment that arrives FIRST", () => {
    // The guard has to be about the method in force at settlement time, not
    // about ordering. A rule satisfied by refusing everything would take the
    // diner's money and record nothing.
    expect(() =>
      assertSettlesOrder(card(), {
        ...ORDER,
        paymentMethod: "card",
        paymentStatus: "pending",
      })
    ).not.toThrow()
  })

  it("lets a replayed webhook through on the order it itself paid", () => {
    // Stripe redelivers for up to three days and the return page settles the
    // same charge from a different event. Both arrive on an order that is
    // already `paid` by card. Throwing here would be a 500 answered with three
    // days of retries — and `settlePayment` already makes the second write a
    // no-op, which is where deduplication belongs.
    //
    // READ THIS WITH #411 IN MIND. A SECOND card session on the same order
    // presents itself to this function in exactly the shape below — card
    // claim, card order, already paid — and is waved through for the same
    // reason. That is not a hole in this check; it is the limit of what this
    // function is given. It sees one claim and one order and no charges, so it
    // cannot tell a redelivery of the charge that paid the order from a
    // different charge that is about to pay it again. Only the ledger can, and
    // `payments.settlePayment` is where it does.
    expect(() =>
      assertSettlesOrder(card(), {
        ...ORDER,
        paymentMethod: "card",
        paymentStatus: "paid",
      })
    ).not.toThrow()
  })

  it("settles a card order through either card provider", () => {
    // A deployment picks one of Stripe and SumUp, and which one is a store
    // setting the order does not record. Both are "card". Which is also why
    // this check cannot separate two card collections from each other — see
    // the replay case above, and `payments.settlePayment` for the rule that
    // can (#411).
    expect(() =>
      assertSettlesOrder(claim({ provider: "sumup" }), {
        ...ORDER,
        paymentMethod: "card",
        paymentStatus: "paid",
      })
    ).not.toThrow()
  })

  it("refuses a card settlement on a PayPal order, and the reverse", () => {
    expect(
      rejection(() =>
        assertSettlesOrder(card(), {
          ...ORDER,
          paymentMethod: "paypal",
          paymentStatus: "paid",
        })
      ).reason
    ).toBe("method_mismatch")

    expect(
      rejection(() =>
        assertSettlesOrder(claim({ provider: "paypal" }), {
          ...ORDER,
          paymentMethod: "card",
          paymentStatus: "paid",
        })
      ).reason
    ).toBe("method_mismatch")
  })

  it("counts every status in which money has already moved", () => {
    // `refund_pending` is paid-then-cancelled and `partially_refunded` still
    // holds part of the money. A second collection on top of either is a second
    // collection, so all three refuse alike.
    for (const paymentStatus of ["paid", "refund_pending", "refunded", "partially_refunded"]) {
      expect(
        rejection(() =>
          assertSettlesOrder(card(), { ...ORDER, paymentMethod: "cash", paymentStatus })
        ).reason
      ).toBe("method_mismatch")
    }
  })

  it("settles a cash-labelled order that nothing has collected yet", () => {
    // The lesser variant of #378: the order was re-methoded to cash and no
    // notes were taken. The card money HAS left the diner's account by the time
    // this runs, so refusing it would strand a real payment. The session expiry
    // is what stops this happening at all; the guard only refuses a SECOND
    // collection.
    expect(() =>
      assertSettlesOrder(card(), {
        ...ORDER,
        paymentMethod: "cash",
        paymentStatus: "pending",
      })
    ).not.toThrow()
  })

  it("waves through an order that records no method at all", () => {
    // Uber Eats and Deliveroo orders carry none, and neither does anything
    // written before the field existed. A guard may not refuse on evidence it
    // does not have.
    for (const paymentMethod of [undefined, null, ""]) {
      expect(() =>
        assertSettlesOrder(card(), { ...ORDER, paymentMethod, paymentStatus: "paid" })
      ).not.toThrow()
    }
  })

  it("waves through when the order's payment status is unknown", () => {
    expect(() =>
      assertSettlesOrder(card(), { ...ORDER, paymentMethod: "cash" })
    ).not.toThrow()
  })

  it("checks the method last, so a mismatched amount is still reported as one", () => {
    // Both are refusals; the reason is what an operator reads to know which
    // problem they have.
    expect(
      rejection(() =>
        assertSettlesOrder(card({ amountMinor: 1 }), {
          ...ORDER,
          paymentMethod: "cash",
          paymentStatus: "paid",
        })
      ).reason
    ).toBe("amount_mismatch")
  })
})

describe("paymentStatusAfterSettlement", () => {
  it("marks a pending order paid", () => {
    expect(
      paymentStatusAfterSettlement({ status: "confirmed", paymentStatus: "pending" })
    ).toBe("paid")
  })

  it("does nothing to an order that is already paid", () => {
    expect(
      paymentStatusAfterSettlement({ status: "confirmed", paymentStatus: "paid" })
    ).toBeNull()
  })

  it("does not write paid over a refund the customer is still owed", () => {
    // THE BUG. Issue #128 made a cancelled paid order sit at "refund_pending":
    // money owed back, a human still has to send it. All four provider
    // settlement paths guarded with `if (order.paymentStatus !== "paid")`, and
    // "refund_pending" !== "paid" is TRUE — so a Stripe retry (they run for up
    // to three days) or a guest refreshing the success tab entered the branch
    // and wrote "paid" back over the marker. The refund banner and the
    // "Rembourser le client" action then vanish from the admin and NOTHING
    // records that money is owed.
    expect(
      paymentStatusAfterSettlement({
        status: "cancelled",
        paymentStatus: "refund_pending",
      })
    ).toBeNull()
  })

  it("does not write paid over a refund that has already been made", () => {
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "refunded" })
    ).toBeNull()
    expect(
      paymentStatusAfterSettlement({
        status: "completed",
        paymentStatus: "partially_refunded",
      })
    ).toBeNull()
  })

  it("owes money back when a settlement lands on a cancelled order", () => {
    // A payment that arrives for something nobody will deliver is not "paid",
    // it is owed back. Same conclusion `payments.releaseRefund` reaches for a
    // cancelled order, reached the same way.
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "pending" })
    ).toBe("refund_pending")
  })

  it("repairs a cancelled order the old code had already flipped to paid", () => {
    // The residue of the bug: cancelled + paid, with no marker saying money is
    // owed. A later delivery of the same charge now corrects it instead of
    // confirming it.
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: "paid" })
    ).toBe("refund_pending")
  })

  it("converges — a second settlement after the repair writes nothing", () => {
    const first = paymentStatusAfterSettlement({
      status: "cancelled",
      paymentStatus: "paid",
    })
    expect(first).toBe("refund_pending")
    expect(
      paymentStatusAfterSettlement({ status: "cancelled", paymentStatus: first! })
    ).toBeNull()
  })

  it("settles an order that had failed a previous attempt", () => {
    // A retry with a new session is a legitimate payment.
    expect(
      paymentStatusAfterSettlement({ status: "pending", paymentStatus: "failed" })
    ).toBe("paid")
  })
})
// ============================================================================
// orderAlreadyCollected — the list, shared instead of copied
// ============================================================================

describe("orderAlreadyCollected", () => {
  it("counts every status in which money has already moved", () => {
    for (const status of ["paid", "refund_pending", "refunded", "partially_refunded"]) {
      expect(orderAlreadyCollected(status), status).toBe(true)
    }
  })

  it("does not count an order nothing has collected yet", () => {
    expect(orderAlreadyCollected("pending")).toBe(false)
    expect(orderAlreadyCollected("failed")).toBe(false)
  })

  it("says no when there is no status to read", () => {
    // A guard may not invent the fact it is checking. Absent evidence is not
    // evidence of a collection, and refusing on it would refuse real payments.
    expect(orderAlreadyCollected(undefined)).toBe(false)
    expect(orderAlreadyCollected(null)).toBe(false)
    expect(orderAlreadyCollected("")).toBe(false)
  })

  it("is the same list `assertSettlesOrder` refuses on", () => {
    // Guards the guard: the predicate and the check that uses it were three
    // hand-written copies of one list before this existed.
    for (const status of ["paid", "refund_pending", "refunded", "partially_refunded"]) {
      expect(
        rejection(() =>
          assertSettlesOrder(
            { provider: "stripe", reference: "orders:1", amountMinor: 11_500, currency: "EUR" },
            { ...ORDER, paymentMethod: "cash", paymentStatus: status }
          )
        ).reason,
        status
      ).toBe("method_mismatch")
    }
  })
})

// ============================================================================
// Telling a refusal from a failure
// ============================================================================

describe("deliberateSettlementRefusal", () => {
  /**
   * THE BUG IT EXISTS FOR (#411, B2-F2). The Stripe webhook answered 500 to
   * every throw, refusals included. A refusal is permanent — retrying delivers
   * the same answer — so Stripe retried for three days, the delivery stayed
   * unprocessed, and the only trace was a `console.error` in one client's
   * Convex dashboard. Nobody was told a diner had been charged twice.
   *
   * The reader has to work ACROSS A CONVEX BOUNDARY, which is the part that is
   * easy to get wrong: these refusals are thrown inside a mutation and caught
   * in the `httpAction` above it. Convex rebuilds the error there from its
   * `data`, so the caller holds a `ConvexError` and never an instance of the
   * class that threw. `instanceof` is false at exactly the call site that
   * matters, and it fails closed into "unknown error, answer 500" — the loop
   * this is meant to end.
   */
  it("recognises a settlement rejection", () => {
    const error = new SettlementRejectedError(
      "amount_mismatch",
      "stripe",
      "stripe: montant réglé 100 c, total de la commande 11500 c."
    )
    expect(deliberateSettlementRefusal(error)).toEqual({
      code: "amount_mismatch",
      message: "stripe: montant réglé 100 c, total de la commande 11500 c.",
    })
  })

  it("recognises a double collection", () => {
    const error = new DoubleCollectionError(
      "order_already_collected",
      "Cette commande a déjà été encaissée (stripe)."
    )
    expect(isDeliberateSettlementRefusal(error)).toBe(true)
    expect(deliberateSettlementRefusal(error)?.code).toBe(
      "order_already_collected"
    )
  })

  it("reads a refusal that crossed a function boundary as an object", () => {
    // What a caller one layer up actually holds: the data, on something that
    // is not an instance of anything in this module.
    const acrossTheWire = Object.assign(new Error("Server Error"), {
      data: { code: "order_already_collected", message: "déjà encaissée" },
    })
    expect(deliberateSettlementRefusal(acrossTheWire)).toEqual({
      code: "order_already_collected",
      message: "déjà encaissée",
    })
  })

  it("reads a refusal whose data arrived as JSON, which is what convex-test hands back", () => {
    const serialized = Object.assign(new Error("Server Error"), {
      data: JSON.stringify({ code: "method_mismatch", message: "déjà réglée" }),
    })
    expect(deliberateSettlementRefusal(serialized)?.code).toBe("method_mismatch")
  })

  it("refuses to call a plain failure a refusal", () => {
    // The half that matters most: a bug, an outage or a timeout must still
    // answer 500 so the provider retries it. Reading those as refusals would
    // mark a lost delivery processed and never look at it again.
    expect(isDeliberateSettlementRefusal(new TypeError("undefined is not a function"))).toBe(false)
    expect(isDeliberateSettlementRefusal(new Error("Payment amount must be positive"))).toBe(false)
    expect(isDeliberateSettlementRefusal(null)).toBe(false)
    expect(isDeliberateSettlementRefusal(undefined)).toBe(false)
    expect(isDeliberateSettlementRefusal("boom")).toBe(false)
  })

  it("refuses a ConvexError carrying some other code", () => {
    // A `RefusalError` from the order path — a sold-out dish, a delivery
    // radius — is not a settlement refusal, and answering 200 to one would
    // drop a delivery that had genuinely failed.
    const other = Object.assign(new Error("épuisé"), {
      data: { code: "out_of_stock", message: "« Pizza » est épuisé." },
    })
    expect(isDeliberateSettlementRefusal(other)).toBe(false)
  })

  it("does not choke on data that is not JSON, or not an object", () => {
    for (const data of ["not json at all", 42, [1, 2, 3], true]) {
      expect(
        isDeliberateSettlementRefusal(Object.assign(new Error("x"), { data }))
      ).toBe(false)
    }
  })

  it("carries the French sentence through, because that is what gets recorded", () => {
    const error = new DoubleCollectionError(
      "charge_settles_another_order",
      "Ce paiement stripe règle déjà la commande orders:9."
    )
    expect(deliberateSettlementRefusal(error)?.message).toContain("orders:9")
  })
})
