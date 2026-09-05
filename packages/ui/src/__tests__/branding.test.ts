/**
 * An establishment's stored branding, and what it paints.
 *
 * The defect this holds shut: the Design screen wrote `stores.branding` and
 * nothing read it, so `--primary` was the literal `24 95% 53%` in every app,
 * for every client, forever. These tests are about the half that was missing —
 * the derivation — and `apps/<app>/tests/storefront/store-theme.test.tsx` covers
 * the half that renders it.
 */

import { describe, it, expect } from "vitest"
import {
  buildBrandingCss,
  contrastRatio,
  formatHsl,
  parseBrandColor,
  readableForeground,
  relativeLuminance,
  sanitizeFontStack,
} from "../lib/branding"

/** `#f97015` is `hsl(24 95% 53%)`, the orange every delivered site ships with. */
const ENGINE_ORANGE = "#f97015"

describe("parseBrandColor", () => {
  it("reads the six-digit form an <input type=color> produces", () => {
    expect(parseBrandColor("#ff0000")).toEqual({ h: 0, s: 100, l: 50 })
    expect(parseBrandColor("#0000FF")).toEqual({ h: 240, s: 100, l: 50 })
  })

  it("reads the three-digit shorthand a person types", () => {
    expect(parseBrandColor("#0f0")).toEqual(parseBrandColor("#00ff00"))
  })

  it("has no hue for a grey", () => {
    expect(parseBrandColor("#808080")).toEqual({ h: 0, s: 0, l: expect.any(Number) })
    expect(parseBrandColor("#ffffff")).toEqual({ h: 0, s: 0, l: 100 })
  })

  it("round-trips the engine's own orange to its token", () => {
    // The value in `app/globals.css`. If this drifts, the deriver and the
    // stylesheet have stopped describing the same colour.
    expect(formatHsl(parseBrandColor(ENGINE_ORANGE)!)).toBe("24 95% 53%")
  })

  it("refuses everything that is not a hex colour", () => {
    for (const value of [
      "red",
      "rgb(255,0,0)",
      "var(--primary)",
      "#12345",
      "#gggggg",
      "",
      "  ",
      null,
      undefined,
      42,
      { primaryColor: "#fff" },
    ]) {
      expect(parseBrandColor(value), String(value)).toBeNull()
    }
  })

  it("refuses a value carrying CSS of its own", () => {
    // `stores.updateBranding` validates `v.string()` and a length, not grammar,
    // so this is a value the mutation accepts and stores.
    expect(parseBrandColor("#fff;}body{display:none}")).toBeNull()
    expect(parseBrandColor("red;} :root { --primary: 0 0% 0%")).toBeNull()
  })
})

describe("relativeLuminance", () => {
  it("agrees with the WCAG endpoints", () => {
    expect(relativeLuminance({ h: 0, s: 0, l: 100 })).toBeCloseTo(1, 5)
    expect(relativeLuminance({ h: 0, s: 0, l: 0 })).toBeCloseTo(0, 5)
  })

  it("puts the primaries where the spec does", () => {
    expect(relativeLuminance({ h: 0, s: 100, l: 50 })).toBeCloseTo(0.2126, 4)
    expect(relativeLuminance({ h: 120, s: 100, l: 50 })).toBeCloseTo(0.7152, 4)
    expect(relativeLuminance({ h: 240, s: 100, l: 50 })).toBeCloseTo(0.0722, 4)
  })

  it("scores white against black at 21:1", () => {
    expect(
      contrastRatio({ h: 0, s: 0, l: 100 }, { h: 0, s: 0, l: 0 })
    ).toBeCloseTo(21, 5)
  })
})

