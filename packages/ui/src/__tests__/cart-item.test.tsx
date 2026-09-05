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
  it("scopes every name to the item, so a multi-line cart is operable", () => {
    // Constant labels give a four-line cart four buttons called "Retirer du
    // panier". The buttons list a screen reader pulls up shows names, not
    // surrounding text, so there is no way to tell which one deletes what.
    expect(ariaLabels(render())).toEqual([
      "Retirer Pizza Margherita du panier",
      "Quantité de Pizza Margherita",
      "Diminuer la quantité de Pizza Margherita",
      "Augmenter la quantité de Pizza Margherita",
    ])
  })

  it("gives two lines two distinct sets of names", () => {
    const first = ariaLabels(render({ name: "Pizza Margherita" }))
    const second = ariaLabels(render({ name: "Tiramisu" }))
    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })

  it("announces the new quantity, which a button press does not", () => {
    // Focus stays on the button; the count changes in a span nobody is
    // looking at. Without a live region the press is silent.
    const html = render({ quantity: 3 })
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain("Quantité de Pizza Margherita : 3")
  })

  it("leaves no button unnamed", () => {
    const html = render()
    const buttons = (html.match(/<button/g) ?? []).length
    expect(buttons).toBe(3)
    // One name per button, plus the quantity group.
    expect(ariaLabels(html).length).toBe(buttons + 1)
  })

  it("hides the decorative icons from the accessibility tree", () => {
    // Three icons, plus the visual count that the live region already speaks.
    expect((render().match(/aria-hidden="true"/g) ?? []).length).toBe(4)
  })

  it("accepts overridden labels", () => {
    const labels = ariaLabels(
      render({ labels: { remove: (name) => `Remove ${name} from cart` } })
    )
    expect(labels).toContain("Remove Pizza Margherita from cart")
    expect(labels).toContain("Diminuer la quantité de Pizza Margherita")
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

  it("disables the minus button at one item, and not above it", () => {
    // `disabled` is also a Tailwind prefix, so match the attribute on the
    // named button rather than anywhere in the markup.
    const minusTag = (html: string) =>
      html.match(/<button[^>]*aria-label="Diminuer[^"]*"[^>]*>/)?.[0] ?? ""
    expect(minusTag(render({ quantity: 1 }))).toMatch(/ disabled(=|[\s>])/)
    expect(minusTag(render({ quantity: 2 }))).not.toMatch(/ disabled(=|[\s>])/)
  })
})
