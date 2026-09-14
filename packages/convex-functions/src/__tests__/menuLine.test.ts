import { describe, expect, it } from "vitest"

import {
  MAX_SECTION_CHOICES,
  MenuRejectedError,
  allocateBundlePrice,
  choiceBounds,
  verifyMenuSelection,
  type MenuChoiceProduct,
  type MenuSection,
  type OrderableMenu,
} from "../menuLine"

/**
 * A *formule* the customer composed, verified and priced (#352).
 *
 * WHAT THIS GUARDS. `orders.create` refused every line with no `productId`,
 * which is exactly what a bundle is — so the admin could build formules, the
 * guided tour promised them on first login, seven customer strings were
 * translated into three languages, and no diner could ever buy one.
 *
 * The two things worth pinning here are money, not markup: the split of one
 * fixed price across dishes taxed at different rates, and the refusals that stop
 * a diner putting the 38 € plateau into an 18 € formule.
 */

const NOW = 1_700_000_000_000

function section(over: Partial<MenuSection> = {}): MenuSection {
  return {
    sectionId: "s1",
    label: "Plat",
    type: "pick_products",
    required: true,
    minChoices: 1,
    maxChoices: 1,
    allowDuplicates: false,
    sortOrder: 0,
    ...over,
  }
}

function product(over: Partial<MenuChoiceProduct> = {}): MenuChoiceProduct {
  return {
    name: "Risotto",
    price: 1_600,
    isActive: true,
    taxRate: 10,
    ...over,
  }
}

function menu(over: Partial<OrderableMenu> = {}): OrderableMenu {
  return {
    name: "Formule Midi",
    price: 1_800,
    isActive: true,
    sections: [section()],
    ...over,
  }
}

const verify = (params: {
  menu: OrderableMenu
  choices: Parameters<typeof verifyMenuSelection>[0]["choices"]
  products: Record<string, MenuChoiceProduct>
}) =>
  verifyMenuSelection({
    menu: params.menu,
    choices: params.choices,
    products: new Map(Object.entries(params.products)),
    taxRatePercent: 20,
    now: NOW,
  })

describe("allocateBundlePrice", () => {
  it("splits pro rata on à-la-carte value", () => {
    // A 4 € coffee and a 16 € main sold at 18 € are not two 9 € dishes. If they
    // are taxed at different rates, an even split moves taxable base from one
    // rate to the other and the VAT owed is wrong.
    expect(allocateBundlePrice(1_800, [400, 1_600])).toEqual([360, 1_440])
  })

  it("always sums to exactly the bundle price", () => {
    // Integer cents rarely divide. 1000 across three equal dishes floors to
    // 333 × 3 = 999, and the missing centime has to land somewhere.
    const shares = allocateBundlePrice(1_000, [100, 100, 100])
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1_000)
  })

  it("gives the leftover centime to the largest share", () => {
    // The smallest possible distortion: the rounding lands on the rate with the
    // biggest taxable base.
    expect(allocateBundlePrice(1_000, [100, 300])).toEqual([250, 750])
    const shares = allocateBundlePrice(1_001, [100, 300])
    expect(shares[1]).toBeGreaterThan(shares[0]!)
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1_001)
  })

  it("is deterministic, so two runs bill the same", () => {
    // An invoice is a numbered fiscal document; the same basket must not produce
    // two different ones. Ties are broken by position.
    const once = allocateBundlePrice(1_000, [100, 100, 100])
    const twice = allocateBundlePrice(1_000, [100, 100, 100])
    expect(once).toEqual(twice)
    expect(once).toEqual([334, 333, 333])
  })

  it("splits evenly when nothing has an à-la-carte value", () => {
    // Every dish free — which a promotion-priced product can produce — leaves no
    // ratio to divide by, and no dish with a claim on more of the bundle.
    expect(allocateBundlePrice(900, [0, 0, 0])).toEqual([300, 300, 300])
  })

  it("gives nothing away on an empty formule", () => {
    expect(allocateBundlePrice(1_800, [])).toEqual([])
  })

  it("handles a free formule", () => {
    // A 0 € bundle is a real thing: a prize, a staff meal.
    expect(allocateBundlePrice(0, [400, 1_600])).toEqual([0, 0])
  })
})

describe("choiceBounds", () => {
  it("makes a fixed section exactly one, whatever is stored", () => {
    // The dish IS the section, and the admin form does not offer the counts.
    expect(choiceBounds(section({ type: "fixed", minChoices: 0, maxChoices: 9 }))).toEqual({
      min: 1,
      max: 1,
    })
  })

  it("reads a required section with minChoices 0 as needing one", () => {
    // "Required" and "zero needed" cannot both be true, and a row saved that way
    // would be a mandatory row the diner could skip.
    expect(choiceBounds(section({ required: true, minChoices: 0 })).min).toBe(1)
  })

  it("lets an optional section take none", () => {
    expect(choiceBounds(section({ required: false, minChoices: 0 })).min).toBe(0)
  })

  it("caps a section that asks for an absurd number", () => {
    expect(choiceBounds(section({ maxChoices: 500 })).max).toBe(MAX_SECTION_CHOICES)
  })
})

