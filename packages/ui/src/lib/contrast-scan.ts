/**
 * Every foreground/background pair the markup actually renders, measured.
 *
 * WHAT #410 ASKED FOR. "Compute the contrast ratio of every foreground/
 * background pair actually rendered in the storefront and admin (light *and*
 * dark, both apps). Produce a table of failures with the measured ratio — not
 * an opinion." This is the instrument that does it, and the guard that keeps
 * doing it: `tests/a11y/contrast.test.ts` in each app runs it over that app's
 * own source and fails on anything below the WCAG 2.1 AA floor.
 *
 * WHY STATIC AND NOT A BROWSER. A browser measures the pages a test happens to
 * mount; this has to measure every page, including the ones no test mounts —
 * which is where the failures were. The arithmetic is checked against Chromium
 * rather than trusted: 194 of the 199 pairs the first sweep found agree with
 * `getComputedStyle` plus canvas readback to within 0.06.
 *
 * THE THREE THINGS THAT MAKE IT HONEST, each of which invented failures until
 * it was handled:
 *
 *  1. `opacity` composites a whole subtree, background included, so it is not
 *     a foreground dimmer. `see contrast.ts#throughGroup`. And `opacity-0
 *     group-hover:opacity-100` is a reveal: the state worth measuring is the
 *     one where the element is visible.
 *  2. A className built by a ternary holds TWO sets of classes, not one. Read
 *     as one bag, `cond ? "bg-primary text-primary-foreground" : "bg-background
 *     text-foreground"` pairs the selected ink with the unselected surface and
 *     reports a 1:1 failure that no state of the component produces.
 *  3. `hover:bg-primary text-foreground hover:text-white` changes both members
 *     at once. Pairing the hovered ink with the resting surface is the same
 *     error one level down, so each interactive state is resolved as a whole.
 *
 * AND THE ONE THING IT CANNOT KNOW: which component renders which. A screen
 * whose surface is painted by a shell in another file has no background in its
 * own tree, so those pairs are reported as `surfaceKnown: false` and are for a
 * person to confirm — the guard holds only the ones where both colours are
 * established in the same tree.
 *
 * WHERE IT UNDER-REPORTS, deliberately. A `data-[state=…]:` or `aria-[…]:`
 * variant is not resolved as a state of its own, so the colour it names is not
 * measured. Treating it as always-applied is the mistake that pairs a selected
 * ink with an unselected surface, and there is no way to tell from the source
 * which of those variants are mutually exclusive. Missing a pair is a gap; a
 * guard that fails on a combination the product never renders is worse, because
 * it teaches people to stop reading it.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"
import {
  AA_LARGE,
  contrast,
  floorFor,
  hslToRgb,
  oklchToRgb,
  over,
  parseHex,
  throughGroup,
  toHex,
  type Rgb,
} from "./contrast.js"

export type Mode = "light" | "dark"

export interface ContrastFailure {
  file: string
  line: number
  mode: Mode
  /** The token scope the element renders under, e.g. `.storefront-theme`. */
  scope: string
  /** The interactive state the pair belongs to: `base`, `hover`, `focus`… */
  state: string
  foreground: string
  background: string
  foregroundHex: string
  backgroundHex: string
  ratio: number
  floor: number
  sizePx: number
  weight: number
  /**
   * True only when an OPAQUE background was painted by this element or an
   * ancestor of it in the same file. A translucent surface over an unknown one
   * is still unknown — the storefront header is `bg-white/10` over the hero
   * IMAGE, and no static reading can say what colour that is.
   */
  surfaceKnown: boolean
}

export interface ScanOptions {
  /** Directory holding the app: its `app/globals.css` and `node_modules`. */
  appDir: string
  /** Subdirectories to walk, each with the token scope it renders under. */
  regions: Array<{ dir: string; scope: string }>
  /** Extra scope selectors to read out of `globals.css`. */
  scopes?: string[]
  /**
   * Report every pair below this ratio instead of below the WCAG floor.
   *
   * For a liveness check, not for grading: a scanner that has stopped
   * resolving anything reports no failures, which reads as the same green as a
   * product with none. Passing 21 makes it report every pair it resolved.
   */
  minimumRatio?: number
}

/* -------------------------------------------------------------------------- */
/* Palettes and tokens                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Tailwind's own palette, read from the installed package.
 *
 * Read rather than transcribed: a table of 288 colours copied into a test is a
 * table that goes stale on the next minor, silently, in the direction of
 * passing.
 */
