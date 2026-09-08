/**
 * StoreStatusBadge: it speaks the diner's language, and it does not throw on a
 * status it does not know.
 *
 * The crash half is unchanged. The storefront selector reads its status
 * straight from the store document: the prop type admits three values, the
 * database holds four, and `draft` is the one `stores.create` assigns. Hand
 * this component the raw status and it read `.className` off `undefined` and
 * took the page down with it — a blank storefront, not a wrong badge.
 *
 * The language half is new. Three hardcoded English labels — 'Open', 'Closed',
 * 'Temporarily Unavailable' — sat on a store selector written entirely in
 * French, with no override prop, so the translation layer #148 shipped could
 * not reach them. The three cases that asserted those words were REWRITTEN:
 * they pinned the defect. What is asserted now is the source-language word,
 * from the one vocabulary in `@be-in-digital/core/status-labels`, and that a
 * caller's own labels replace it.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { StoreStatusBadge } from "../components/restaurant/StoreStatusBadge"
import type { StoreStatus } from "../components/restaurant/StoreStatusBadge"

/** The component's own type forbids these; the database does not. */
function renderUnchecked(
  status: string,
  labels?: Partial<Record<StoreStatus, string>>
) {
  return renderToStaticMarkup(
    <StoreStatusBadge status={status as StoreStatus} labels={labels} />
  )
}

describe("StoreStatusBadge", () => {
  it.each([
    ["open", "Ouvert"],
    ["closed", "Fermé"],
    ["temporarily_unavailable", "Temporairement indisponible"],
  ])("labels a %s establishment in the product's own language", (status, label) => {
    expect(renderUnchecked(status)).toContain(label)
  })

  it("holds no English of its own", () => {
    const rendered = ["open", "closed", "temporarily_unavailable"]
      .map((status) => renderUnchecked(status))
      .join("")

    for (const word of ["Open", "Closed", "Temporarily Unavailable"]) {
      expect(rendered).not.toContain(word)
    }
  })

  it("never lets the colour be the only thing that distinguishes a status", () => {
    // WCAG 1.4.1, and the case that matters most on a storefront: green for
    // open, red for closed, orange for paused is precisely the triple a
    // red-green colour blindness flattens. This badge passes today because it
    // prints the word as well, and this case exists so that stays true — the
    // header's own store panel had the same job and did it with a bare
    // coloured dot until it was fixed. Guard, not a fix.
    const seen = new Set<string>()

    for (const status of ["open", "closed", "temporarily_unavailable"]) {
      const text = renderUnchecked(status).replace(/<[^>]*>/g, "").trim()

      expect(text).not.toBe("")
      seen.add(text)
    }

    expect(seen.size).toBe(3)
  })

  it("carries the status colour, not `undefined`, in the class", () => {
    expect(renderUnchecked("open")).toContain("bg-green-100")
    expect(renderUnchecked("closed")).toContain("bg-red-100")
    expect(renderUnchecked("draft")).toContain("bg-red-100")
  })

  it("renders a draft as closed instead of throwing", () => {
    expect(() => renderUnchecked("draft")).not.toThrow()
    expect(renderUnchecked("draft")).toContain("Fermé")
  })

  describe("labels supplied by the caller", () => {
    it("replace the default, per status", () => {
      // What the storefront actually does: `useStoreStatusLabels()` resolves
      // the same vocabulary through `t()` for the locale being rendered.
      const html = renderUnchecked("temporarily_unavailable", {
        temporarily_unavailable: "Temporalmente no disponible",
      })
      expect(html).toContain("Temporalmente no disponible")
      expect(html).not.toContain("Temporairement indisponible")
    })

    it("do not change the colour", () => {
      expect(renderUnchecked("open", { open: "Abierto" })).toContain(
        "bg-green-100"
      )
    })

    it("are ignored when blank", () => {
      expect(renderUnchecked("open", { open: "" })).toContain("Ouvert")
    })

    it("do not apply to a status the badge cannot draw", () => {
      // A draft renders as closed; it must read as closed too, not as a
      // caller's word for a state this component has no colour for.
      const html = renderUnchecked("draft", {
        draft: "Brouillon",
      } as unknown as Partial<Record<StoreStatus, string>>)
      expect(html).toContain("Fermé")
      expect(html).not.toContain("Brouillon")
    })
  })

  it.each(["constructor", "__proto__", "toString", "valueOf"])(
    "does not read %s off Object.prototype",
    (inherited) => {
      // An object literal inherits these, so `statusConfig[inherited]` is a
      // function and `??` never fires.
      const html = renderUnchecked(inherited)
      expect(html).not.toContain("undefined")
      expect(html).toContain("Fermé")
    }
  )

  it("renders an unknown status as closed instead of throwing", () => {
    // A status added to the schema later arrives here as a string this
    // component has never seen.
    expect(() => renderUnchecked("seasonal_popup")).not.toThrow()
    expect(renderUnchecked("seasonal_popup")).toContain("Fermé")
  })
})
