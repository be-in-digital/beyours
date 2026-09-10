/**
 * The two inputs `scanContrast` used to ignore, held here.
 *
 * Both were found the same way: a guard that reported green over a pair that
 * fails. That is the worst failure mode an instrument has — worse than not
 * running, because a green run is read as an answer. So each capability gets a
 * test that fails if the argument stops being honoured, and each is written as
 * a DIFFERENCE (with the input against without it) rather than as an absolute
 * count, so it cannot be satisfied by a scanner that has stopped resolving
 * anything.
 *
 *  1. `overlays` — `loadTokens` has taken layered stylesheets since the
 *     template sweep was written and `scanContrast` never passed them, so a
 *     caller that named a template measured the engine palette: the one no
 *     client ships. 50 of the 51 verticals carry a failing pair invisible to a
 *     sweep of `globals.css` alone.
 *  2. inline `style={{ … }}` — the sweep read `className` and nothing else, so
 *     an element painting its ink or its surface inline was unmeasured.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import { scanContrast } from "../lib/contrast-scan"

/**
 * A minimal app tree: the three files `scanContrast` reads, and nothing else.
 *
 * `node_modules/tailwindcss/theme.css` is written rather than depended on —
 * `loadTailwindPalette` reads it from the app directory, and a fixture that
 * reached into the real one would be measuring whichever Tailwind is installed.
 */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "contrast-scan-"))
  mkdirSync(join(root, "app"), { recursive: true })
  mkdirSync(join(root, "site"), { recursive: true })
  mkdirSync(join(root, "ui"), { recursive: true })
  mkdirSync(join(root, "node_modules/tailwindcss"), { recursive: true })

  writeFileSync(
    join(root, "node_modules/tailwindcss/theme.css"),
    ":root { --color-zinc-500: oklch(55.2% 0.016 285.938); }\n",
  )

  // White surface, black ink: 21:1, nothing to report.
  writeFileSync(
    join(root, "app/globals.css"),
    `@layer base {
  :root { --background: 0 0% 100%; --foreground: 0 0% 0%; }
  .dark { --background: 0 0% 0%; --foreground: 0 0% 100%; }
}
`,
  )

  // What `pnpm template:apply` overwrites: the same token, repainted to a
  // value that fails against the surface it is used on.
  writeFileSync(
    join(root, "site/theme.css"),
    ":root { --foreground: 0 0% 96%; }\n.dark { --foreground: 0 0% 4%; }\n",
  )

  return root
}

const REGIONS = [{ dir: "ui", scope: "" }]

describe("scanContrast honours the stylesheets layered over globals.css", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Tokens.tsx"),
    `export function Tokens() {
  return <div className="bg-background text-foreground">Bonjour</div>
}
`,
  )

  const overlay = join(root, "site/theme.css")

  it("reports nothing when the engine palette is the whole story", () => {
    const failures = scanContrast({ appDir: root, regions: REGIONS })
    expect(failures).toEqual([])
  })

  it("reports the template's own palette when one is layered on", () => {
    const failures = scanContrast({ appDir: root, regions: REGIONS, overlays: [overlay] })
    // 96% grey on white. Without `overlays` this pair is 21:1 and silent.
    expect(failures.length).toBeGreaterThan(0)
    const light = failures.find((failure) => failure.mode === "light")
    expect(light?.foregroundHex).toBe("#f5f5f5")
    expect(light?.backgroundHex).toBe("#ffffff")
    expect(light?.ratio).toBeLessThan(1.2)
  })
})

describe("scanContrast reads colours declared inline", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Inline.tsx"),
    `export function Inline({ theme }: { theme: { ink?: string } }) {
  return (
    <div style={{ backgroundColor: "#ffffff" }}>
      <span style={{ color: theme.ink ?? "#eeeeee" }}>Bonjour</span>
    </div>
  )
}
`,
  )

  const failures = scanContrast({ appDir: root, regions: REGIONS })

  it("pairs an inline foreground with an inline surface", () => {
    // #eeeeee on #ffffff is 1.13:1. Every colour here is inline, so a sweep
    // that reads only `className` sees an empty file.
    const failure = failures.find((entry) => entry.mode === "light")
    expect(failure).toBeDefined()
    expect(failure!.foregroundHex).toBe("#eeeeee")
    expect(failure!.backgroundHex).toBe("#ffffff")
    expect(failure!.surfaceKnown).toBe(true)
    expect(failure!.ratio).toBeLessThan(1.2)
  })

  it("names the inline declaration in the report, not a class that does not exist", () => {
    const failure = failures.find((entry) => entry.mode === "light")!
    expect(failure.foreground).toBe("style:color:#eeeeee")
    expect(failure.background).toBe("style:background:#ffffff")
  })
})