export function loadTailwindPalette(appDir: string): Map<string, Rgb> {
  const css = readFileSync(join(appDir, "node_modules/tailwindcss/theme.css"), "utf8")
  const palette = new Map<string, Rgb>()
  const declaration = /--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/g
  let match: RegExpExecArray | null
  while ((match = declaration.exec(css))) {
    palette.set(
      `${match[1]}-${match[2]}`,
      oklchToRgb(Number(match[3]) / 100, Number(match[4]), Number(match[5]))
    )
  }
  palette.set("white", { r: 1, g: 1, b: 1 })
  palette.set("black", { r: 0, g: 0, b: 0 })
  return palette
}

/**
 * The design tokens each selector in `globals.css` defines.
 *
 * Balanced-brace scanning, because a selector appears more than once — `:root`
 * is declared inside `@layer base` and again for the sidebar — and a
 * non-greedy match to the first `}` stops in the middle of the first one.
 */
export function loadTokens(appDir: string, selectors: string[]): Map<string, Map<string, Rgb>> {
  // Comments are stripped first: the anchor below looks for a rule boundary,
  // and every block in `globals.css` is introduced by one.
  const css = readFileSync(join(appDir, "app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  const blocks = new Map<string, Map<string, Rgb>>()
  for (const selector of selectors) {
    const tokens = new Map<string, Rgb>()
    const pattern = selector
      .trim()
      .split(/\s+/)
      .map((part) => part.replace(/[.\\]/g, "\\$&"))
      .join("\\s+")
    // Anchored at a rule boundary, not at any whitespace: `.storefront-theme`
    // otherwise matches inside `.dark .storefront-theme` and the light scope
    // silently loads the dark block's values.
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
      const declaration = /--([a-z0-9-]+):\s*(?:hsl\()?\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)?\s*;/g
      let token: RegExpExecArray | null
      while ((token = declaration.exec(body))) {
        tokens.set(token[1]!, hslToRgb(Number(token[2]), Number(token[3]), Number(token[4])))
      }
    }
    blocks.set(selector, tokens)
  }
  return blocks
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

const TEXT_SIZES: Record<string, number> = {
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30,
  "4xl": 36, "5xl": 48, "6xl": 60, "7xl": 72, "8xl": 96, "9xl": 128,
}

const WEIGHTS: Record<string, number> = {
  "font-thin": 100, "font-extralight": 200, "font-light": 300, "font-normal": 400,
  "font-medium": 500, "font-semibold": 600, "font-bold": 700,
  "font-extrabold": 800, "font-black": 900,
}

/** The states a pair can be rendered in, each resolved as a whole. */
const STATES = ["base", "hover", "focus", "focus-visible", "active", "group-hover", "peer-focus"] as const

/**
 * Variants that mean "this component is inactive".
 *
 * WCAG 1.4.3 exempts inactive components from the contrast minimum, and
 * `disabled:opacity-50` is on nearly every primitive in `packages/ui`.
 * Counting it produced dozens of failures for text nobody is asked to read.
 */
const INACTIVE = /^(?:disabled|aria-disabled|data-\[disabled|data-\[state=checked\]:disabled)/

const VARIANT = /^(?:[a-z][a-z0-9-]*|\[[^\]]*\]|(?:group|peer)-[a-z-]+(?:\[[^\]]*\])?|(?:aria|data)-\[[^\]]*\]):/

interface Split {
  variants: string[]
  base: string
}

function splitVariants(cls: string): Split {
  const variants: string[] = []
  let rest = cls
  for (;;) {
    const match = rest.match(VARIANT)
    if (!match) break
    variants.push(match[0].slice(0, -1))
    rest = rest.slice(match[0].length)
  }
  return { variants, base: rest }
}

interface Paint {
  rgb: Rgb
  alpha: number
  cls: string
}

interface Reading {
  backgrounds: Paint[]
  text: Paint | null
  sizePx: number | null
  weight: number | null
  opacity: number
}

/* -------------------------------------------------------------------------- */
/* className expressions                                                       */
/* -------------------------------------------------------------------------- */

const MAX_ALTERNATIVES = 48

