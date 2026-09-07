/**
 * The product form must not refuse a product in silence.
 *
 * WHAT WENT WRONG: `maxSelections` was the one numeric field on this form
 * declared as a bare `z.number().int().min(1).optional()` while its four
 * siblings went through `optionalNumber`. The input registers with
 * `valueAsNumber: true`, so an empty box arrives as `NaN`; `NaN` is a number
 * and it is not `undefined`, so `.optional()` does not catch it and zod
 * refuses the field. react-hook-form then refuses the submit of the whole
 * product — and nothing on screen printed that field's error, so the
 * Enregistrer button simply stopped working. The placeholder « Illimité »
 * invites exactly the empty box that triggers it, on the first catalogue an
 * owner ever builds.
 *
 * The sweep at the bottom is the part that would have caught it: it walks
 * every optional number the schema declares — nested groups included — and
 * asserts each survives NaN. A sixth field added without the guard turns this
 * red on the day it is added, not on a client's first evening of service.
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  optionalNumber,
  productFormSchema,
} from "../pages/products/product-form-schema"

/** A product with everything the schema requires and nothing it does not. */
function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: "cat_1",
    name: "Pizza Margherita",
    slug: "pizza-margherita",
    priceEuros: 12,
    taxRate: 10,
    ...overrides,
  }
}

/** One option group, as the form's field array builds it. */
function optionGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "opt_sauce",
    name: "Sauce",
    required: false,
    choices: [{ id: "ch_bbq", name: "BBQ", priceModifier: 0 }],
    ...overrides,
  }
}

describe("« Sélections max » left empty", () => {
  it("is accepted, and means no limit", () => {
    const parsed = productFormSchema.safeParse(
      baseProduct({ options: [optionGroup({ maxSelections: Number.NaN })] })
    )

    expect(parsed.success).toBe(true)
    // Not 1, and not NaN: absent. `orders.create` reads an absent maximum as
    // no maximum, which is what the placeholder promises.
    expect(parsed.data?.options?.[0]?.maxSelections).toBeUndefined()
  })

  it("still refuses a maximum of zero, and says so on the field", () => {
    const parsed = productFormSchema.safeParse(
      baseProduct({ options: [optionGroup({ maxSelections: 0 })] })
    )

    expect(parsed.success).toBe(false)
    // The path is what the form renders the message under. A refusal with no
    // path is a refusal with nowhere to appear, which is how this field went
    // dead in the first place.
    expect(parsed.error?.issues[0]?.path).toEqual([
      "options",
      0,
      "maxSelections",
    ])
  })

  it("keeps a maximum the owner did type", () => {
    const parsed = productFormSchema.safeParse(
      baseProduct({ options: [optionGroup({ maxSelections: 3 })] })
    )

    expect(parsed.success).toBe(true)
    expect(parsed.data?.options?.[0]?.maxSelections).toBe(3)
  })
})

describe("every optional number on this form survives an empty input", () => {
  it("treats NaN as absent", () => {
    // `valueAsNumber` produces NaN for an empty box. Any optional number that
    // does not go through `optionalNumber` blocks the entire save.
    const parsed = productFormSchema.safeParse(
      baseProduct({
        compareAtPriceEuros: Number.NaN,
        preparationTime: Number.NaN,
        spiceLevel: Number.NaN,
        sortOrder: Number.NaN,
        options: [optionGroup({ maxSelections: Number.NaN })],
      })
    )

    expect(parsed.success).toBe(true)
    expect(parsed.data?.compareAtPriceEuros).toBeUndefined()
    expect(parsed.data?.preparationTime).toBeUndefined()
    expect(parsed.data?.spiceLevel).toBeUndefined()
    expect(parsed.data?.sortOrder).toBeUndefined()
    expect(parsed.data?.options?.[0]?.maxSelections).toBeUndefined()
  })

  it("guards the helper itself", () => {
    const guarded = optionalNumber(z.number().int().min(1))

    expect(guarded.safeParse(Number.NaN).success).toBe(true)
    expect(guarded.safeParse(Number.NaN).data).toBeUndefined()
    expect(guarded.safeParse(undefined).success).toBe(true)
    expect(guarded.safeParse(4).data).toBe(4)
    expect(guarded.safeParse(0).success).toBe(false)
  })
})
