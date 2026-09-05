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

  it.each(["out_for_delivery", "completed"])(
    "renders the schema status %s as pending instead of throwing",
    (status) => {
      // These two are in the schema union but not in this component's.
      expect(() => renderUnchecked(status)).not.toThrow()
      expect(renderUnchecked(status)).toContain("Pending")
    }
  )

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
