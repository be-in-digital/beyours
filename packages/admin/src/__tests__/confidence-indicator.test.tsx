/**
 * The image-to-product confidence bar says how sure the model was — without
 * relying on colour to say it (WCAG 1.4.1).
 *
 * WHAT WENT WRONG: the three bands were `bg-green-500`, `bg-yellow-500` and
 * `bg-red-500` and nothing else. On a screen whose entire job is "which of
 * these extracted fields do I need to check before I save them?", the verdict
 * was carried by hue alone. The percentage printed beside the bar is the raw
 * number, not the verdict: reading "62 %" as "middling, look at it" requires
 * knowing thresholds the screen never states.
 *
 * The bar keeps its colour. It gained a per-band icon — three different
 * shapes, not one shape in three colours — and an accessible name that says
 * the band in words. The assertions below are deliberately about SHAPE and
 * NAME: a change that only swapped the palette would leave the defect exactly
 * where it was.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import fs from "node:fs"
import path from "node:path"

import { ConfidenceIndicator } from "../pages/products/image-to-product/confidence-indicator"

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

const mounted: { root: Root; container: HTMLElement }[] = []

afterEach(() => {
  for (const m of mounted.splice(0)) {
    act(() => m.root.unmount())
    m.container.remove()
  }
})

function render(node: React.ReactNode): HTMLElement {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(node))
  mounted.push({ root, container })
  return container
}

const iconOf = (value: number): SVGElement | null =>
  render(<ConfidenceIndicator value={value} />).querySelector("svg")

const nameOf = (value: number): string | null =>
  render(<ConfidenceIndicator value={value} />)
    .querySelector("[aria-label]")
    ?.getAttribute("aria-label") ?? null

describe("the confidence indicator", () => {
  it("draws a marker in every band", () => {
    expect(iconOf(0.92)).not.toBeNull()
    expect(iconOf(0.62)).not.toBeNull()
    expect(iconOf(0.2)).not.toBeNull()
  })

  it("draws a DIFFERENT shape in each band", () => {
    // Three markers distinguished only by their colour would fail 1.4.1 in
    // exactly the way the three bar colours did.
    const shapes = [0.92, 0.62, 0.2].map((v) => iconOf(v)!.getAttribute("class"))
    expect(new Set(shapes).size).toBe(3)
  })

  it("names the band, not just the number", () => {
    expect(nameOf(0.92)).toMatch(/élevée/i)
    expect(nameOf(0.62)).toMatch(/moyenne/i)
    expect(nameOf(0.2)).toMatch(/faible/i)
  })

  it("carries the percentage in the name as well as on screen", () => {
    // `role="img"` replaces the inner text for assistive technology, so the
    // figure has to be in the name or it stops being announced at all.
    expect(nameOf(0.62)).toContain("62")
    expect(render(<ConfidenceIndicator value={0.62} />).textContent).toContain("62%")
  })

  it("puts a field on the boundary in the higher band", () => {
    // 80 and 50 are the band floors, and an off-by-one here would silently
    // move a whole class of suggestions into the wrong verdict.
    expect(nameOf(0.8)).toMatch(/élevée/i)
    expect(nameOf(0.79)).toMatch(/moyenne/i)
    expect(nameOf(0.5)).toMatch(/moyenne/i)
    expect(nameOf(0.49)).toMatch(/faible/i)
  })

  it("keeps the bar colours, because colour is still the fastest cue", () => {
    // 1.4.1 asks for a second cue, not for the first one to be removed.
    expect(render(<ConfidenceIndicator value={0.92} />).innerHTML).toContain("bg-green-500")
    expect(render(<ConfidenceIndicator value={0.2} />).innerHTML).toContain("bg-red-500")
  })

  it("holds no class name assembled at runtime", () => {
    // Tailwind scans source text: a class built by string surgery gets no CSS
    // generated for it, which is how this repository lost a third of a client
    // stylesheet once already. Every colour here must be a literal.
    const source = fs.readFileSync(
      path.join(__dirname, "../pages/products/image-to-product/confidence-indicator.tsx"),
      "utf8"
    )
    expect(source).not.toMatch(/replace\(\s*["']bg-/)
  })
})