/** Every class list this expression can produce, as separate alternatives. */
function alternatives(node: ts.Node): string[][] {
  const cross = (left: string[][], right: string[][]): string[][] => {
    const out: string[][] = []
    for (const a of left) for (const b of right) {
      if (out.length >= MAX_ALTERNATIVES) return out
      out.push([...a, ...b])
    }
    return out
  }
  const dedupe = (lists: string[][]): string[][] => {
    const seen = new Set<string>()
    const out: string[][] = []
    for (const list of lists) {
      const key = list.join(" ")
      if (seen.has(key)) continue
      seen.add(key)
      out.push(list)
      if (out.length >= MAX_ALTERNATIVES) break
    }
    return out
  }
  const words = (text: string): string[][] => [text.split(/\s+/).filter(Boolean)]

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return words(node.text)
  if (ts.isJsxExpression(node)) return node.expression ? alternatives(node.expression) : [[]]
  if (ts.isParenthesizedExpression(node)) return alternatives(node.expression)
  if (ts.isTemplateExpression(node)) {
    let out = words(node.head.text)
    for (const span of node.templateSpans) {
      out = cross(out, alternatives(span.expression))
      out = cross(out, words(span.literal.text))
    }
    return dedupe(out)
  }
  if (ts.isConditionalExpression(node)) {
    // The branch that renders, not both branches at once. Merging them pairs a
    // selected ink with an unselected surface.
    return dedupe([...alternatives(node.whenTrue), ...alternatives(node.whenFalse)])
  }
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return dedupe([...alternatives(node.right), []])
    }
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      return dedupe([...alternatives(node.left), ...alternatives(node.right)])
    }
    return [[]]
  }
  if (ts.isCallExpression(node)) {
    // `cn(...)` / `clsx(...)` / `cva(...)`: every argument contributes.
    let out: string[][] = [[]]
    for (const argument of node.arguments) out = cross(out, alternatives(argument))
    return dedupe(out)
  }
  if (ts.isArrayLiteralExpression(node)) {
    let out: string[][] = [[]]
    for (const element of node.elements) out = cross(out, alternatives(element))
    return dedupe(out)
  }
  if (ts.isObjectLiteralExpression(node)) {
    // `clsx({ "text-red-500": isError })` — each key is optional.
    let out: string[][] = [[]]
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const name = property.name
      const key = ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)
        ? name.text
        : ts.isIdentifier(name)
          ? name.text
          : null
      if (!key) continue
      out = cross(out, [key.split(/\s+/).filter(Boolean), []])
    }
    return dedupe(out)
  }
  return [[]]
}

/**
 * Is this element a graphical object rather than a run of text?
 *
 * `<AlertTriangle className="text-amber-500" />` is an icon: WCAG scores it
 * under 1.4.11 at 3:1, not under 1.4.3 at 4.5:1, and judging it as body text
 * reports failures for pictures nobody is asked to read. The rule is the one
 * thing a parse can actually see — an element with no children renders no text,
 * and `currentColor` on an SVG is what `text-…` is doing there.
 *
 * A `<span className="text-…">Ouvert</span>` has children and stays text.
 */
function isGraphical(node: ts.Node, element: ts.JsxOpeningLikeElement): boolean {
  if (ts.isJsxSelfClosingElement(element)) return true
  if (ts.isJsxElement(node)) {
    return node.children.every(
      (child) => ts.isJsxText(child) && child.text.trim() === ""
    )
  }
  return false
}

function classAlternatives(element: ts.JsxOpeningLikeElement): string[][] {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attribute.name.getText() !== "className" || !attribute.initializer) continue
    const lists = alternatives(attribute.initializer)
    return lists.length ? lists : [[]]
  }
  return []
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

class Resolver {
  constructor(
    private readonly palette: Map<string, Rgb>,
    private readonly tokens: Map<string, Map<string, Rgb>>
  ) {}

  /** The selectors that can define a token here, most specific first. */
  chain(mode: Mode, scope: string): string[] {
    if (!scope) return [mode === "dark" ? ".dark" : ":root"]
    return mode === "dark" ? [`.dark ${scope}`, scope, ".dark"] : [scope, ":root"]
  }

