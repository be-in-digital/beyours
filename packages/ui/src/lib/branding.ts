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
   * Extra selectors that must receive the same tokens, because they redefine
   * them on an element of their own.
   *
   * WHY THIS IS NOT OPTIONAL POLISH. Custom properties are resolved per
   * element, and a declaration ON an element always beats one it would have
   * INHERITED — layers and specificity settle conflicts within one element,
   * not across the tree. `globals.css` sets the storefront palette on
   * `.storefront-theme`, which is a `<div>` inside `<html>`; this stylesheet
   * targets `:root` and `.dark`, which are `<html>`. So every token the
   * storefront scope names — `--primary`, `--primary-foreground`,
   * `--accent`, `--background` and the rest — was overwritten right back to
   * the engine green before it reached a diner. Measured in Chromium: an
   * establishment that picked `#d32f2f` got a red admin and a green
   * storefront, which is the whole feature not working on the one page it was
   * built for. Passing `[".storefront-theme"]` puts the tokens on that element
   * too, unlayered, so they win there as well. #410.
   */
  scopes?: string[]
  /**
   * Selector carrying the dark-mode tokens. Defaults to `.dark`, which is what
   * `next-themes` puts on `<html>` in both apps.
   *
   * Pass `null` for a preview swatch, where a dark block would either never
   * match or — worse — match the surrounding page and repaint it.
   */
  darkSelector?: string | null
}

/**
 * NOTE ON ROUNDING, which every `readableForeground` call below observes.
 * `formatHsl` emits whole degrees and whole percents, so the colour a browser
 * paints is the ROUNDED one. Choosing a label for the unrounded candidate is a
 * guarantee about a number nobody ever sees: it left the sidebar's selected
 * item at 4.4911:1 on `#a05010`. Every call site therefore rounds first, the
 * same way `readableOn` measures on the rounded pair.
 */

/**
 * The two colours anything derived here may be written in.
 *
 * `INK` was the engine's own near-black (`224 71% 4%`) and that is 4.5:1 short:
 * swept over all 16 777 216 hex values, the crossover where neither white nor
 * that ink reaches AA bottoms out at 4.4897:1 (`#e8194d`), below the bar on
 * 37 372 colours. The difference is imperceptible and the claim was still
 * false, so the ink is black — which puts the worst case above 4.5:1 and lets
 * `readableForeground` mean what its name says.
 */
const INK: Hsl = { h: 0, s: 0, l: 0 }
const PAPER: Hsl = { h: 0, s: 0, l: 100 }

/** WCAG AA for body text, and for a large or non-text element. */
const AA = 4.5
const LARGE_AA = 3

/** The integer triple `formatHsl` will emit, so contrast is judged on it. */
function round({ h, s, l }: Hsl): Hsl {
  return {
    h: Math.round(((h % 360) + 360) % 360),
    s: Math.round(clamp(s, 0, 100)),
    l: Math.round(clamp(l, 0, 100)),
  }
}

/** The engine's dark page, which a dark-mode brand colour sits on. */
const DARK_PAGE: Hsl = { h: 224, s: 71, l: 4 }

/**
 * The LIGHTEST dark ground a derived colour can land on.
 *
 * There is more than one now: the engine's `.dark` is `224 71% 4%` and the
 * storefront's is `158 24% 7%`, and this stylesheet is emitted for both. A
 * lighter ground is the harder case — the ratio falls as the page rises — so
 * every dark-mode guarantee is measured against this one, which makes it true
 * of the darker page as well.
 */
const DARK_PAGE_LIGHTEST: Hsl = { h: 158, s: 24, l: 7 }

/**
 * The engine's light page (`--background`, `0 0% 99%`).
 *
 * Named for the same reason `DARK_PAGE` is: a colour that has to be READ has
 * to be walked against the surface it will be read on, and "light" is not a
 * surface.
 */
const LIGHT_PAGE: Hsl = { h: 0, s: 0, l: 99 }

/**
 * Walk a colour's lightness until it can be read on `surface`.
 *
 * The alternative — a fixed lightness per role — is what produced a 3.75:1
 * accent on the shipped "Chinois" preset: `l:30` is legible under a blue tint
 * and not under a yellow one, because lightness is not luminance. Stepping is
 * cheap (at most 100 iterations of arithmetic, at render time on the server)
 * and it is the only version that holds for every hue.
 *
 * Falls back to plain ink or paper when the hue cannot reach AA at any
 * lightness, which is the honest answer rather than a near-miss.
 */
function readableOn(surface: Hsl, hue: Hsl, dark: boolean): Hsl {
  // Measured on the ROUNDED pair, because integers are what `formatHsl` emits
  // and therefore what a browser paints. Checking the unrounded candidate put
  // the worst accent at 4.449:1 — a guarantee that held for a number nobody
  // ever sees.
  const target = round(surface)
  const step = dark ? 1 : -1
  let l = dark ? 70 : 30
  for (let i = 0; i <= 100; i++) {
    const candidate = round({ h: hue.h, s: hue.s, l: clamp(l, 0, 100) })
    if (contrastRatio(candidate, target) >= AA) return candidate
    l += step
    if (l < 0 || l > 100) break
  }
  return readableForeground(target)
}

/**
 * Lift a dark-mode brand colour until it separates from the dark page.
 *
 * 3:1 rather than 4.5:1: this is the colour of a button, a focus ring and a
 * link — a large or non-text element, which is what WCAG 1.4.11 asks 3:1 of.
 * Demanding body-text contrast here would wash every dark brand out to a pastel
 * nobody chose.
 */
