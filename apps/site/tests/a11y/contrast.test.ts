/**
 * The commercial site's own colours, measured.
 *
 * WHY THIS FILE EXISTS. `apps/themes` and `apps/reference` have carried a
 * contrast sweep since #410. `apps/site` had NONE — no guard of any kind — and
 * it is the half of the product a prospect meets first, plus the whole
 * `/parrainage` affiliate portal that real apporteurs d'affaires sign into.
 * The audit that found this measured `focus-visible:ring-primary/40` on
 * `--background` at 1.696:1 against the 3:1 WCAG 1.4.11 asks of a focus
 * indicator, across eleven files in `app/parrainage/` alone.
 *
 * WHY IT DOES NOT IMPORT THE ENGINE'S SCANNER. Two reasons, both structural.
 *
 *   1. `apps/site` depends on NONE of the `@be-in-digital/*` packages, on
 *      purpose — it is a website, not an instance of the product, and
 *      `dependency-hygiene.test.ts` next door is what keeps it that way.
 *      Importing `@be-in-digital/ui/contrast-scan` here would be the first
 *      engine dependency this app has ever had, to run a test.
 *   2. It would not work if it did. `loadTokens` parses `--token: H S% L%`
 *      triples, because that is what the engine's `globals.css` declares. This
 *      app declares plain hex — `--ring: #c5542c` — and every token would
 *      resolve to nothing, which reports as zero failures and reads as green.
 *
 * So the WCAG arithmetic is re-stated here, in about thirty lines, over this
 * app's own token spelling. It is the same formula (WCAG 2.1 relative
 * luminance), and the ratios it produces for the shared cases agree with the
 * engine's to the second decimal.
 *
 * WHAT IT DOES NOT DO. This is the token matrix plus a focus-ring sweep, not
 * the full markup sweep the engine apps run. A pair that fails only for one
 * hand-written class combination is not caught here yet. That is a narrower
 * guard than the engine's, stated rather than implied — and it is the guard
 * that would have caught every failure the audit actually found.
 */

import { readFileSync, readdirSync, type Dirent } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/** WCAG 2.1: normal text needs 4.5:1, large text and non-text need 3:1. */
const AA_TEXT = 4.5
const AA_LARGE = 3

type Rgb = readonly [number, number, number]

/** `#rgb`, `#rrggbb` and `rgba(r, g, b, a)` — the three spellings this app uses. */
function parseColour(raw: string): Rgb | null {
  const value = raw.trim()
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const digits = hex[1]!
    const full =
      digits.length === 3
        ? digits
            .split("")
            .map((d) => d + d)
            .join("")
        : digits
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ] as const
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] as const
  }
  return null
}

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/**
 * Every `--token: value` this stylesheet declares, per selector block.
 *
 * The LAST declaration wins, which is what the browser does: this app declares
 * `:root` twice — the site palette at the top and the semantic status tokens
 * the superadmin console adds at `:531` — and the second block is additive
 * rather than a replacement.
 */
function loadTokens(): Map<string, Map<string, Rgb>> {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  )
  const blocks = new Map<string, Map<string, Rgb>>()
  for (const selector of [":root", ".admin-scope"]) {
    const tokens = new Map<string, Rgb>()
    const pattern = selector.replace(/[.]/g, "\\$&")
    const head = new RegExp(String.raw`(?:^|[}{;])\s*${pattern}\s*\{`, "g")
    let match: RegExpExecArray | null
    while ((match = head.exec(css))) {
      let depth = 1
      let i = head.lastIndex
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++
        else if (css[i] === "}") depth--
        i++
      }
      const body = css.slice(head.lastIndex, i - 1)
      const declaration = /--([a-z0-9-]+):\s*([^;]+);/g
      let token: RegExpExecArray | null
      while ((token = declaration.exec(body))) {
        const colour = parseColour(token[2]!)
        if (colour) tokens.set(token[1]!, colour)
      }
    }
    blocks.set(selector, tokens)
  }
  return blocks
}

const TOKENS = loadTokens()

/** The two palettes this app renders: the public site, and the /admin console. */
const SCOPES = [
  { label: "site", selector: ":root" },
  { label: "admin console", selector: ".admin-scope" },
] as const

