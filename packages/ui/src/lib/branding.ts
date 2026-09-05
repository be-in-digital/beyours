/**
 * An establishment's stored branding, rendered as design tokens.
 *
 * WHY THIS EXISTS. The Design screen (`packages/admin/src/pages/design`) has
 * always written `stores.branding` — colours, typography, logo — and until this
 * module nothing anywhere read the colours back. `--primary` had exactly one
 * definition per app, the literal `24 95% 53%` in `app/globals.css`, so every
 * establishment the engine has ever delivered shipped the same orange. For a
 * product priced per store whose pitch is "a theme by restaurant type", that is
 * the differentiator not existing.
 *
 * WHAT IT DOES. It turns the stored blob into a CSS rule set that redefines the
 * theme's custom properties. It emits nothing else, touches no DOM, and knows
 * nothing about React or Convex, so it can be unit-tested on its own and run on
 * the server as happily as in the browser.
 *
 * THE INJECTION SURFACE, which is the reason for the strictness below.
 * `stores.updateBranding` validates types and length, not grammar: a colour is
 * `v.string()`, so `red;}body{display:none}` is a value the mutation accepts.
 * Interpolating that into a `<style>` is a stored CSS injection that any
 * establishment owner could aim at their own diners — and, via the admin, at
 * whoever else opens the screen. So NOTHING here interpolates a stored string.
 * Colours are parsed to numbers and re-emitted from those numbers; fonts are
 * rebuilt from an allowed character set, family by family. A value that does
 * not parse produces no declaration at all, which leaves the engine default in
 * place — the same result as never having set it.
 */

/** Hue in degrees, saturation and lightness in percent. */
export interface Hsl {
  h: number
  s: number
  l: number
}

/**
 * The blob as it arrives here: every value unknown until it is parsed.
 *
 * The typed shape is `StoreBranding` in `@be-in-digital/convex-schema`, and
 * this module deliberately does not import it. The stored column is
 * `v.any()`, so a deployment can hold anything, and a design-system package
 * has no business depending on the database schema to say so.
 */
type BrandingValues = Record<string, unknown>

export interface BrandingCssOptions {
  /** Selector carrying the light-mode tokens. Defaults to `:root`. */
  selector?: string
  /**
   * Selector carrying the dark-mode tokens. Defaults to `.dark`, which is what
   * `next-themes` puts on `<html>` in both apps.
   *
   * Pass `null` for a preview swatch, where a dark block would either never
   * match or — worse — match the surrounding page and repaint it.
   */
  darkSelector?: string | null
}

/** The engine's own ink, from `app/globals.css`. */
const INK: Hsl = { h: 224, s: 71, l: 4 }
const PAPER: Hsl = { h: 0, s: 0, l: 100 }

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Whole degrees and whole percents, which is how every token in `globals.css`
 * is written — and what makes a picked colour reproduce one exactly. An
 * `<input type="color">` can only express 8 bits per channel, so `24 95% 53%`
 * round-trips through `#f97015` as `23.9 95% 52.9%`; rounding closes that gap
 * at a cost (a tenth of a degree of hue) no eye can resolve.
 */
const trim = (value: number): string => String(Math.round(value))

/**
 * Parse a colour the Design screen could have produced.
 *
 * `<input type="color">` yields `#rrggbb` and the paired text box lets an owner
 * type; `#rgb` is the one other spelling worth accepting. Everything else —
 * named colours, `rgb()`, `var()`, anything with a brace or a semicolon in it —
 * returns null and is simply not written.
 */
export function parseBrandColor(value: unknown): Hsl | null {
  if (typeof value !== "string") return null
  const hex = value.trim()
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return null

  const digits = hex.slice(1)
  const pairs =
    digits.length === 3
      ? [...digits].map((d) => d + d)
      : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
  const [r, g, b] = pairs.map((pair) => parseInt(pair, 16) / 255) as [
    number,
    number,
    number,
  ]

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const delta = max - min

  if (delta === 0) return { h: 0, s: 0, l: l * 100 }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / delta) % 6
  else if (max === g) h = (b - r) / delta + 2
  else h = (r - g) / delta + 4

  h *= 60
  if (h < 0) h += 360

  return { h, s: s * 100, l: l * 100 }
}

