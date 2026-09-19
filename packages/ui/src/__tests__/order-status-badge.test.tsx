/**
 * OrderStatusBadge: it speaks the diner's language, and it does not throw on a
 * status it does not know.
 *
 * TWO DEFECTS, ONE COMPONENT.
 *
 * The crash: `orders.status` is a `v.union` of eight literals
 * (packages/convex-schema/src/tables/orders.ts:22); this component declared
 * six, and its single caller folded `out_for_delivery` and `completed` onto
 * `delivered` before laundering the result with `as OrderStatus`. Remove the
 * fold, or add a ninth status to the schema, and the unguarded
 * `statusConfig[status].className` took the order page down. That half of this
 * file is unchanged.
 *
 * The language: this badge is mounted on the diner's own order page, which is
 * written in French, and it held eight hardcoded English labels with no way
 * past them — « Preparing », « Out for Delivery » between French sentences,
 * with the translation layer #148 shipped unable to reach either. The cases
 * below that asserted 'Pending', 'Confirmed', 'Preparing', 'Ready',
 * 'Delivered', 'Cancelled', 'Out for Delivery' and 'Completed' were REWRITTEN:
 * they pinned that defect in place. What is asserted now is the source-language
 * word — from the one vocabulary in `@be-yours/core/status-labels` — and
 * that a caller's own labels replace it.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ORDER_STATUS_VOCABULARY } from "@be-yours/core/status-labels"
import { OrderStatusBadge } from "../components/restaurant/OrderStatusBadge"
import type { OrderStatus } from "../components/restaurant/OrderStatusBadge"

/** The component's own type forbids these; the database does not. */
function renderUnchecked(
  status: string,
  labels?: Partial<Record<OrderStatus, string>>
) {
  return renderToStaticMarkup(
    <OrderStatusBadge status={status as OrderStatus} labels={labels} />
  )
}

describe("OrderStatusBadge", () => {
  it.each([
    ["pending", "En attente"],
    ["confirmed", "Confirmée"],
    ["preparing", "En préparation"],
    ["ready", "Prête"],
    ["delivered", "Livrée"],
    ["cancelled", "Annulée"],
  ])("labels a %s order in the product's own language", (status, label) => {
    expect(renderUnchecked(status)).toContain(label)
  })

  it("holds no English of its own", () => {
    // The whole defect in one assertion: eight English words on a French
    // page. Every status is rendered and none of them may read as English.
    const english = [
      "Pending",
      "Confirmed",
      "Preparing",
      "Ready",
      "Out for Delivery",
      "Delivered",
      "Completed",
      "Cancelled",
    ]
    const rendered = Object.keys(ORDER_STATUS_VOCABULARY)
      .map((status) => renderUnchecked(status))
      .join("")

    for (const word of english) expect(rendered).not.toContain(word)
  })

  it("never lets the colour be the only thing that distinguishes a status", () => {
    // WCAG 1.4.1. Eight statuses wear eight different tints — yellow, blue,
    // orange, green, indigo, purple, emerald, red — and about one man in
    // twelve cannot reliably separate several of those pairs. This badge
    // passes today because it prints the word as well, and this case exists so
    // that stays true: reduce it to a swatch, or blank a label, and it goes
    // red. It is the guard, not a fix — nothing here was changed for 1.4.1.
    const seen = new Set<string>()

    for (const status of Object.keys(ORDER_STATUS_VOCABULARY)) {
      const html = renderUnchecked(status)
      const text = html.replace(/<[^>]*>/g, "").trim()

      expect(text).not.toBe("")
      seen.add(text)
    }

    // Distinct words, not one word in eight colours.
    expect(seen.size).toBe(Object.keys(ORDER_STATUS_VOCABULARY).length)
  })

  it("carries the status colour, not `undefined`, in the class", () => {
    // `.className` is the property whose undefined dereference was the crash.
    // Asserting only on the label lets a badge with no class at all pass.
    expect(renderUnchecked("pending")).toContain("bg-yellow-100")
    expect(renderUnchecked("cancelled")).toContain("bg-red-100")
    expect(renderUnchecked("out_for_delivery")).toContain("bg-indigo-100")
  })

  it.each([
    ["out_for_delivery", "En livraison"],
    ["completed", "Terminée"],
  ])("labels %s honestly rather than folding it onto delivered", (status, label) => {
    // The caller used to map both of these to `delivered`, so an order still
    // in the van showed a purple "Delivered" badge sixteen lines above a
    // label reading "En livraison". The component declares all eight now.
    expect(renderUnchecked(status)).toContain(label)
    expect(renderUnchecked(status)).not.toContain("Livrée")
  })

  describe("labels supplied by the caller", () => {
    it("replace the default, per status", () => {
      // What the storefront actually does: `useOrderStatusLabels()` resolves
      // the same vocabulary through `t()` for the locale being rendered.
      const html = renderUnchecked("preparing", {
        preparing: "Preparándose",
      })
      expect(html).toContain("Preparándose")
      expect(html).not.toContain("En préparation")
    })

    it("may cover only some statuses", () => {
      const html = renderUnchecked("ready", { preparing: "Preparándose" })
      expect(html).toContain("Prête")
    })

    it("do not change the colour", () => {
      // The word is the caller's; the design system is not.
      expect(renderUnchecked("cancelled", { cancelled: "Cancelled" })).toContain(
        "bg-red-100"
      )
    })

    it("are ignored when blank", () => {
      // An empty catalogue entry must not render an empty badge.
      expect(renderUnchecked("ready", { ready: "   " })).toContain("Prête")
    })

    it("are read as own keys only", () => {
      // The map crosses a package boundary, so it gets the same guard the
      // status does: `labels["constructor"]` is a function, not a label.
      const html = renderUnchecked("pending", {} as Record<OrderStatus, string>)
      expect(html).toContain("En attente")
      expect(html).not.toContain("function")
    })
  })

  it.each(["constructor", "__proto__", "toString", "valueOf"])(
    "does not read %s off Object.prototype",
    (inherited) => {
      // `statusConfig[inherited]` is a function, not undefined, so `??` never
      // fires and `.className` renders `undefined` into the class attribute.
      const html = renderUnchecked(inherited)
      expect(html).not.toContain("undefined")
      expect(html).toContain("En attente")
    }
  )

  it("renders an unknown status as pending instead of throwing", () => {
    // A status added to the schema later arrives here as a string this
    // component has never seen. Pending is the conservative reading: it does
    // not tell a customer their order is further along than it is.
    expect(() => renderUnchecked("refunded")).not.toThrow()
    expect(renderUnchecked("refunded")).toContain("En attente")
  })

  it("does not let a label for an unknown status through", () => {
    // The status is unknown, so its colour is pending's; its word must be
    // pending's too, rather than a caller's label for a state this component
    // cannot draw.
    const html = renderUnchecked("refunded", {
      refunded: "Remboursée",
    } as unknown as Partial<Record<OrderStatus, string>>)
    expect(html).toContain("En attente")
    expect(html).not.toContain("Remboursée")
  })
})
