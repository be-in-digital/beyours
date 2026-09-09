import { describe, it, expect } from "vitest"
import {
  verifyOrderLine,
  resolveSelectedOptions,
  isWithinSchedulingWindow,
  restaurantClock,
  LineRejectedError,
  MAX_LINE_QUANTITY,
  type OrderableProduct,
  type SelectedOptionInput,
} from "../orderLine"

/** Tuesday 3 July 2029, 12:00 UTC — 14:00 in Paris, in the middle of service. */
const NOON_UTC = Date.UTC(2029, 6, 3, 12, 0, 0)

function pizza(overrides: Partial<OrderableProduct> = {}): OrderableProduct {
  return {
    name: "Margherita",
    price: 1200,
    isActive: true,
    options: [
      {
        id: "opt_size",
        name: "Taille",
        required: true,
        maxSelections: 1,
        choices: [
          { id: "ch_small", name: "Petite", priceModifier: 0 },
          { id: "ch_large", name: "Grande", priceModifier: 300 },
        ],
      },
      {
        id: "opt_extras",
        name: "Suppléments",
        required: false,
        maxSelections: 2,
        choices: [
          { id: "ch_cheese", name: "Extra fromage", priceModifier: 150 },
          { id: "ch_no_onion", name: "Sans oignon", priceModifier: -100 },
        ],
      },
    ],
    ...overrides,
  }
}

/** What the checkout actually sends: names, no ids. */
function pick(optionName: string, choiceName: string): SelectedOptionInput {
  return { optionName, choiceName, priceModifier: 0 }
}

const SIZE_SMALL = pick("Taille", "Petite")

function reasonOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    if (error instanceof LineRejectedError) return error.reason
    throw error
  }
  throw new Error("expected a rejection, got none")
}

describe("a line the kitchen can serve", () => {
  it("prices from the product, not from what the client sent", () => {
    const line = verifyOrderLine({
      product: pizza(),
      quantity: 2,
      selectedOptions: [
        { optionName: "Taille", choiceName: "Grande", priceModifier: -9999 },
      ],
      now: NOON_UTC,
      timezone: "Europe/Paris",
    })

    expect(line.unitPrice).toBe(1200)
    expect(line.subtotal).toBe((1200 + 300) * 2)
    expect(line.selectedOptions).toEqual([
      {
        optionId: "opt_size",
        optionName: "Taille",
        choiceId: "ch_large",
        choiceName: "Grande",
        priceModifier: 300,
      },
    ])
  })

  it("accepts a product with no options at all", () => {
    const line = verifyOrderLine({
      product: { name: "Café", price: 200, isActive: true },
      quantity: 1,
      selectedOptions: [],
      now: NOON_UTC,
    })

    expect(line.subtotal).toBe(200)
  })
})

describe("a product that is switched off", () => {
  it("is refused even though the cart still holds it", () => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza({ isActive: false }),
          quantity: 1,
          selectedOptions: [SIZE_SMALL],
          now: NOON_UTC,
        })
      )
    ).toBe("inactive")
  })

  it("names the dish, so the customer knows what to remove", () => {
    try {
      verifyOrderLine({
        product: pizza({ isActive: false }),
        quantity: 1,
        selectedOptions: [SIZE_SMALL],
        now: NOON_UTC,
      })
      throw new Error("expected a rejection")
    } catch (error) {
      expect((error as LineRejectedError).message).toContain("Margherita")
    }
  })
})

describe("stock", () => {
  it("refuses more than the shelf holds", () => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza({ stock: { tracked: true, quantity: 2 } }),
          quantity: 3,
          selectedOptions: [SIZE_SMALL],
          now: NOON_UTC,
        })
      )
    ).toBe("insufficient_stock")
  })

  it("serves exactly what is left", () => {
    expect(() =>
      verifyOrderLine({
        product: pizza({ stock: { tracked: true, quantity: 3 } }),
        quantity: 3,
        selectedOptions: [SIZE_SMALL],
        now: NOON_UTC,
      })
    ).not.toThrow()
  })

  it("ignores a quantity nobody tracks", () => {
    expect(() =>
      verifyOrderLine({
        product: pizza({ stock: { tracked: false, quantity: 0 } }),
        quantity: 50,
        selectedOptions: [SIZE_SMALL],
        now: NOON_UTC,
      })
    ).not.toThrow()
  })

  it("says the dish is sold out rather than counting down from zero", () => {
    try {
      verifyOrderLine({
        product: pizza({ stock: { tracked: true, quantity: 0 } }),
        quantity: 1,
        selectedOptions: [SIZE_SMALL],
        now: NOON_UTC,
      })
      throw new Error("expected a rejection")
    } catch (error) {
      expect((error as LineRejectedError).message).toContain("épuisé")
    }
  })
})