/** WCAG 2.1 relative luminance of an HSL colour. */
export function relativeLuminance({ h, s, l }: Hsl): number {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2

  const sector = Math.floor(((h % 360) + 360) % 360 / 60)
  const rgb: [number, number, number] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector] as [number, number, number]

  const channel = (v: number): number => {
    const value = v + m
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return (
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
  )
}

/** WCAG 2.1 contrast ratio between two colours. */
export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * The text colour to put on top of `background`.
 *
 * Chosen by contrast rather than fixed, because the owner picks the background
 * and half the palette they might pick is light. `globals.css` hardcodes white
 * on the default orange (2.9:1, below AA); a stored `#FFEB3B` with white on it
 * would be 1.1:1 — a button whose label is invisible. The engine default is
 * left alone: it only applies where no branding is set, and changing it would
 * restyle every site already delivered.
 */
export function readableForeground(background: Hsl): Hsl {
  return contrastRatio(background, PAPER) >= contrastRatio(background, INK)
    ? PAPER
    : INK
}

/** `24 95% 53%` — the triple form every token in `globals.css` is written in. */
export function formatHsl({ h, s, l }: Hsl): string {
  return `${trim(((h % 360) + 360) % 360)} ${trim(clamp(s, 0, 100))}% ${trim(clamp(l, 0, 100))}%`
}

/**
 * Rebuild a font stack from what an owner typed.
 *
 * The typography box is free text with the placeholder "Inter, Roboto,
 * Arial…", so a stack is what it is meant to hold. Each family is rebuilt from
 * `[A-Za-z0-9 -]` and re-quoted, which drops any family that carried something
 * else rather than trying to escape it. Four families is more than a stack ever
 * needs and bounds what one field can emit.
 *
 * A stored family only renders if the visitor's device has it or the app loads
 * it: the engine bundles Inter and Poppins through `next/font` and nothing here
 * fetches a webfont. The engine default is kept as the last fallback so an
 * unavailable family degrades to today's appearance rather than to Times.
 */
