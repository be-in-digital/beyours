/**
 * Every icon-only control the markup renders, measured against WCAG 2.5.8.
 *
 * WHAT 2.5.8 ASKS (Target Size (Minimum), AA in WCAG 2.2): a pointer target is
 * at least 24 by 24 CSS pixels, unless a 24px circle centred on it touches no
 * other target — the spacing exception — or the same action is available
 * somewhere that does meet the size.
 *
 * WHY IT IS MEASURED HERE RATHER THAN IN A BROWSER, for the same reason
 * `contrast-scan.ts` gives: a browser measures the pages a test happens to
 * mount, and the controls that fail are on the pages no test mounts. A close
 * button in a dialog three states deep is exactly the kind nobody screenshots.
 *
 * WHAT IT LOOKS AT, and this is the whole of the scope: an element with no text
 * of its own. A control whose label is a word is as large as the word; a
 * control whose label is a 16px icon is 16px unless something says otherwise,
 * and that "unless" is what this reads.
 *
 *   - `<Button>` from this package cannot fail: every `size` variant is at
 *     least `h-6`/`size-6`, which is 24px. It is measured anyway, because a
 *     `className` of `h-4 w-4` overrides the variant and that is a real way to
 *     get there.
 *   - A bare `<button>` has no design system behind it. Its size is its
 *     padding plus its icon, and nothing supplies a floor.
 *
 * WHERE IT UNDER-REPORTS, deliberately. A size that arrives through a CSS file,
 * an `asChild` slot, or a class name assembled at runtime is not resolved, and
 * an unresolvable control is skipped rather than guessed at. Reporting a
 * failure for a control that is actually 40px teaches people to stop reading
 * the guard, which costs more than the miss.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"

/** WCAG 2.5.8 Target Size (Minimum), AA. */
export const MINIMUM_TARGET_PX = 24

export interface UndersizedTarget {
  file: string
  line: number
  /** The element as written: `button`, `Button`, `AlertDialogTrigger`… */
  element: string
  heightPx: number
  widthPx: number
  /** The classes the measurement was read from, for the report. */
  classes: string
}

export interface TargetSizeOptions {
  /** Directory holding the app. */
  appDir: string
  /** Subdirectories to walk, relative to `appDir`. */
  dirs: string[]
  /**
   * Report every control below this size instead of below the WCAG minimum.
   *
   * For a liveness check, not for grading — the same escape hatch
   * `contrast-scan`'s `minimumRatio` provides, and for the same reason. A
   * scanner that has stopped resolving anything reports no failures, which
   * reads as the same green as a product with none. Passing a large number
   * makes it report every control it actually measured.
   */
  minimumPx?: number
}

/* -------------------------------------------------------------------------- */
/* Tailwind lengths                                                           */
/* -------------------------------------------------------------------------- */

/** Tailwind's spacing scale is 0.25rem per step, and the root font is 16px. */
const STEP_PX = 4

/**
 * Sizes that are not a number of pixels, and must not be read as one.
 *
 * `w-full`, `w-auto`, `w-fit` and friends are laid out by the parent. A scan
 * that cannot see the parent cannot say how wide they are — and reading them as
 * "no width class, so measure the icon" is how `h-14 w-full` was reported as a
 * 16px target. `UNMEASURABLE` says "there is a size here and it is not mine to
 * know", which skips the element instead of failing it.
 */
const UNMEASURABLE = Symbol("sized by the parent")

/** `4` → 16, `3.5` → 14, `px` → 1, `[18px]` → 18, `[1.5rem]` → 24. */
function length(value: string): number | typeof UNMEASURABLE | null {
  if (value === "px") return 1
  const px = value.match(/^\[(\d+(?:\.\d+)?)px\]$/)
  if (px) return Number(px[1])
  const rem = value.match(/^\[(\d+(?:\.\d+)?)rem\]$/)
  if (rem) return Number(rem[1]) * 16
  if (/^(?:full|auto|fit|screen|min|max|dvh|dvw|svh|lvh)$/.test(value)) return UNMEASURABLE
  if (/^\d+\/\d+$/.test(value)) return UNMEASURABLE
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null
  return Number(value) * STEP_PX
}

/**
 * The value of one utility in a class list, ignoring every variant of it.
 *
 * `hover:h-10` does not size the resting state, and `md:h-10` sizes only one
 * viewport — the small one is the one that has to pass. So a class carrying any
 * `:` prefix is skipped rather than read.
 */
function utility(classes: string[], prefix: string): number | typeof UNMEASURABLE | null {
  for (const cls of classes) {
    if (cls.includes(":")) continue
    if (!cls.startsWith(`${prefix}-`)) continue
    const value = length(cls.slice(prefix.length + 1))
    if (value !== null) return value
  }
  return null
}