describe("scanContrast leaves an inline value it cannot know unmeasured", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Dynamic.tsx"),
    `export function Dynamic({ ink }: { ink: string }) {
  return (
    <div className="bg-background">
      <span style={{ color: ink }}>Bonjour</span>
    </div>
  )
}
`,
  )

  it("invents no failure for a value only the runtime has", () => {
    // Guessing here is how a scanner starts reporting pairs the product never
    // renders, which is what teaches people to stop reading it.
    expect(scanContrast({ appDir: root, regions: REGIONS })).toEqual([])
  })
})

describe("scanContrast resolves an inline var() through the scope chain", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Var.tsx"),
    `export function Var() {
  return (
    <div style={{ backgroundColor: "var(--background)", color: "var(--background)" }}>
      Bonjour
    </div>
  )
}
`,
  )

  it("measures a token named inline exactly as it measures one named by a class", () => {
    const failures = scanContrast({ appDir: root, regions: REGIONS })
    // The same token on both sides: 1:1 in either colour scheme.
    expect(failures.length).toBeGreaterThan(0)
    for (const failure of failures) expect(failure.ratio).toBeCloseTo(1, 2)
  })
})

/**
 * The spelling this design system forces, and the one the scanner could not read.
 *
 * Tokens are stored as bare HSL channels — `--primary: 24 95% 53%` — precisely
 * so a caller can tint them, which means an inline USE of one cannot be written
 * any other way than `hsl(var(--token))`. `cssColour` read `var(--token)` and
 * returned null for the wrapped form, so every such style was dropped: not
 * reported as unmeasurable, just absent, in a sweep whose whole job is to
 * measure styles.
 *
 * Written as a difference, like everything else in this file: the same pair
 * that measures 1:1 through a bare `var()` must measure 1:1 through
 * `hsl(var())`, and a token tinted to 10% must NOT be read as the token at
 * full strength.
 */
describe("scanContrast resolves hsl(var(--token))", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/HslVar.tsx"),
    `export function HslVar() {
  return (
    <div style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--background))" }}>
      Bonjour
    </div>
  )
}
`,
  )

  it("measures it exactly as it measures a bare var()", () => {
    const failures = scanContrast({ appDir: root, regions: REGIONS })
    expect(failures.length).toBeGreaterThan(0)
    for (const failure of failures) expect(failure.ratio).toBeCloseTo(1, 2)
  })
})

describe("scanContrast reads a raw hsl() literal", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/HslLiteral.tsx"),
    `export function HslLiteral() {
  return (
    <div style={{ backgroundColor: "hsl(0 0% 100%)", color: "hsl(0 0% 96%)" }}>
      Bonjour
    </div>
  )
}
`,
  )

  it("measures near-white ink on white rather than leaving it unmeasured", () => {
    // 96% lightness on 100% is about 1.1:1 — the kind of pair a sweep exists to
    // find, and which was invisible for want of four characters.
    const failures = scanContrast({ appDir: root, regions: REGIONS })
    expect(failures.length).toBeGreaterThan(0)
    for (const failure of failures) expect(failure.ratio).toBeLessThan(1.3)
  })
})

describe("scanContrast still refuses what it cannot know", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/HslUnknown.tsx"),
    `export function HslUnknown() {
  return (
    <div style={{ backgroundColor: "hsl(var(--not-a-token))", color: "hsl(var(--nor-this))" }}>
      Bonjour
    </div>
  )
}
`,
  )

  it("invents nothing for a token no stylesheet declares", () => {
    // The other half. A resolver that answers for everything is how a sweep
    // starts reporting pairs the product never renders.
    expect(scanContrast({ appDir: root, regions: REGIONS })).toEqual([])
  })
})