describe("readableForeground", () => {
  it("puts white on a dark brand", () => {
    expect(readableForeground(parseBrandColor("#1a237e")!)).toEqual({
      h: 0,
      s: 0,
      l: 100,
    })
  })

  it("puts ink on a light brand", () => {
    // The case that made this a computation instead of a constant: white on
    // this yellow is 1.07:1 — a button whose label cannot be read at all.
    //
    // The ink is black rather than the engine's `224 71% 4%`: that near-black
    // leaves the worst case at 4.4897:1, below AA on 37 372 of the 16 777 216
    // colours a picker can produce. The difference is imperceptible and the
    // guarantee is not.
    const yellow = parseBrandColor("#ffeb3b")!
    expect(contrastRatio(yellow, { h: 0, s: 0, l: 100 })).toBeLessThan(1.5)
    expect(readableForeground(yellow)).toEqual({ h: 0, s: 0, l: 0 })
  })

  it("beats 4.5:1 on every colour a picker can produce", () => {
    // NOT a hue circle at one saturation. The first version of this test swept
    // `s=85` at six lightnesses and passed while the claim was false: with the
    // engine's near-black as the ink, the worst case over all 16 777 216 hex
    // values was 4.4897:1 (`#e8194d`), under the bar on 37 372 of them. The
    // grid had been chosen where it could not fail.
    //
    // Every 4th value per channel — 262 144 colours — plus the exact worst
    // cases a full sweep found, so a regression that only shows between the
    // grid lines still has somewhere to land.
    const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")
    let worst = Infinity
    let worstAt = ""
    for (let r = 0; r < 256; r += 4) {
      for (let g = 0; g < 256; g += 4) {
        for (let b = 0; b < 256; b += 4) {
          const value = hex((r << 16) | (g << 8) | b)
          const colour = parseBrandColor(value)!
          const ratio = contrastRatio(colour, readableForeground(colour))
          if (ratio < worst) {
            worst = ratio
            worstAt = value
          }
        }
      }
    }
    expect(worst, `worst at ${worstAt}`).toBeGreaterThanOrEqual(4.5)
  })

  it("holds at the worst colours a full sweep found", () => {
    // Pinned individually: these are the floor, and a change that lifts the
    // average while dropping one of them is still a regression.
    for (const value of ["#38860a", "#e8194d", "#006eff", "#0072f1"]) {
      const colour = parseBrandColor(value)!
      expect(
        contrastRatio(colour, readableForeground(colour)),
        value
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe("sanitizeFontStack", () => {
  it("quotes each family of a stack", () => {
    expect(sanitizeFontStack("Inter, Roboto, Arial")).toBe(
      '"Inter", "Roboto", "Arial"'
    )
  })

  it("keeps the families a font actually has in its name", () => {
    expect(sanitizeFontStack("Helvetica Neue")).toBe('"Helvetica Neue"')
    expect(sanitizeFontStack("IBM Plex Sans")).toBe('"IBM Plex Sans"')
    expect(sanitizeFontStack("'Playfair Display'")).toBe('"Playfair Display"')
  })

  it("drops a family carrying anything else rather than escaping it", () => {
    expect(sanitizeFontStack('Inter"; } body { display: none } i { font: "x')).toBeNull()
    expect(sanitizeFontStack("Inter, url(evil)")).toBe('"Inter"')
    expect(sanitizeFontStack("</style><script>")).toBeNull()
  })

  it("bounds what one field can emit", () => {
    expect(sanitizeFontStack("a, b, c, d, e, f")).toBe('"a", "b", "c", "d"')
    expect(sanitizeFontStack("x".repeat(65))).toBeNull()
  })

  it("has nothing to say about an empty or absent value", () => {
    for (const value of ["", "   ", ",,,", null, undefined, 7]) {
      expect(sanitizeFontStack(value), String(value)).toBeNull()
    }
  })
})

describe("buildBrandingCss", () => {
  it("writes nothing for a store that has set nothing", () => {
    expect(buildBrandingCss(undefined)).toBe("")
    expect(buildBrandingCss(null)).toBe("")
    expect(buildBrandingCss({})).toBe("")
    expect(buildBrandingCss({ logoUrl: "/logo.png" })).toBe("")
    expect(buildBrandingCss("#ff0000")).toBe("")
    expect(buildBrandingCss(["#ff0000"])).toBe("")
  })

  it("redefines the primary a diner sees", () => {
    const css = buildBrandingCss({ primaryColor: "#d32f2f" })
    expect(css).toContain(":root{")
    expect(css).toContain("--primary:0 65% 51%;")
    expect(css).toContain("--ring:0 65% 51%;")
  })

  it("gives the primary a foreground that can be read on it", () => {
    expect(buildBrandingCss({ primaryColor: "#ffeb3b" })).toContain(
      "--primary-foreground:0 0% 0%;"
    )
    expect(buildBrandingCss({ primaryColor: "#1a237e" })).toContain(
      "--primary-foreground:0 0% 100%;"
    )
  })

  it("keeps the accent a tint, not a slab", () => {
    // `bg-accent` is what a hovered row is painted with. `#ff9800` written
    // straight onto it turns every hover in the product into a solid orange
    // block; the hue is what the owner is choosing, the role is not.
    const css = buildBrandingCss({ accentColor: "#ff9800" }, { darkSelector: null })
    expect(css).toMatch(/--accent:36 80% 97%;/)
    expect(css).toMatch(/--accent-foreground:36 100% 30%;/)
  })

  it("keeps a dark brand visible in dark mode", () => {
    // The shipped dark palette lifts the primary five points, and five points
    // was copied without its precondition. The "Gastronomie" preset (`#1A237E`)
    // came out at 1.72:1 against the engine's dark page — a button the same
    // colour as the background it sits on. WCAG 1.4.11 asks 3:1 of a
    // non-text element, which is what a button, a focus ring and a link are.
    const DARK_PAGE = { h: 224, s: 71, l: 4 }
    for (const value of ["#1a237e", "#4e342e", "#300878", "#1838d0", "#000000"]) {
      const css = buildBrandingCss({ primaryColor: value })
      const dark = css.slice(css.indexOf(".dark{"))
      const m = dark.match(/--primary:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
      const primary = { h: +m[1]!, s: +m[2]!, l: +m[3]! }
      expect(contrastRatio(primary, DARK_PAGE), `${value} -> ${m[0]}`).toBeGreaterThanOrEqual(3)
    }
  })

  it("gives the accent a foreground that can be read on it, at every hue", () => {
    // `--accent-foreground` was fixed at l:30, and lightness is not luminance:
    // the shipped "Chinois" preset (`#FFD600`) emitted 3.75:1 — worse than the
    // engine default it replaces, from one click on a theme card.
    const hex = (n: number) => "#" + n.toString(16).padStart(6, "0")
    let worst = Infinity
    let worstAt = ""
    for (let r = 0; r < 256; r += 16) {
      for (let g = 0; g < 256; g += 16) {
        for (let b = 0; b < 256; b += 16) {
          const value = hex((r << 16) | (g << 8) | b)
          const css = buildBrandingCss({ accentColor: value }, { darkSelector: null })
          const a = css.match(/--accent:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
          const f = css.match(/--accent-foreground:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
          const ratio = contrastRatio(
            { h: +a[1]!, s: +a[2]!, l: +a[3]! },
            { h: +f[1]!, s: +f[2]!, l: +f[3]! }
          )
          if (ratio < worst) {
            worst = ratio
            worstAt = value
          }
        }
      }
    }
    expect(worst, `worst at ${worstAt}`).toBeGreaterThanOrEqual(4.5)
    // The preset that measured 3.75:1 before, pinned by name.
    const chinois = buildBrandingCss({ accentColor: "#FFD600" }, { darkSelector: null })
    const a = chinois.match(/--accent:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
    const f = chinois.match(/--accent-foreground:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
    expect(
      contrastRatio({ h: +a[1]!, s: +a[2]!, l: +a[3]! }, { h: +f[1]!, s: +f[2]!, l: +f[3]! })
    ).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps the secondary a surface even when the picker hands it a slab", () => {
    // `bg-secondary` is a chip or a muted panel — the shipped token is
    // `220 14% 96%`. The light value used to be written through as given on the
    // grounds that every PRESET stores a pale tint; the colour picker does not,
    // and `#d32f2f` painted every chip in the product solid red.
    const css = buildBrandingCss({ secondaryColor: "#d32f2f" }, { darkSelector: null })
    const m = css.match(/--secondary:([\d.]+) ([\d.]+)% ([\d.]+)%;/)!
    expect(Number(m[3]), `lightness of ${m[0]}`).toBeGreaterThanOrEqual(90)
    // A tint the owner did choose is still used exactly as given: capping its
    // saturation would turn the Fast Food preset's warm cream into grey.
    expect(buildBrandingCss({ secondaryColor: "#fff3e0" }, { darkSelector: null }))
      .toContain("--secondary:37 100% 94%;")
  })

  it("carries the brand into dark mode instead of leaving the light palette", () => {
    const css = buildBrandingCss({ primaryColor: "#d32f2f", accentColor: "#ff9800" })
    const dark = css.slice(css.indexOf(".dark{"))
    expect(dark).toContain("--primary:0 65% 56%;")
    // A 97%-light accent surface on a near-black page would be a white bar.
    expect(dark).toContain("--accent:36 40% 12%;")
  })

  it("orders the dark block after the light one", () => {
    // Equal specificity, so the later rule is the one that wins. Reversed, a
    // site in dark mode would render its light palette.
    const css = buildBrandingCss({ primaryColor: "#d32f2f" })
    expect(css.indexOf(":root{")).toBeLessThan(css.indexOf(".dark{"))
  })

  it("emits typography once, not per colour scheme", () => {
    const css = buildBrandingCss({ fontHeading: "Poppins", fontBody: "Inter" })
    expect(css).toBe(':root{--brand-font-heading:"Poppins";--brand-font-body:"Inter";}')
  })

  it("scopes to a preview container when asked", () => {
    const css = buildBrandingCss(
      { primaryColor: "#d32f2f" },
      { selector: "[data-branding-preview]", darkSelector: null }
    )
    expect(css.startsWith("[data-branding-preview]{")).toBe(true)
    expect(css).not.toContain(".dark")
  })

  it("ignores a field it cannot parse and keeps the ones it can", () => {
    const css = buildBrandingCss({
      primaryColor: "not a colour",
      secondaryColor: "#fff3e0",
    })
    expect(css).not.toContain("--primary:")
    expect(css).toContain("--secondary:")
  })

  it("emits no brace, quote or semicolon a stored value put there", () => {
    // The whole injection surface, asserted end to end: every stored field set
    // to something hostile, and the output still closes exactly the braces it
    // opened.
    const css = buildBrandingCss({
      primaryColor: "#fff;}body{display:none}",
      secondaryColor: "</style><script>alert(1)</script>",
      accentColor: "url(https://evil.example/x)",
      fontHeading: 'Inter"; } html { display: none } x { font: "y',
      fontBody: "expression(alert(1))",
    })
    expect(css).toBe("")
  })

  it("reproduces the engine's own theme when an owner picks its colours", () => {
    // The deriver and `app/globals.css` have to agree on the default, or a
    // store that chooses the house palette would not look like the house.
    const css = buildBrandingCss(
      { primaryColor: ENGINE_ORANGE },
      { darkSelector: null }
    )
    expect(css).toContain("--primary:24 95% 53%;")
    expect(css).toContain("--chart-1:24 90% 58%;")
  })
})
