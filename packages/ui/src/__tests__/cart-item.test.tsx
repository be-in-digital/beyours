/**
 * CartItem's three controls are icon-only and each needs a name.
 *
 * Remove, minus and plus rendered nothing but a lucide icon, so a screen reader
 * announced three unnamed buttons — and the destructive one was
 * indistinguishable from the other two.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CartItem } from "../components/restaurant/CartItem"

const noop = () => {}

function render(props: Partial<React.ComponentProps<typeof CartItem>> = {}) {
  return renderToStaticMarkup(
    <CartItem
      name="Pizza Margherita"
      price="12,50 €"
      quantity={2}
      onQuantityChange={noop}
      onRemove={noop}
      {...props}
    />
  )
}

function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1])
}

describe("CartItem — accessible names", () => {
  it("names the remove button and both quantity buttons", () => {
    expect(ariaLabels(render())).toEqual([
      "Retirer du panier",
      "Quantité",
      "Diminuer la quantité",
      "Augmenter la quantité",
    ])
  })

  it("leaves no button unnamed", () => {
    const html = render()
    const buttons = (html.match(/<button/g) ?? []).length
    expect(buttons).toBe(3)
    // One name per button, plus the quantity group.
    expect(ariaLabels(html).length).toBe(buttons + 1)
  })

  it("hides the decorative icons from the accessibility tree", () => {
    expect((render().match(/aria-hidden="true"/g) ?? []).length).toBe(3)
  })

  it("accepts overridden labels", () => {
    const labels = ariaLabels(render({ labels: { remove: "Remove from cart" } }))
    expect(labels).toContain("Remove from cart")
    expect(labels).toContain("Diminuer la quantité")
  })

  it("omits the controls that were not wired up", () => {
    expect(render({ onRemove: undefined }).match(/<button/g)?.length).toBe(2)
    expect(render({ onQuantityChange: undefined }).match(/<button/g)?.length).toBe(
      1
    )
  })
})

describe("CartItem — content", () => {
  it("renders the name, price and quantity", () => {
    const shown = render().replace(/<[^>]*>/g, "")
    expect(shown).toContain("Pizza Margherita")
    expect(shown).toContain("12,50 €")
    expect(shown).toContain("2")
  })

  it("renders the chosen options", () => {
    const shown = render({ options: ["Grande", "Extra fromage"] }).replace(
      /<[^>]*>/g,
      ""
    )
    expect(shown).toContain("Grande, Extra fromage")
  })

  it("disables the minus button at one item", () => {
    const [beforePlus] = render({ quantity: 1 }).split("Augmenter")
    expect(beforePlus).toContain("disabled")
  })
})