describe("quantity", () => {
  it.each([0, -3, 1.5, Number.NaN])("refuses %p", (quantity) => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza(),
          quantity,
          selectedOptions: [SIZE_SMALL],
          now: NOON_UTC,
        })
      )
    ).toBe("invalid_quantity")
  })

  it("refuses a quantity past the ceiling", () => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza(),
          quantity: MAX_LINE_QUANTITY + 1,
          selectedOptions: [SIZE_SMALL],
          now: NOON_UTC,
        })
      )
    ).toBe("invalid_quantity")
  })
})

describe("the serving window", () => {
  const lunch = {
    scheduling: { availableFrom: "11:00", availableUntil: "14:00" },
  }

  it("is read on the restaurant's clock, not the server's", () => {
    // 12:00 UTC is 14:00 in Paris in July: the last minute of the lunch menu
    // there, and two hours from closing anywhere the server happens to run.
    expect(
      isWithinSchedulingWindow(lunch.scheduling, NOON_UTC, "Europe/Paris")
    ).toBe(true)

    // One minute later, Paris has moved past 14:00 and UTC has not.
    const past = NOON_UTC + 60_000
    expect(isWithinSchedulingWindow(lunch.scheduling, past, "Europe/Paris")).toBe(
      false
    )
    expect(isWithinSchedulingWindow(lunch.scheduling, past, "UTC")).toBe(true)
  })

  it("refuses a dish ordered outside its hours", () => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza(lunch),
          quantity: 1,
          selectedOptions: [SIZE_SMALL],
          now: Date.UTC(2029, 6, 3, 20, 0, 0),
          timezone: "Europe/Paris",
        })
      )
    ).toBe("outside_window")
  })

  it("refuses a dish on a day it is not served", () => {
    // 3 July 2029 is a Tuesday; this dish is Friday-only.
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza({ scheduling: { availableDays: [5] } }),
          quantity: 1,
          selectedOptions: [SIZE_SMALL],
          now: NOON_UTC,
          timezone: "Europe/Paris",
        })
      )
    ).toBe("outside_window")
  })

  it("serves a window that crosses midnight", () => {
    const lateNight = { availableFrom: "22:00", availableUntil: "02:00" }
    const oneAM = Date.UTC(2029, 6, 3, 23, 0, 0) // 01:00 Paris, Wednesday

    expect(isWithinSchedulingWindow(lateNight, oneAM, "Europe/Paris")).toBe(true)
    expect(
      isWithinSchedulingWindow(
        lateNight,
        Date.UTC(2029, 6, 3, 10, 0, 0),
        "Europe/Paris"
      )
    ).toBe(false)
  })

  it("counts the small hours as the evening that opened them", () => {
    const tuesdayLateNight = {
      availableFrom: "22:00",
      availableUntil: "02:00",
      availableDays: [2], // Tuesday
    }
    // 01:00 Paris on Wednesday — still Tuesday night to the restaurant.
    expect(
      isWithinSchedulingWindow(
        tuesdayLateNight,
        Date.UTC(2029, 6, 3, 23, 0, 0),
        "Europe/Paris"
      )
    ).toBe(true)
  })

  it("keeps serving when the timezone setting is nonsense", () => {
    // A typo in a settings row must not close the whole catalogue — that is
    // what this case has always been about, and it still holds.
    //
    // What changed is WHICH clock it falls back to. It was the server's, and
    // Convex runs in UTC, so a deployment that had never saved its settings —
    // `globalSettings` is a singleton nothing seeds — had its whole catalogue
    // scheduled two hours out for half the year. The fallback is now
    // `DEFAULT_RESTAURANT_TIMEZONE`, so a typo fails to the product's clock
    // instead of to the server's. 12:00 UTC on 3 July is 14:00 in Paris.
    expect(restaurantClock(NOON_UTC, "Mars/Olympus_Mons")).toEqual({
      day: 2,
      minutes: 14 * 60,
    })
  })
})

