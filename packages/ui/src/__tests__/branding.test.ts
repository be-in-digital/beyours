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
    const yellow = parseBrandColor("#ffeb3b")!
    expect(contrastRatio(yellow, { h: 0, s: 0, l: 100 })).toBeLessThan(1.5)
    expect(readableForeground(yellow)).toEqual({ h: 224, s: 71, l: 4 })
  })

  it("always beats 4.5:1, across the hue circle", () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [20, 35, 50, 65, 80, 95]) {
        const colour = { h, s: 85, l }
        expect(
          contrastRatio(colour, readableForeground(colour)),
          `h=${h} l=${l}`
        ).toBeGreaterThanOrEqual(4.5)
      }
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
      "--primary-foreground:224 71% 4%;"
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
