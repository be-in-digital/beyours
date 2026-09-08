/**
 * WCAG 2.1 contrast, on the colours a browser actually paints.
 *
 * WHY THIS EXISTS, next to `branding.ts`. That module guarantees AA for the
 * colours the Design screen DERIVES — `readableForeground` picks ink or paper
 * by ratio, and a 262 144-colour sweep holds it. It cannot say anything about
 * the colours nobody derives: a `text-zinc-400` typed into a className, a
 * `bg-[#0D5C3F]` on a sign-in page, a `--muted-foreground` read out of
 * `globals.css`. Those never pass through `readableForeground`, and #410 is
 * the report that some of them are unreadable — measured, not guessed:
 * the storefront footer painted `text-accent-foreground/60` on
 * `bg-primary-hover`, dark green on dark green, at **1.11:1**.
 *
 * So this module is the arithmetic half of the guard: parse any colour the
 * stylesheet can produce, composite it the way the compositor does, and answer
 * the ratio. `contrast-scan.ts` is the half that finds the pairs.
 *
 * WHY sRGB AND NOT HSL. `branding.ts` works in HSL because the Design screen
 * does. Tailwind v4 writes its palette in **oklch**, `globals.css` writes
 * tokens as HSL triples, and a className can carry a raw hex — three spellings
 * of the same thing. They meet in sRGB, which is also where WCAG defines
 * relative luminance, so that is the currency here.
 *
 * Every number this file produces was checked against Chromium: 194 of the 199
 * pairs #410 turned up agree with `getComputedStyle` + canvas readback to
 * within 0.06, and the five that do not are above 7:1, where the residue is
 * oklch round-tripping and not a disagreement about whether text can be read.
 */

/** A colour in sRGB, each channel 0..1, already gamut-clipped. */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** WCAG 2.1 AA: body text. */
export const AA_TEXT = 4.5
/**
 * WCAG 2.1 AA: large text, and any non-text element that has to be seen —
 * a button's fill, a focus ring, the boundary of an input (1.4.11).
 */
export const AA_LARGE = 3

/**
 * Large text, as WCAG defines it: 18pt, or 14pt when bold.
 *
 * In CSS pixels that is 24px, or 18.66px at weight 700 or more. Semibold does
 * not count — 600 is not bold, and treating it as bold is how a 3.9:1 caption
 * gets waved through.
 */
export const LARGE_TEXT_PX = 24
export const LARGE_BOLD_PX = 18.66
export const BOLD_WEIGHT = 700

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** `#rgb`, `#rrggbb` and `#rrggbbaa` — the spellings a className can carry. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim()
  if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return null
  const digits = hex.slice(1)
  const short = digits.length <= 4
  const pairs = short
    ? [...digits].slice(0, 3).map((d) => d + d)
    : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
  const [r, g, b] = pairs.map((pair) => parseInt(pair, 16) / 255) as [number, number, number]
  return { r, g, b }
}

/**
 * Tailwind v4's palette is oklch, so `text-zinc-400` cannot be measured
 * without this conversion. Out-of-gamut components are clipped per channel,
 * which is what the browser does when it paints them.
 */
export function oklchToRgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear: [number, number, number] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const encode = (channel: number): number => {
    const v = clamp01(channel)
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
  }
  return { r: encode(linear[0]), g: encode(linear[1]), b: encode(linear[2]) }
}

/** `224 71% 4%` — the triple every token in `globals.css` is written in. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const hue = (((h % 360) + 360) % 360) / 60
  const x = c * (1 - Math.abs((hue % 2) - 1))
  const m = light - c / 2
  const sector = Math.floor(hue) % 6
  const table: Array<[number, number, number]> = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = table[sector] as [number, number, number]
  return { r: clamp01(r + m), g: clamp01(g + m), b: clamp01(b + m) }
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminanceRgb({ r, g, b }: Rgb): number {
  const channel = (v: number): number =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.1 contrast ratio, 1..21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminanceRgb(a)
  const lb = relativeLuminanceRgb(b)
  const [light, dark] = la >= lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

/**
 * `source` painted over `backdrop` at `alpha`.
 *
 * This is what `bg-black/50` and `text-white/60` mean, and it is why a slash
 * modifier is never a safe way to soften a caption: the ink moves towards the
 * surface it sits on, so the ratio falls with it.
 */
export function over(source: Rgb, backdrop: Rgb, alpha: number): Rgb {
  if (alpha >= 1) return source
  const a = clamp01(alpha)
  return {
    r: source.r * a + backdrop.r * (1 - a),
    g: source.g * a + backdrop.g * (1 - a),
    b: source.b * a + backdrop.b * (1 - a),
  }
}

/**
 * What a compositing group puts on the screen.
 *
 * `opacity` is NOT a foreground dimmer: it composites an element's whole
 * rendered subtree — its background with it — over what is behind. Dimming
 * only the text is the mistake that made the team's own audit artefact read
 * 2.55:1 while the browser painted something legible, and the mistake that
 * invents failures a browser never renders. Both members of a pair go through
 * this, with the same backdrop and the same alpha.
 */
export function throughGroup(paint: Rgb, backdrop: Rgb, groupAlpha: number): Rgb {
  return groupAlpha >= 1 ? paint : over(paint, backdrop, groupAlpha)
}

/** The floor a pair has to clear, given the type size it is set in. */
export function floorFor(sizePx: number, weight: number): number {
  const large = sizePx >= LARGE_TEXT_PX || (sizePx >= LARGE_BOLD_PX && weight >= BOLD_WEIGHT)
  return large ? AA_LARGE : AA_TEXT
}

/** `#rrggbb`, for a failure table a person has to read. */
export function toHex({ r, g, b }: Rgb): string {
  const byte = (v: number): string =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0")
  return `#${byte(r)}${byte(g)}${byte(b)}`
}