export function sanitizeFontStack(value: unknown): string | null {
  if (typeof value !== "string") return null
  const families = value
    .split(",")
    .map((family) => family.trim().replace(/^["']|["']$/g, "").trim())
    .filter((family) => family.length > 0 && family.length <= 64)
    .filter((family) => /^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(family))
    .slice(0, 4)

  if (families.length === 0) return null
  return families.map((family) => `"${family}"`).join(", ")
}

/** One `--name: value;` declaration, or nothing when the value is absent. */
function declare(name: string, value: string | null): string {
  return value === null ? "" : `--${name}:${value};`
}

/**
 * The light and dark token sets an establishment's colours imply.
 *
 * WHY THE ROLES ARE DERIVED AND NOT ASSIGNED. `--accent` in `globals.css` is
 * `24 80% 97%` — a near-white tint of the primary hue — because `bg-accent` is
 * what a hovered row and a hovered menu item are painted with. The Design
 * screen's accent field holds a saturated colour (`#FF9800` in its own Fast
 * Food preset). Writing that straight onto `--accent` would not tint the theme;
 * it would set every hover state in the product to a solid orange block. So the
 * stored colour supplies the HUE and the token keeps its ROLE, using the same
 * relationship the shipped palette already encodes:
 *
 *   --accent            = hue, saturation capped at 80, lightness 97  (12 dark)
 *   --accent-foreground = hue, saturation,             lightness 30  (70 dark)
 *
 * `--secondary` is the exception: its field already holds a pale surface in
 * every preset, and `bg-secondary` is a surface, so it is used as given.
 */
function tokens(branding: BrandingValues, dark: boolean): string {
  const primary = parseBrandColor(branding.primaryColor)
  const secondary = parseBrandColor(branding.secondaryColor)
  const accent = parseBrandColor(branding.accentColor)
  const heading = sanitizeFontStack(branding.fontHeading)
  const body = sanitizeFontStack(branding.fontBody)

  // The shipped dark palette lifts the primary five points (53 -> 58) so it
  // keeps its punch against a near-black background. Same move here.
  const shade = (colour: Hsl): Hsl =>
    dark ? { ...colour, l: clamp(colour.l + 5, 0, 95) } : colour

  let css = ""

  if (primary) {
    const tone = shade(primary)
    const value = formatHsl(tone)
    css += declare("primary", value)
    css += declare("primary-foreground", formatHsl(readableForeground(tone)))
    // `--ring` is the primary in both shipped palettes: the focus ring is the
    // brand colour, and leaving it orange under a red brand is the kind of
    // detail that makes a theme look like a skin.
    css += declare("ring", value)
    // `--chart-1` is the primary softened and lifted in both shipped palettes
    // (`24 95% 53%` -> `24 90% 58%`), so the dashboard's first series follows
    // the brand instead of staying orange under a red one.
    css += declare(
      "chart-1",
      formatHsl({ h: primary.h, s: clamp(primary.s - 5, 0, 100), l: clamp(primary.l + 5, 0, 95) })
    )
    // The sidebar tokens are spelled as full `hsl()` values in `globals.css`,
    // not as triples, so they are emitted in that form.
    css += declare("sidebar-primary", `hsl(${value})`)
    css += declare("sidebar-ring", `hsl(${value})`)
  }

  if (secondary) {
    const tone = dark
      ? { h: secondary.h, s: clamp(secondary.s, 0, 28), l: 17 }
      : secondary
    css += declare("secondary", formatHsl(tone))
    css += declare("secondary-foreground", formatHsl(readableForeground(tone)))
  }

  if (accent) {
    const surface: Hsl = dark
      ? { h: accent.h, s: clamp(accent.s, 0, 40), l: 12 }
      : { h: accent.h, s: clamp(accent.s, 0, 80), l: 97 }
    css += declare("accent", formatHsl(surface))
    css += declare(
      "accent-foreground",
      formatHsl({ h: accent.h, s: accent.s, l: dark ? 70 : 30 })
    )
    css += declare("sidebar-accent", `hsl(${formatHsl(surface)})`)
  }

  // Typography is one pair of variables rather than two per mode: a font does
  // not change with the colour scheme. They are emitted in the light block only
  // (see `buildBrandingCss`).
  if (!dark) {
    css += declare("brand-font-heading", heading)
    css += declare("brand-font-body", body)
  }

  return css
}

/**
 * The whole stylesheet for one establishment, or `""` when it has no branding.
 *
 * An empty string is the important return: it is what a store with no colours
 * set produces, and it means no `<style>` is rendered at all rather than one
 * that redefines the theme in terms of itself.
 *
 * Both blocks are emitted unlayered, so they beat `globals.css` (whose tokens
 * sit in `@layer base`, which loses to every unlayered rule) and, being later
 * in the document, the client zone's `site/theme.css` as well. The dark block
 * follows the light one for the same reason `globals.css` orders them that way:
 * `.dark` and `:root` have equal specificity, so the later rule wins, and
 * without a dark block a branded site would render its light palette in dark
 * mode.
 */
export function buildBrandingCss(
  branding: unknown,
  options: BrandingCssOptions = {}
): string {
  if (!branding || typeof branding !== "object" || Array.isArray(branding)) {
    return ""
  }
  const { selector = ":root", darkSelector = ".dark" } = options
  const values = branding as BrandingValues

  const light = tokens(values, false)
  if (light === "") return ""

  let css = `${selector}{${light}}`
  if (darkSelector) {
    const dark = tokens(values, true)
    if (dark !== "") css += `${darkSelector}{${dark}}`
  }
  return css
}
