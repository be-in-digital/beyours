/**
 * The row of flames is one image and needs one accessible name.
 *
 * It carried only a `title`, which is not a reliable accessible name on a
 * non-interactive element and never surfaces on touch — so the spice level of
 * a dish was invisible to a screen reader and to a phone.
 */

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SpiceLevelIndicator } from "../components/restaurant/SpiceLevelIndicator"

function render(props: React.ComponentProps<typeof SpiceLevelIndicator>) {
  return renderToStaticMarkup(<SpiceLevelIndicator {...props} />)
}

describe("SpiceLevelIndicator", () => {
  it("names itself for a screen reader", () => {
    const html = render({ level: 3 })
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Niveau de piment : 3/5"')
  })

  it("keeps the title for a mouse user", () => {
    expect(render({ level: 3 })).toContain('title="Niveau de piment : 3/5"')
  })

  it("reflects a custom maximum in the name", () => {
    expect(render({ level: 2, maxLevel: 3 })).toContain(
      'aria-label="Niveau de piment : 2/3"'
    )
  })

  it("accepts an overridden name for another language", () => {
    expect(render({ level: 3, label: "Spice level: 3/5" })).toContain(
      'aria-label="Spice level: 3/5"'
    )
  })

  it("hides the individual flames from the accessibility tree", () => {
    // One name for the group, not five unnamed icons.
    const html = render({ level: 3 })
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(5)
    expect((html.match(/aria-label=/g) ?? []).length).toBe(1)
  })

  it("renders one flame per level step", () => {
    expect((render({ level: 1 }).match(/<svg/g) ?? []).length).toBe(5)
    expect((render({ level: 1, maxLevel: 3 }).match(/<svg/g) ?? []).length).toBe(3)
  })

  it("fills exactly as many flames as the level", () => {
    const filled = (html: string) =>
      (html.match(/fill-orange-500/g) ?? []).length
    expect(filled(render({ level: 0 }))).toBe(0)
    expect(filled(render({ level: 3 }))).toBe(3)
    expect(filled(render({ level: 5 }))).toBe(5)
  })
})