function lightenUntilVisible(colour: Hsl): Hsl {
  let { l } = colour
  while (l < 100 && contrastRatio(round({ ...colour, l }), DARK_PAGE_LIGHTEST) < LARGE_AA) l += 1
  return { ...colour, l }
}

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
  // keeps its punch against a near-black background — but five points is the
  // right move only for a colour that starts near 53. Applied to a dark brand
  // it does nothing that matters: the "Gastronomie" preset (`#1A237E`) came
  // out at 1.72:1 against the dark background, an invisible button. The lift
  // continues until the colour separates from the page it sits on.
  const shade = (colour: Hsl): Hsl =>
    dark ? lightenUntilVisible({ ...colour, l: clamp(colour.l + 5, 0, 95) }) : colour

  let css = ""

  if (primary) {
    const tone = shade(primary)
    const value = formatHsl(tone)
    css += declare("primary", value)
    css += declare("primary-foreground", formatHsl(readableForeground(round(tone))))
    // The pressed state is its own colour, not `primary/90`: at 90% opacity a
    // dark brand blends towards a light page and gets LIGHTER on hover. Seven
    // points of lightness, away from the page in whichever mode this is.
    css += declare(
      "primary-hover",
      formatHsl({ ...tone, l: clamp(dark ? tone.l + 7 : tone.l - 7, 0, 100) })
    )
    // `--ring` is the primary in both shipped palettes: the focus ring is the
    // brand colour, and leaving it orange under a red brand is the kind of
    // detail that makes a theme look like a skin.
    css += declare("ring", value)
    // `--primary-ink` is the brand colour a WORD can be written in.
    //
    // `--primary` is a FILL — a button, a badge, a bar — and it is the colour
    // the owner picked, unchanged, because that is the point of picking it.
    // `text-primary` asks the same value to be readable ON the page, which is
    // a different question with a different answer: `#f97015`, the engine's own
    // orange, measures 2.85:1 against white. So the ink is the same hue walked
    // until it can be read on the page it sits on — the identical treatment
    // `--accent-foreground` already gets, and for the identical reason. #410.
    css += declare(
      "primary-ink",
      formatHsl(readableOn(dark ? DARK_PAGE_LIGHTEST : LIGHT_PAGE, primary, dark))
    )
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
    // And its label. `--sidebar-primary-foreground` was a fixed white in both
    // shipped palettes, which is wrong for a light brand exactly as it was
    // wrong for `--primary-foreground`: on the engine's own dark-mode orange it
    // measured 2.57:1. Derived from the same tone, so it inverts with it.
    css += declare(
      "sidebar-primary-foreground",
      `hsl(${formatHsl(readableForeground(round(tone)))})`
    )
    css += declare("sidebar-ring", `hsl(${value})`)
  }

  if (secondary) {
    // `bg-secondary` is a surface — a chip, a muted panel — and the shipped
    // token is `220 14% 96%`. Every preset stores a pale tint here, so the
    // light value used to be written through as given; the colour PICKER does
    // not, and `#d32f2f` painted every chip in the product a solid red slab.
    // The stored colour supplies the hue, the token keeps its role, exactly as
    // the accent does. Dark mode already did this.
    // A value that is already a surface is used exactly as given — every preset
    // stores one, and capping their saturation turned `#fff3e0` from a warm
    // cream into grey. Only a value that is not a surface is made into one.
    const tone = dark
      ? { h: secondary.h, s: clamp(secondary.s, 0, 28), l: 17 }
      : secondary.l >= 85
        ? secondary
        : { h: secondary.h, s: clamp(secondary.s, 0, 80), l: 96 }
    css += declare("secondary", formatHsl(tone))
    css += declare("secondary-foreground", formatHsl(readableForeground(round(tone))))
  }

  if (accent) {
    const surface: Hsl = dark
      ? { h: accent.h, s: clamp(accent.s, 0, 40), l: 12 }
      : { h: accent.h, s: clamp(accent.s, 0, 80), l: 97 }
    css += declare("accent", formatHsl(surface))
    // Darkened (or lightened) until it can be read on its own surface, rather
    // than fixed at l:30/l:70. A fixed lightness is a fixed lightness for every
    // hue, and yellow is not blue: the shipped "Chinois" preset (`#FFD600`)
    // emitted 3.75:1 that way — worse than the engine default it replaces, from
    // one click on a theme card.
    css += declare("accent-foreground", formatHsl(readableOn(surface, accent, dark)))
    css += declare("sidebar-accent", `hsl(${formatHsl(surface)})`)
    // The accent as the owner actually picked it. `--accent` above is a tint,
    // because `bg-accent` paints hover surfaces; a cart badge or a "nouveau"
    // pill needs the saturated version, and without this token the storefront
    // hard-coded one and the accent field only ever moved hover states.
    css += declare("accent-solid", formatHsl(accent))
    // And the label that goes on it. `bg-accent-solid` is the cart badge and
    // the "nouveau" pill, and the storefront wrote `text-white` on it — 2.78:1
    // on the shipped orange, and worse on any lighter accent an owner picks.
    css += declare("accent-solid-foreground", formatHsl(readableForeground(round(accent))))
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
  const { selector = ":root", darkSelector = ".dark", scopes = [] } = options
  const lightSelector = [selector, ...scopes].join(",")
  const darkSelectorList = darkSelector
    ? [darkSelector, ...scopes.map((scope) => `${darkSelector} ${scope}`)].join(",")
    : null
  const values = branding as BrandingValues

  const light = tokens(values, false)
  if (light === "") return ""

  let css = `${lightSelector}{${light}}`
  if (darkSelectorList) {
    const dark = tokens(values, true)
    if (dark !== "") css += `${darkSelectorList}{${dark}}`
  }
  return css
}
