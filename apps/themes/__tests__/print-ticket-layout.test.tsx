// @vitest-environment jsdom

/**
 * What the cook actually reads before plating.
 *
 * This component had no test of any kind, and it is the one surface where an
 * allergen is a safety question rather than a rendering one. It printed
 * `{allergens.join(", ")}` under an `ALLERGÈNES :` heading — whatever text sat
 * in the array is what went on the paper. So `vegan` printed as an allergen,
 * a dish tagged both `lactose` and `lait` printed "Lait" twice, and a name
 * nothing had checked printed indistinguishably from one that had.
 *
 * It also carried no table number, while "Sur place" was an order type the
 * product offered and the server accepted (NEW-I-1). A cook holding the slip
 * had the dish and the customer's name, and nowhere to take the plate.
 *
 * These render the real component and read the real markup. Mutating the
 * allergen block back to `allergens.join(", ")`, or dropping the `TABLE` line,
 * must turn this file red — that is the only reason it exists.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { PrintTicketLayout } from "@/components/admin/kitchen/PrintTicketLayout"

type Props = Parameters<typeof PrintTicketLayout>[0]

function render(overrides: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    <PrintTicketLayout
      storeName="Pizzeria Napoli"
      orderNumber="ORD-2026-0001"
      orderType="dine_in"
      source="website"
      items={[{ productName: "Tarte aux noix", quantity: 1, options: [] }]}
      paperSize="80mm"
      {...overrides}
    />
  )
}

/**
 * The text under one heading, up to the next element. The layout is inline
 * styles and `div`s with no class hooks, so the heading is the only anchor.
 */
function sectionAfter(markup: string, heading: string): string | undefined {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return markup.match(new RegExp(`${escaped}</div><div[^>]*>([^<]*)<`))?.[1]
}

describe("the table a dine-in plate goes to", () => {
  it("prints the table number", () => {
    expect(render({ tableNumber: "12" })).toContain("TABLE 12")
  })

  it("prints a label that is not a number", () => {
    // Dining rooms use these; the field is a label, not an integer.
    expect(render({ tableNumber: "A3" })).toContain("TABLE A3")
    expect(render({ tableNumber: "Terrasse 4" })).toContain("TABLE Terrasse 4")
  })

  it("prints no table line when the order has none", () => {
    // A platform `dine_in` order carries no table, and an empty "TABLE" line
    // reads as a fault rather than as a missing entry.
    expect(render({ tableNumber: undefined })).not.toContain("TABLE")
  })

  it("prints the table on the narrow roll too", () => {
    // 58mm is the paper most of these kitchens actually run.
    expect(render({ tableNumber: "7", paperSize: "58mm" })).toContain("TABLE 7")
  })
})

describe("allergens the vocabulary recognises", () => {
  it("prints the canonical French name, not the owner's spelling", () => {
    // `arachides` is what this repository's own seed writes.
    const markup = render({ allergens: ["arachides"] })
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBe("Arachides")
  })

  it("resolves an English name to the same French label", () => {
    expect(sectionAfter(render({ allergens: ["peanuts"] }), "ALLERGÈNES :")).toBe(
      "Arachides"
    )
  })

  it("prints one line for two spellings of one allergen", () => {
    // A cook should read "Lait" once. `join(", ")` printed it twice.
    expect(sectionAfter(render({ allergens: ["lactose", "lait"] }), "ALLERGÈNES :")).toBe(
      "Lait"
    )
  })

  it("prints nothing at all when nothing is declared", () => {
    expect(render({ allergens: [] })).not.toContain("ALLERGÈNES")
    expect(render({ allergens: undefined })).not.toContain("ALLERGÈNES")
  })
})

describe("names nothing has checked", () => {
  it("prints an unrecognised value rather than dropping it", () => {
    // It may be the one that matters. Hiding a declaration is the hazard.
    expect(render({ allergens: ["sauce secrète"] })).toContain("sauce secrète")
  })

  it("prints it apart from the recognised ones, under its own heading", () => {
    const markup = render({ allergens: ["gluten", "sauce secrète"] })
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBe("Gluten")
    expect(sectionAfter(markup, "MENTIONS À VÉRIFIER :")).toBe("sauce secrète")
  })

  it("never folds an unrecognised value into the allergen line", () => {
    // This is the mutation guard. `allergens.join(", ")` puts "sans gluten"
    // under ALLERGÈNES, where it reads as a gluten declaration — the exact
    // inversion of what the owner wrote.
    const markup = render({ allergens: ["sans gluten"] })
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBeUndefined()
    expect(sectionAfter(markup, "MENTIONS À VÉRIFIER :")).toBe("sans gluten")
  })
})

describe("dietary markers are not allergens", () => {
  it("never prints a diet under the allergen heading", () => {
    // `join(", ")` printed "vegan" under ALLERGÈNES, telling a cook it was one.
    const markup = render({ allergens: ["vegan"] })
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBeUndefined()
    expect(sectionAfter(markup, "RÉGIME :")).toBe("Végan")
  })

  it("separates all three kinds on one slip", () => {
    const markup = render({
      allergens: ["arachides", "sauce secrète", "vegan"],
    })
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBe("Arachides")
    expect(sectionAfter(markup, "MENTIONS À VÉRIFIER :")).toBe("sauce secrète")
    expect(sectionAfter(markup, "RÉGIME :")).toBe("Végan")
  })
})

describe("the whole dine-in slip", () => {
  it("carries the table and the allergens together", () => {
    // The two halves of this fix meet on one piece of paper: where the plate
    // goes, and what is in it.
    const markup = render({ tableNumber: "A3", allergens: ["arachides"] })
    expect(markup).toContain("SUR PLACE")
    expect(markup).toContain("TABLE A3")
    expect(sectionAfter(markup, "ALLERGÈNES :")).toBe("Arachides")
  })
})
