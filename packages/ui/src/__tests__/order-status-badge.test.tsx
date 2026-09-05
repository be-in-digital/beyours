/**
 * OrderStatusBadge must not throw on a status it does not know.
 *
 * `orders.status` is a `v.union` of eight literals
 * (packages/convex-schema/src/tables/orders.ts:22); this component declares
 * six. `out_for_delivery` and `completed` reach it only because its single
 * caller — `OrderConfirmationContent.toDisplayStatus` — folds them onto
 * `delivered` first, then launders the result with `as OrderStatus`. Remove
 * that fold, or add a ninth status to the schema, and the unguarded
 * `statusConfig[status].className` takes the order page down.
 *
 * This is the sibling of the crash `StoreStatusBadge` and `AllergenBadge`
 * already carry guards for. It was latent, not live; this test keeps it that
 * way.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { OrderStatusBadge } from "../components/restaurant/OrderStatusBadge"
import type { OrderStatus } from "../components/restaurant/OrderStatusBadge"

/** The component's own type forbids these; the database does not. */
function renderUnchecked(status: string) {
  return renderToStaticMarkup(
    <OrderStatusBadge status={status as OrderStatus} />
  )
}

describe("OrderStatusBadge", () => {
  it.each([
    ["pending", "Pending"],
    ["confirmed", "Confirmed"],
    ["preparing", "Preparing"],
    ["ready", "Ready"],
    ["delivered", "Delivered"],
    ["cancelled", "Cancelled"],
  ])("labels a %s order", (status, label) => {
    expect(renderUnchecked(status)).toContain(label)
  })

  it("carries the status colour, not `undefined`, in the class", () => {
    // `.className` is the property whose undefined dereference was the crash.
    // Asserting only on the label lets a badge with no class at all pass.
    expect(renderUnchecked("pending")).toContain("bg-yellow-100")
    expect(renderUnchecked("cancelled")).toContain("bg-red-100")
    expect(renderUnchecked("out_for_delivery")).toContain("bg-indigo-100")
  })

  it.each([
    ["out_for_delivery", "Out for Delivery"],
    ["completed", "Completed"],
  ])("labels %s honestly rather than folding it onto delivered", (status, label) => {
    // The caller used to map both of these to `delivered`, so an order still
    // in the van showed a purple "Delivered" badge sixteen lines above a
    // label reading "En livraison". The component declares all eight now.
    expect(renderUnchecked(status)).toContain(label)
    expect(renderUnchecked(status)).not.toContain("Delivered")
  })

  it.each(["constructor", "__proto__", "toString", "valueOf"])(
    "does not read %s off Object.prototype",
    (inherited) => {
      // `statusConfig[inherited]` is a function, not undefined, so `??` never
      // fires and `.className` renders `undefined` into the class attribute.
      const html = renderUnchecked(inherited)
      expect(html).not.toContain("undefined")
      expect(html).toContain("Pending")
    }
  )

  it("renders an unknown status as pending instead of throwing", () => {
    // A status added to the schema later arrives here as a string this
    // component has never seen. Pending is the conservative reading: it does
    // not tell a customer their order is further along than it is.
    expect(() => renderUnchecked("refunded")).not.toThrow()
    expect(renderUnchecked("refunded")).toContain("Pending")
  })
})
