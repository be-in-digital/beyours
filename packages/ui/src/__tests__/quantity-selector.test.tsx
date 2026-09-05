/**
 * Every control in QuantitySelector must carry an accessible name.
 *
 * Both buttons render nothing but a lucide icon and the input had no `id`, no
 * `<label>` and no `aria-label`, so a screen reader announced three unnamed
 * controls — "button", "button", "spin button". A blind diner could not tell
 * which one added an item to their order.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { QuantitySelector } from "../components/restaurant/QuantitySelector"

const noop = () => {}

function render(props: Partial<React.ComponentProps<typeof QuantitySelector>> = {}) {
  return renderToStaticMarkup(
    <QuantitySelector value={2} onChange={noop} {...props} />
  )
}

/** Pull the accessible names out of the rendered markup, in document order. */
function ariaLabels(html: string): string[] {
  return [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1])
}

describe("QuantitySelector — accessible names", () => {
  it("names the group, both buttons and the input", () => {
    const labels = ariaLabels(render())
    expect(labels).toEqual([
      "Quantité",
      "Diminuer la quantité",
      "Quantité",
      "Augmenter la quantité",
    ])
  })

  it("leaves no control unnamed", () => {
    const html = render()
    // Three controls: minus, input, plus. Plus the group wrapper.
    expect(ariaLabels(html).length).toBeGreaterThanOrEqual(4)
    expect((html.match(/<button/g) ?? []).length).toBe(2)
    expect((html.match(/<input/g) ?? []).length).toBe(1)
  })

  it("groups the three controls so they are announced together", () => {
    expect(render()).toContain('role="group"')
  })

  it("hides the decorative icons from the accessibility tree", () => {
    const html = render()
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(2)
  })

  it("accepts overridden labels for another language", () => {
    const labels = ariaLabels(
      render({
        labels: {
          group: "Quantity",
          decrease: "Decrease quantity",
          increase: "Increase quantity",
          input: "Quantity",
        },
      })
    )
    expect(labels).toEqual([
      "Quantity",
      "Decrease quantity",
      "Quantity",
      "Increase quantity",
    ])
  })

  it("takes a partial override without losing the other names", () => {
    const labels = ariaLabels(render({ labels: { increase: "Ajouter un plat" } }))
    expect(labels).toContain("Ajouter un plat")
    expect(labels).toContain("Diminuer la quantité")
  })
})

describe("QuantitySelector — bounds", () => {
  it("disables the minus button at the minimum", () => {
    const html = render({ value: 1, min: 1 })
    const [minus] = html.split("<input")
    expect(minus).toContain("disabled")
  })

  it("disables the plus button at the maximum", () => {
    const html = render({ value: 99, max: 99 })
    const plus = html.split("<input")[1]
    expect(plus).toContain("disabled")
  })

  it("publishes min and max on the input for assistive technology", () => {
    const html = render({ value: 3, min: 2, max: 8 })
    expect(html).toContain('min="2"')
    expect(html).toContain('max="8"')
  })

  it("disables every control when disabled", () => {
    const html = render({ disabled: true })
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