describe("verifyMenuSelection", () => {
  it("prices the dishes at their shares, summing to the formule", () => {
    const result = verify({
      menu: menu({
        price: 1_800,
        sections: [
          section({ sectionId: "s1", label: "Entrée", productIds: ["p1"] }),
          section({ sectionId: "s2", label: "Plat", productIds: ["p2"], sortOrder: 1 }),
        ],
      }),
      choices: [
        { sectionId: "s1", productId: "p1" },
        { sectionId: "s2", productId: "p2" },
      ],
      products: {
        p1: product({ name: "Burrata", price: 400 }),
        p2: product({ name: "Risotto", price: 1_600 }),
      },
    })
    expect(result.choices.map((c) => c.subtotal)).toEqual([360, 1_440])
    expect(result.choices.reduce((sum, c) => sum + c.subtotal, 0)).toBe(1_800)
  })

  it("keeps each dish's own VAT rate on its share", () => {
    // The whole reason the split exists. A bundle of food at 10 % and wine at
    // 20 % owes VAT at both rates, and one `taxAmount` cannot express that.
    const result = verify({
      menu: menu({
        price: 2_000,
        sections: [
          section({ sectionId: "s1", label: "Plat", productIds: ["p1"] }),
          section({ sectionId: "s2", label: "Vin", productIds: ["p2"], sortOrder: 1 }),
        ],
      }),
      choices: [
        { sectionId: "s1", productId: "p1" },
        { sectionId: "s2", productId: "p2" },
      ],
      products: {
        p1: product({ name: "Risotto", price: 1_500, taxRate: 10 }),
        p2: product({ name: "Verre de rouge", price: 500, taxRate: 20 }),
      },
    })
    expect(result.choices.map((c) => c.taxRatePercent)).toEqual([10, 20])
  })

  it("falls back to the deployment rate for a product with none", () => {
    const result = verify({
      menu: menu({ sections: [section({ productIds: ["p1"] })] }),
      choices: [{ sectionId: "s1", productId: "p1" }],
      products: { p1: { name: "Risotto", price: 1_600, isActive: true } },
    })
    expect(result.choices[0]!.taxRatePercent).toBe(20)
  })

  it("keeps the à-la-carte value beside the share", () => {
    // Both are on the row so a reader can check the split rather than trust it.
    const result = verify({
      menu: menu({ price: 1_000, sections: [section({ productIds: ["p1"] })] }),
      choices: [{ sectionId: "s1", productId: "p1" }],
      products: { p1: product({ price: 1_600 }) },
    })
    expect(result.choices[0]).toMatchObject({ alaCarteSubtotal: 1_600, subtotal: 1_000 })
  })

  it("fills in a fixed section the storefront did not send", () => {
    // The dish is the section, so a storefront that sends only the picks still
    // composes a valid formule.
    const result = verify({
      menu: menu({
        sections: [section({ type: "fixed", label: "Plat du jour", productId: "p1" })],
      }),
      choices: [],
      products: { p1: product() },
    })
    expect(result.choices).toHaveLength(1)
    expect(result.choices[0]!.productName).toBe("Risotto")
  })

  it("reads the sections in their own order, not the order they arrive in", () => {
    const result = verify({
      menu: menu({
        sections: [
          section({ sectionId: "s2", label: "Dessert", productIds: ["p2"], sortOrder: 2 }),
          section({ sectionId: "s1", label: "Plat", productIds: ["p1"], sortOrder: 1 }),
        ],
      }),
      choices: [
        { sectionId: "s2", productId: "p2" },
        { sectionId: "s1", productId: "p1" },
      ],
      products: { p1: product({ name: "Risotto" }), p2: product({ name: "Tiramisu" }) },
    })
    expect(result.choices.map((c) => c.sectionLabel)).toEqual(["Plat", "Dessert"])
  })

  it("takes the longest preparation time, not the sum", () => {
    // A kitchen cooks in parallel. Same rule as `summariseOrderLines`.
    const result = verify({
      menu: menu({
        sections: [
          section({ sectionId: "s1", productIds: ["p1"] }),
          section({ sectionId: "s2", productIds: ["p2"], sortOrder: 1 }),
        ],
      }),
      choices: [
        { sectionId: "s1", productId: "p1" },
        { sectionId: "s2", productId: "p2" },
      ],
      products: {
        p1: product({ preparationTime: 20 }),
        p2: product({ name: "Tiramisu", preparationTime: 5 }),
      },
    })
    expect(result.preparationTime).toBe(20)
  })
})