/** The numeric part of a utility, treating "sized by the parent" as absent. */
function pixels(classes: string[], prefix: string): number | null {
  const value = utility(classes, prefix)
  return typeof value === "number" ? value : null
}

type Extent = number | typeof UNMEASURABLE | null

interface Box {
  height: Extent
  width: Extent
}

/** What a class list says about an element's own box. */
function box(classes: string[]): Box {
  const square = utility(classes, "size")
  return {
    height: utility(classes, "h") ?? utility(classes, "min-h") ?? square,
    width: utility(classes, "w") ?? utility(classes, "min-w") ?? square,
  }
}

/** The padding a class list adds on each axis. */
function padding(classes: string[]): { y: number; x: number } {
  const all = pixels(classes, "p")
  return {
    y: all ?? pixels(classes, "py") ?? 0,
    x: all ?? pixels(classes, "px") ?? 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Reading the markup                                                          */
/* -------------------------------------------------------------------------- */

/** Only a plain string className is read; anything computed is unknowable. */
function classesOf(element: ts.JsxOpeningLikeElement): string[] | null {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attribute.name.getText() !== "className") continue
    const initializer = attribute.initializer
    if (!initializer) return null
    if (ts.isStringLiteral(initializer)) return initializer.text.split(/\s+/).filter(Boolean)
    if (ts.isJsxExpression(initializer) && initializer.expression) {
      const inner = initializer.expression
      if (ts.isNoSubstitutionTemplateLiteral(inner) || ts.isStringLiteral(inner)) {
        return inner.text.split(/\s+/).filter(Boolean)
      }
    }
    return null
  }
  return []
}

/** The `size` prop as a literal, when one is given. */
function sizeProp(element: ts.JsxOpeningLikeElement): string | null {
  for (const attribute of element.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attribute.name.getText() !== "size") continue
    const initializer = attribute.initializer
    if (initializer && ts.isStringLiteral(initializer)) return initializer.text
  }
  return null
}

/**
 * This package's own `size` variants, so a `<Button size="icon-xs">` is read as
 * the 24px square it is rather than skipped for having no `h-` class.
 *
 * Kept in sync with `components/Button.tsx` by the test beside this file, which
 * fails if a variant is added there and not here — a variant this table does
 * not know is measured as "unknown" and silently skipped, which is the quiet
 * way a guard stops guarding.
 */
export const BUTTON_SIZE_PX: Record<string, Box & { padX: number }> = {
  // `padX` is the `has-[>svg]:px-…` value, not the plain `px-…`: every control
  // this scanner measures is icon-only, so the svg branch is the one that
  // applies. Reading the plain value would over-report the width, and reading
  // no padding at all under-reports it — which is how `<Button size="sm">`
  // around a 16px icon was reported as 16px wide when it renders at 36.
  default: { height: 36, width: null, padX: 12 },
  xs: { height: 24, width: null, padX: 6 },
  sm: { height: 32, width: null, padX: 10 },
  lg: { height: 40, width: null, padX: 16 },
  icon: { height: 36, width: 36, padX: 0 },
  "icon-xs": { height: 24, width: 24, padX: 0 },
  "icon-sm": { height: 32, width: 32, padX: 0 },
  "icon-lg": { height: 40, width: 40, padX: 0 },
}

/**
 * Does this element render any text of its own?
 *
 * A JSX expression counts as text: `{label}` and `{t("cart.clear")}` are words
 * at runtime, and a control carrying one is as wide as they are. Only an
 * element whose children are all elements — an icon, a wrapper around an icon —
 * is icon-only.
 */
function isIconOnly(node: ts.JsxElement): boolean {
  let sawElement = false
  let sawText = false

  /**
   * Recursive, because the text can be one level down.
   * `<Button><Globe/><span>{locale}</span></Button>` has only elements as its
   * direct children and is plainly not icon-only — reading depth one reported
   * the language switcher as a 16px target.
   */
  const walk = (parent: ts.JsxElement | ts.JsxFragment): void => {
    for (const child of parent.children) {
      if (sawText) return
      if (ts.isJsxText(child)) {
        if (child.text.trim() !== "") sawText = true
        continue
      }
      if (ts.isJsxExpression(child)) {
        const inner = child.expression
        // `{" "}` and `{/* comment */}` are not text.
        if (!inner) continue
        if (ts.isStringLiteral(inner) && inner.text.trim() === "") continue
        // `{cond ? <EyeOff/> : <Eye/>}` is an icon written as a choice between
        // two icons. Treating it as text is how the password reveal button —
        // 16 by 16, the smallest control in the product — was skipped.
        if (jsxOnly(inner)) {
          sawElement = true
          continue
        }
        sawText = true
        continue
      }
      if (ts.isJsxElement(child)) {
        sawElement = true
        walk(child)
        continue
      }
      if (ts.isJsxFragment(child)) {
        walk(child)
        continue
      }
      if (ts.isJsxSelfClosingElement(child)) sawElement = true
    }
  }

  walk(node)
  return sawElement && !sawText
}