  /** `emerald-600`, `white`, `[#0D5C3F]`, `primary`, `white/10`. */
  colour(word: string, mode: Mode, scope: string): { rgb: Rgb; alpha: number } | null {
    let alpha = 1
    let name = word
    const slash = name.lastIndexOf("/")
    if (slash > 0 && /^\d+$/.test(name.slice(slash + 1))) {
      alpha = Number(name.slice(slash + 1)) / 100
      name = name.slice(0, slash)
    }
    if (name === "transparent" || name === "current" || name === "inherit") return null

    const arbitrary = name.match(/^\[(#[0-9a-fA-F]{3,8})\]$/)
    if (arbitrary) {
      const rgb = parseHex(arbitrary[1]!)
      return rgb ? { rgb, alpha } : null
    }
    const swatch = this.palette.get(name)
    if (swatch) return { rgb: swatch, alpha }

    // A scope selector sits on a DESCENDANT element, so its declaration beats
    // the `:root`/`.dark` value it inherits — a declaration on the element
    // always wins over an inherited one, whatever the layer or the specificity
    // of the rule that set it upstream. That is exactly why
    // `.storefront-theme` having no dark counterpart put near-black storefront
    // ink on the engine's near-black dark surfaces, and it is why the dark
    // scope is consulted before the scope, and the scope before `.dark`.
    for (const selector of this.chain(mode, scope)) {
      const scoped = this.tokens.get(selector)?.get(name)
      if (scoped) return { rgb: scoped, alpha }
    }
    return null
  }

  /** What one class list says, for one colour scheme and one state. */
  read(classes: string[], mode: Mode, scope: string, state: string): Reading {
    const reading: Reading = { backgrounds: [], text: null, sizePx: null, weight: null, opacity: 1 }
    const opacities: number[] = []

    // Unprefixed first, then `dark:`, then the state's own — later wins, which
    // is the order the generated stylesheet puts them in.
    const rank = (variants: string[]): number => {
      if (variants.some((v) => v === state && state !== "base")) return variants.includes("dark") ? 3 : 2
      return variants.includes("dark") ? 1 : 0
    }

    // `pointer-events-none opacity-50` is how this codebase spells "inactive"
    // on a control that is not a <button disabled>. WCAG 1.4.3 exempts it for
    // the same reason it exempts `disabled:`.
    if (classes.includes("pointer-events-none") && classes.some((c) => /^opacity-\d+$/.test(splitVariants(c).base))) {
      return reading
    }

    const applicable = classes
      .map((cls) => ({ cls, ...splitVariants(cls) }))
      .filter(({ variants }) => {
        if (variants.some((v) => INACTIVE.test(v))) return false
        if (variants.includes("dark") && mode !== "dark") return false
        for (const variant of variants) {
          if (variant === "dark") continue
          // A responsive or arbitrary variant is a viewport, not a state.
          if (/^(?:sm|md|lg|xl|2xl|min|max|print|motion-safe|motion-reduce|rtl|ltr|first|last|odd|even|not-|has-|supports-|\[)/.test(variant)) continue
          if (variant === state) continue
          return false
        }
        return true
      })
      .map((entry, index) => ({ ...entry, order: rank(entry.variants) * 1000 + index }))
      .sort((a, b) => a.order - b.order)

    for (const { cls, base } of applicable) {
      if (base.startsWith("bg-")) {
        const paint = this.colour(base.slice(3), mode, scope)
        if (paint) reading.backgrounds = [{ ...paint, cls }]
      } else if (/^(?:from|via|to)-/.test(base)) {
        const paint = this.colour(base.slice(base.indexOf("-") + 1), mode, scope)
        // Every stop of a gradient is a surface some of the text sits on.
        if (paint) reading.backgrounds.push({ ...paint, cls })
      } else if (base.startsWith("text-")) {
        const word = base.slice(5)
        const size = word.replace(/\/\d+$/, "")
        if (size in TEXT_SIZES) {
          reading.sizePx = TEXT_SIZES[size]!
          continue
        }
        const paint = this.colour(word, mode, scope)
        if (paint) reading.text = { ...paint, cls }
      } else if (base in WEIGHTS) {
        reading.weight = WEIGHTS[base]!
      } else if (/^opacity-\d+$/.test(base)) {
        opacities.push(Number(base.slice(8)) / 100)
      }
    }

    const visible = opacities.filter((value) => value > 0)
    reading.opacity = visible.length ? Math.max(...visible) : 1
    return reading
  }
}

/* -------------------------------------------------------------------------- */
/* The walk                                                                    */
/* -------------------------------------------------------------------------- */

interface Context {
  surface: Rgb
  surfaceCls: string
  surfaceKnown: boolean
  backdrop: Rgb
  groupAlpha: number
  sizePx: number
  weight: number
}

function sources(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        if (entry === "__tests__" || entry === "e2e") continue
        walk(path)
      } else if (extname(entry) === ".tsx" && !entry.includes(".test.")) {
        out.push(path)
      }
    }
  }
  walk(root)
  return out
}

/** Every AA failure the given regions render, in both colour schemes. */
export function scanContrast(options: ScanOptions): ContrastFailure[] {
  const { appDir, regions } = options
  const scopes = options.scopes ?? []
  const selectors = [
    ":root",
    ".dark",
    ...scopes,
    ...scopes.map((scope) => `.dark ${scope}`),
  ]
  const tokens = loadTokens(appDir, selectors)
  const resolver = new Resolver(loadTailwindPalette(appDir), tokens)

  const failures: ContrastFailure[] = []
  const reported = new Set<string>()
  const visited = new Set<string>()

  for (const { dir, scope } of regions) {
    for (const file of sources(join(appDir, dir))) {
      if (visited.has(file)) continue
      visited.add(file)
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )

      for (const mode of ["light", "dark"] as const) {
        const page = resolver.colour("background", mode, scope)!.rgb

        const visit = (node: ts.Node, context: Context): void => {
          let next = context
          const element = ts.isJsxElement(node)
            ? node.openingElement
            : ts.isJsxSelfClosingElement(node)
              ? node
              : null

          if (element) {
            const lists = classAlternatives(element)
            const graphical = isGraphical(node, element)
            const line = source.getLineAndCharacterOfPosition(element.getStart()).line + 1
            const inherited: Context[] = []

            for (const classes of lists) {
              if (!classes.length) continue
              for (const state of STATES) {
                if (state !== "base" && !classes.some((c) => splitVariants(c).variants.includes(state))) continue
                const reading = resolver.read(classes, mode, scope, state)

                let backdrop = context.backdrop
                let groupAlpha = context.groupAlpha
                if (reading.opacity < 1) {
                  backdrop = throughGroup(context.surface, context.backdrop, context.groupAlpha)
                  groupAlpha = reading.opacity
                }

                const surfaces = reading.backgrounds.length
                  ? reading.backgrounds.map((paint) => ({
                      rgb: over(paint.rgb, context.surface, paint.alpha),
                      cls: paint.cls,
                      // Opaque paint establishes the surface whatever was
                      // behind it; translucent paint inherits the doubt.
                      known: paint.alpha >= 1 || context.surfaceKnown,
                    }))
                  : [{ rgb: context.surface, cls: context.surfaceCls, known: context.surfaceKnown }]

                const sizePx = reading.sizePx ?? context.sizePx
                const weight = reading.weight ?? context.weight

                if (reading.text) {
                  const floor =
                    options.minimumRatio ??
                    (graphical ? AA_LARGE : floorFor(sizePx, weight))
                  for (const surface of surfaces) {
                    const ink = throughGroup(
                      over(reading.text.rgb, surface.rgb, reading.text.alpha),
                      backdrop,
                      groupAlpha
                    )
                    const ground = throughGroup(surface.rgb, backdrop, groupAlpha)
                    const ratio = contrast(ink, ground)
                    if (ratio >= floor) continue
                    const key = `${file}|${mode}|${state}|${reading.text.cls}|${surface.cls}`
                    if (reported.has(key)) continue
                    reported.add(key)
                    failures.push({
                      file: relative(appDir, file),
                      line,
                      mode,
                      scope,
                      state,
                      foreground: reading.text.cls,
                      background: surface.cls,
                      foregroundHex: toHex(ink),
                      backgroundHex: toHex(ground),
                      // Three decimals, not two: at two, a pair measuring
                      // 4.4996 prints as "4.50:1 (needs 4.5)" and reads as a
                      // rounding bug rather than as the failure it is.
                      ratio: Math.round(ratio * 1000) / 1000,
                      floor,
                      sizePx,
                      weight,
                      surfaceKnown: surface.known,
                    })
                  }
                }

                if (state === "base") {
                  inherited.push({
                    surface: surfaces[0]!.rgb,
                    surfaceCls: surfaces[0]!.cls,
                    surfaceKnown: surfaces[0]!.known,
                    backdrop,
                    groupAlpha,
                    sizePx,
                    weight,
                  })
                }
              }
            }
            if (inherited.length) next = inherited[0]!
          }

          node.forEachChild((child) => visit(child, next))
        }

        visit(source, {
          surface: page,
          surfaceCls: "<page>",
          // The page surface is an assumption until some element paints one:
          // a component can be composed onto a hero image, a game shell or a
          // dialog, none of which is this file's `--background`.
          surfaceKnown: false,
          backdrop: page,
          groupAlpha: 1,
          sizePx: 16,
          weight: 400,
        })
      }
    }
  }

  failures.sort((a, b) => a.ratio - b.ratio)
  return failures
}

/** The failure table #410 asks for, as text a person can read in a diff. */
export function formatFailures(failures: ContrastFailure[]): string {
  if (failures.length === 0) return "No pair below the WCAG 2.1 AA floor."
  const rows = failures.map(
    (f) =>
      `${f.ratio.toFixed(3)}:1 (needs ${f.floor}) ${f.mode}/${f.state} ` +
      `${f.foreground} ${f.foregroundHex} on ${f.background} ${f.backgroundHex} — ${f.file}:${f.line}`
  )
  return rows.join("\n")
}
