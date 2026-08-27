/**
 * StoreStatusBadge must not throw on a status it does not know.
 *
 * The storefront selector reads its status straight from the store document.
 * The prop type admits three values; the database holds four, and `draft` is
 * the one `stores.create` assigns. When the selector still listed drafts it
 * mapped `draft` to `closed` inline before rendering — remove that mapping,
 * hand this component the raw status, and it read `.className` off `undefined`
 * and took the page down with it. A blank storefront, not a wrong badge.
 *
 * The rule that keeps drafts out lives on the server. This is what happens if
 * that rule is ever weakened: a conservative badge, not a crash.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { StoreStatusBadge } from "../components/restaurant/StoreStatusBadge"
import type { StoreStatus } from "../components/restaurant/StoreStatusBadge"

/** The component's own type forbids these; the database does not. */
function renderUnchecked(status: string) {
  return renderToStaticMarkup(
    <StoreStatusBadge status={status as StoreStatus} />
  )
}

describe("StoreStatusBadge", () => {
  it.each([
    ["open", "Open"],
    ["closed", "Closed"],
    ["temporarily_unavailable", "Temporarily Unavailable"],
  ])("labels a %s establishment", (status, label) => {
    expect(renderUnchecked(status)).toContain(label)
  })

  it("renders a draft as closed instead of throwing", () => {
    expect(() => renderUnchecked("draft")).not.toThrow()
    expect(renderUnchecked("draft")).toContain("Closed")
  })

  it("renders an unknown status as closed instead of throwing", () => {
    // A status added to the schema later arrives here as a string this
    // component has never seen.
    expect(() => renderUnchecked("seasonal_popup")).not.toThrow()
    expect(renderUnchecked("seasonal_popup")).toContain("Closed")
  })
})