/** Does this expression evaluate to JSX and nothing else? */
function jsxOnly(node: ts.Expression): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
    return true
  }
  if (ts.isParenthesizedExpression(node)) return jsxOnly(node.expression)
  if (ts.isConditionalExpression(node)) {
    return jsxOnly(node.whenTrue) && jsxOnly(node.whenFalse)
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return jsxOnly(node.right)
  }
  return false
}

/** The first icon-sized descendant's own box, which is what a bare button hugs. */
function iconBox(node: ts.JsxElement): Box | null {
  let found: Box | null = null
  const visit = (child: ts.Node): void => {
    if (found) return
    const element = ts.isJsxElement(child)
      ? child.openingElement
      : ts.isJsxSelfClosingElement(child)
        ? child
        : null
    if (element) {
      const classes = classesOf(element)
      if (classes) {
        const measured = box(classes)
        if (measured.height !== null && measured.width !== null) {
          found = measured
          return
        }
      }
    }
    ts.forEachChild(child, visit)
  }
  for (const child of node.children) visit(child)
  return found
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
        if (entry === "__tests__" || entry === "tests" || entry === "e2e") continue
        walk(path)
      } else if (extname(entry) === ".tsx" && !entry.includes(".test.")) {
        out.push(path)
      }
    }
  }
  walk(root)
  return out
}

/** Every icon-only control smaller than the WCAG 2.5.8 minimum. */
export function scanTargetSize(options: TargetSizeOptions): UndersizedTarget[] {
  const floor = options.minimumPx ?? MINIMUM_TARGET_PX
  const findings: UndersizedTarget[] = []
  const seen = new Set<string>()

  for (const dir of options.dirs) {
    for (const file of sources(join(options.appDir, dir))) {
      if (seen.has(file)) continue
      seen.add(file)
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )

      const visit = (node: ts.Node): void => {
        if (ts.isJsxElement(node)) {
          const element = node.openingElement
          const name = element.tagName.getText()
          const interactive = name === "button" || name === "Button"

          if (interactive && isIconOnly(node)) {
            const classes = classesOf(element)
            if (classes) {
              const own = box(classes)
              const variant =
                name === "Button" ? BUTTON_SIZE_PX[sizeProp(element) ?? "default"] : undefined
              let height: Extent = own.height ?? variant?.height ?? null
              let width: Extent = own.width ?? variant?.width ?? null

              // A control with no box of its own is its icon plus its padding —
              // the element's own, and the `size` variant's when it has one.
              if (height === null || width === null) {
                const icon = iconBox(node)
                if (icon) {
                  const pad = padding(classes)
                  const padY = pad.y
                  const padX = pad.x + (variant?.padX ?? 0)
                  if (height === null && typeof icon.height === "number") {
                    height = icon.height + 2 * padY
                  }
                  if (width === null && typeof icon.width === "number") {
                    width = icon.width + 2 * padX
                  }
                }
              }

              if (
                typeof height === "number" &&
                typeof width === "number" &&
                (height < floor || width < floor)
              ) {
                findings.push({
                  file: relative(options.appDir, file),
                  line: source.getLineAndCharacterOfPosition(element.getStart()).line + 1,
                  element: name,
                  heightPx: height,
                  widthPx: width,
                  classes: classes.join(" "),
                })
              }
            }
          }
        }
        ts.forEachChild(node, visit)
      }

      visit(source)
    }
  }

  return findings.sort(
    (a, b) => a.heightPx * a.widthPx - b.heightPx * b.widthPx || a.file.localeCompare(b.file)
  )
}

/** The failure message, readable without opening this file. */
export function formatUndersized(targets: UndersizedTarget[]): string {
  if (targets.length === 0) return `No icon-only control below ${MINIMUM_TARGET_PX}x${MINIMUM_TARGET_PX} CSS px.`
  const lines = targets.map(
    (t) =>
      `${t.file}:${t.line}  <${t.element}>  ${t.heightPx}x${t.widthPx}px  [${t.classes || "no classes"}]`
  )
  return [
    `${targets.length} icon-only control(s) below the WCAG 2.5.8 minimum of ${MINIMUM_TARGET_PX}x${MINIMUM_TARGET_PX} CSS px:`,
    "",
    ...lines,
    "",
    "Give the control padding, or a size class, or `size=\"icon-xs\"` on a Button.",
  ].join("\n")
}