const resolve = (selector: string, name: string): Rgb | null =>
  TOKENS.get(selector)?.get(name) ??
  (selector === ":root" ? null : TOKENS.get(":root")?.get(name) ?? null)

/** Every label that has to be read on its own fill. */
const LABEL_ON_FILL: Array<[string, string]> = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["primary-foreground", "primary"],
]

/**
 * NOT measured, and why: `--text-primary`, `--text-secondary`, `--text-tertiary`
 * and `--text-accent` are declared at `globals.css:78-81` and read by NOTHING —
 * no `var(--text-primary)` anywhere in the app, and no `--color-text-*` bridge
 * into Tailwind's theme, so no class reaches them either. (Tailwind's
 * `text-primary` resolves `--color-primary`; it is a different token that
 * happens to read alike.) Measuring a colour no word is written in produces
 * failures nobody can see, which is how a guard gets muted. They are left in
 * the stylesheet as dead declarations rather than deleted here — that is a
 * tidy-up, not an accessibility fix — and this note is what stops the next
 * person adding them back to the matrix.
 */

/** WCAG 1.4.11: a control that has to be seen needs 3:1, text or not. */
const NON_TEXT = ["primary", "ring", "input", "destructive"]

describe("the commercial site's token matrix", () => {
  it("resolved a palette at all", () => {
    // A parser that matches nothing reports no failures, which is the same
    // green as a sound palette. This app spells its tokens as hex; if that ever
    // becomes `oklch()` the two assertions below stop measuring anything and
    // this one says so.
    expect(TOKENS.get(":root")!.size).toBeGreaterThan(20)
    expect(resolve(":root", "ring")).not.toBeNull()
  })

  it("clears AA for every label on its own fill", () => {
    const below: string[] = []
    for (const { label, selector } of SCOPES) {
      for (const [ink, surface] of LABEL_ON_FILL) {
        const a = resolve(selector, ink)
        const b = resolve(selector, surface)
        if (!a || !b) continue
        const ratio = contrast(a, b)
        if (ratio < AA_TEXT) {
          below.push(`${label}: ${ratio.toFixed(2)}:1  --${ink} on --${surface}`)
        }
      }
    }
    expect(below).toEqual([])
  })

  it("separates every control from the page it sits on", () => {
    const below: string[] = []
    for (const { label, selector } of SCOPES) {
      const page = resolve(selector, "background")
      if (!page) continue
      for (const token of NON_TEXT) {
        const value = resolve(selector, token)
        if (!value) continue
        const ratio = contrast(value, page)
        if (ratio < AA_LARGE) {
          below.push(`${label}: ${ratio.toFixed(2)}:1  --${token} vs --background`)
        }
      }
    }
    expect(below).toEqual([])
  })
})

describe("the focus indicator", () => {
  /**
   * A faded ring is not a ring.
   *
   * Alpha composites toward the page, so `focus-visible:ring-primary/40` on
   * this app's `--background` measured 1.696:1 where the token itself clears
   * 3:1 — and it was written that way in eleven files under `app/parrainage/`,
   * which is the portal an apporteur d'affaires signs into. The token measured
   * above is only the right thing to measure if the product renders the token.
   *
   * `ring-destructive/NN` is excluded for the same reason the engine's guard
   * excludes it: `aria-invalid:ring-destructive/20` is emphasis layered over a
   * full-opacity border, not the thing that says where the keyboard is.
   */
  it("is rendered at full token opacity, everywhere", () => {
    const faded: string[] = []
    const walk = (dir: string): void => {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(path)
        } else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
          readFileSync(path, "utf8")
            .split("\n")
            .forEach((line, index) => {
              const match = line.match(
                /(?:focus-visible|focus)\]?:ring-(?!destructive\/)([a-z-]+)\/(\d+)/
              )
              if (match) faded.push(`${path}:${index + 1} — ring-${match[1]}/${match[2]}`)
            })
        }
      }
    }
    for (const root of ["app", "components"]) walk(root)
    expect(faded).toEqual([])
  })

  it("is actually reading this app's source", () => {
    // The sweep above reports nothing both when the app is clean and when it
    // has stopped finding files. This counts what it walked.
    let files = 0
    const walk = (dir: string): void => {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name.endsWith(".tsx")) files++
      }
    }
    for (const root of ["app", "components"]) walk(root)
    expect(files).toBeGreaterThan(50)
  })
})