describe("verifyMenuSelection refuses", () => {
  const expectRefusal = (
    reason: string,
    run: () => unknown
  ) => {
    try {
      run()
    } catch (error) {
      expect(error).toBeInstanceOf(MenuRejectedError)
      expect((error as MenuRejectedError).reason).toBe(reason)
      return
    }
    throw new Error(`expected a refusal with reason ${reason}`)
  }

  it("a deactivated formule", () => {
    expectRefusal("menu_inactive", () =>
      verify({
        menu: menu({ isActive: false }),
        choices: [{ sectionId: "s1", productId: "p1" }],
        products: { p1: product() },
      })
    )
  })

  it("a formule with no sections at all", () => {
    // The admin form cannot save one; a row written before it could, or by a
    // script, can — and it is a price with nothing behind it.
    expectRefusal("menu_empty", () =>
      verify({ menu: menu({ sections: [] }), choices: [], products: {} })
    )
  })

  it("a required section nobody filled", () => {
    expectRefusal("missing_section", () =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [],
        products: { p1: product() },
      })
    )
  })

  it("a dish the section does not offer", () => {
    // THE REFUSAL THAT MATTERS MOST. Without it a diner puts the 38 € plateau
    // into the « dessert au choix » row of an 18 € formule.
    expectRefusal("choice_not_offered", () =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [{ sectionId: "s1", productId: "p_expensive" }],
        products: { p_expensive: product({ name: "Plateau", price: 3_800 }) },
      })
    )
  })

  it("a dish that is not in the catalogue", () => {
    expectRefusal("choice_not_offered", () =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [{ sectionId: "s1", productId: "p1" }],
        products: {},
      })
    )
  })

  it("a dish from another category than the section's", () => {
    expectRefusal("choice_not_offered", () =>
      verify({
        menu: menu({
          sections: [section({ type: "pick_category", categoryId: "c_desserts" })],
        }),
        choices: [{ sectionId: "s1", productId: "p1" }],
        products: { p1: product({ categoryId: "c_mains" }) },
      })
    )
  })

  it("more dishes than the section accepts", () => {
    expectRefusal("too_many_choices", () =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1", "p2"], maxChoices: 1 })] }),
        choices: [
          { sectionId: "s1", productId: "p1" },
          { sectionId: "s1", productId: "p2" },
        ],
        products: { p1: product(), p2: product({ name: "Tiramisu" }) },
      })
    )
  })

  it("the same dish twice where duplicates are not allowed", () => {
    expectRefusal("duplicate_choice", () =>
      verify({
        menu: menu({
          sections: [
            section({ productIds: ["p1"], maxChoices: 2, allowDuplicates: false }),
          ],
        }),
        choices: [
          { sectionId: "s1", productId: "p1" },
          { sectionId: "s1", productId: "p1" },
        ],
        products: { p1: product() },
      })
    )
  })

  it("a choice naming a section this formule no longer has", () => {
    // A basket saved in a browser before the owner rewrote the formule.
    expectRefusal("unknown_section", () =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [
          { sectionId: "s1", productId: "p1" },
          { sectionId: "s_gone", productId: "p1" },
        ],
        products: { p1: product() },
      })
    )
  })

  it("a dish that is sold out, through the à-la-carte gate", () => {
    // A formule that silently dropped a sold-out dish would send the kitchen a
    // bundle it cannot make. The refusal comes from `verifyOrderLine`, which is
    // the point: a formule is refused for the same reasons a dish is.
    expect(() =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [{ sectionId: "s1", productId: "p1" }],
        products: { p1: product({ stock: { tracked: true, quantity: 0 } }) },
      })
    ).toThrow(/épuisé/)
  })

  it("a deactivated dish, through the same gate", () => {
    expect(() =>
      verify({
        menu: menu({ sections: [section({ productIds: ["p1"] })] }),
        choices: [{ sectionId: "s1", productId: "p1" }],
        products: { p1: product({ isActive: false }) },
      })
    ).toThrow(/n'est plus disponible/)
  })

  it("allows an optional section to be skipped", () => {
    const result = verify({
      menu: menu({
        sections: [
          section({ sectionId: "s1", productIds: ["p1"] }),
          section({
            sectionId: "s2",
            label: "Dessert",
            productIds: ["p2"],
            required: false,
            minChoices: 0,
            sortOrder: 1,
          }),
        ],
      }),
      choices: [{ sectionId: "s1", productId: "p1" }],
      products: { p1: product(), p2: product({ name: "Tiramisu" }) },
    })
    expect(result.choices).toHaveLength(1)
    expect(result.choices[0]!.subtotal).toBe(1_800)
  })

  it("names the section a refusal is about", () => {
    // So a screen can point at the row the diner has to fix rather than
    // reprinting the sentence at the top of the dialog.
    try {
      verify({
        menu: menu({ sections: [section({ label: "Dessert au choix", productIds: ["p1"] })] }),
        choices: [],
        products: { p1: product() },
      })
      throw new Error("expected a refusal")
    } catch (error) {
      expect((error as MenuRejectedError).sectionLabel).toBe("Dessert au choix")
      expect((error as MenuRejectedError).message).toContain("Dessert au choix")
    }
  })
})