describe("options", () => {
  it("refuses a pizza ordered without the size the owner made mandatory", () => {
    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: pizza(),
          quantity: 1,
          selectedOptions: [],
          now: NOON_UTC,
        })
      )
    ).toBe("missing_required_option")
  })

  it("counts the same choice once, however many times it is sent", () => {
    const line = verifyOrderLine({
      product: pizza(),
      quantity: 1,
      selectedOptions: [
        SIZE_SMALL,
        ...Array.from({ length: 100 }, () =>
          pick("Suppléments", "Sans oignon")
        ),
      ],
      now: NOON_UTC,
    })

    // −1 € replayed a hundred times used to make the pizza free and then some.
    expect(line.subtotal).toBe(1200 - 100)
    expect(line.selectedOptions).toHaveLength(2)
  })

  it("refuses more choices than the group allows", () => {
    const oneOnly = pizza({
      options: [
        {
          id: "opt_size",
          name: "Taille",
          required: true,
          maxSelections: 1,
          choices: [
            { id: "ch_small", name: "Petite", priceModifier: 0 },
            { id: "ch_large", name: "Grande", priceModifier: 300 },
          ],
        },
      ],
    })

    expect(
      reasonOf(() =>
        verifyOrderLine({
          product: oneOnly,
          quantity: 1,
          selectedOptions: [SIZE_SMALL, pick("Taille", "Grande")],
          now: NOON_UTC,
        })
      )
    ).toBe("too_many_choices")
  })

  /**
   * REWRITTEN. This case used to read "treats a group with no declared maximum
   * as a single choice" and asserted `too_many_choices` — it blessed the
   * defect. Three other surfaces read an absent maximum as no maximum: the
   * storefront renders an uncapped checkbox group (a radio only at
   * `maxSelections === 1`), the admin's input offers « Illimité » as its
   * placeholder, and both platform syncs publish `choices.length`. Only this
   * check said one, and it said it at the moment of payment — so a diner who
   * ticked the two sauces the menu had just offered was refused, by a sentence
   * naming a maximum the owner never set.
   */
  it("lets a group with no declared maximum take every choice offered", () => {
    const product = pizza({
      options: [
        {
          id: "opt_sauce",
          name: "Sauce",
          required: false,
          choices: [
            { id: "ch_bbq", name: "BBQ", priceModifier: 50 },
            { id: "ch_algerienne", name: "Algérienne", priceModifier: 50 },
          ],
        },
      ],
    })

    const line = verifyOrderLine({
      product,
      quantity: 1,
      selectedOptions: [pick("Sauce", "BBQ"), pick("Sauce", "Algérienne")],
      now: NOON_UTC,
    })

    expect(line.selectedOptions).toHaveLength(2)
    // Both modifiers are charged: an accepted choice is a priced choice.
    expect(line.subtotal).toBe(1200 + 50 + 50)
  })

  it("still enforces a maximum the owner did set", () => {
    const product = pizza({
      options: [
        {
          id: "opt_sauce",
          name: "Sauce",
          required: false,
          maxSelections: 1,
          choices: [
            { id: "ch_bbq", name: "BBQ", priceModifier: 50 },
            { id: "ch_algerienne", name: "Algérienne", priceModifier: 50 },
          ],
        },
      ],
    })

    expect(
      reasonOf(() =>
        verifyOrderLine({
          product,
          quantity: 1,
          selectedOptions: [pick("Sauce", "BBQ"), pick("Sauce", "Algérienne")],
          now: NOON_UTC,
        })
      )
    ).toBe("too_many_choices")
  })

  it("refuses a choice the product no longer offers", () => {
    // It used to be kept at price 0 under the name the client sent — free text
    // from the customer, printed on the kitchen ticket.
    expect(
      reasonOf(() =>
        resolveSelectedOptions(pizza(), [
          SIZE_SMALL,
          pick("Suppléments", "et trois entrecôtes"),
        ])
      )
    ).toBe("unknown_choice")
  })

  it("drops an option group the product no longer has", () => {
    const resolved = resolveSelectedOptions(pizza(), [
      SIZE_SMALL,
      pick("Cuisson", "À point"),
    ])

    expect(resolved.map((o) => o.optionName)).toEqual(["Taille"])
  })

  it("never lets a removal discount pay for the rest of the basket", () => {
    const cheap = pizza({
      price: 50,
      options: [
        {
          id: "opt_extras",
          name: "Suppléments",
          required: false,
          maxSelections: 1,
          choices: [{ id: "ch_no_onion", name: "Sans oignon", priceModifier: -100 }],
        },
      ],
    })

    const line = verifyOrderLine({
      product: cheap,
      quantity: 3,
      selectedOptions: [pick("Suppléments", "Sans oignon")],
      now: NOON_UTC,
    })

    expect(line.subtotal).toBe(0)
  })
})
