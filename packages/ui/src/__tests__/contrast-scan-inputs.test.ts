/**
 * The three inputs `scanContrast` used to ignore, held here.
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
 *  3. a `styles={{ slot: … }}` MAP — the prop a third-party component takes to
 *     be themed. Reading the `style` attribute alone left it unmeasured, and
 *     the one place this codebase uses it is the onboarding tour: forcing the
 *     tour badge to `color: hsl(var(--primary))` on the same
 *     `backgroundColor` — invisible text on the first screen a new owner sees
 *     — left the app sweep at 8 passed.
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

/**
 * A `styles` MAP, which is a different animal from a `style` attribute.
 *
 * `style` paints the element it is written on, so this sweep can pair a colour
 * with the surface it tracked down the tree. A `styles` map does not: each slot
 * is rendered by the third-party component, somewhere this file's JSX never
 * describes. So a slot is read only when it sets BOTH members of the pair, and
 * is contained in both directions — it takes no class from the element that
 * declares it, and it is never the surface a child inherits.
 *
 * Written as `(base) => ({ ...base, … })` because that is how `reactour` — the
 * only consumer of this shape in the codebase — is themed.
 */
describe("scanContrast reads a styles={{ slot }} map", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Themed.tsx"),
    `export function Themed() {
  return (
    <Tour
      styles={{
        badge: (base) => ({ ...base, backgroundColor: "#ffffff", color: "#eeeeee" }),
        controls: (base) => ({ ...base, marginTop: "16px" }),
      }}
    />
  )
}
`,
  )

  const failures = scanContrast({ appDir: root, regions: REGIONS })

  it("measures a slot that sets both members of the pair", () => {
    // #eeeeee on #ffffff is 1.13:1. Nothing here is a class and nothing is a
    // `style` attribute, so before this the file measured as empty.
    const failure = failures.find((entry) => entry.mode === "light")
    expect(failure).toBeDefined()
    expect(failure!.foregroundHex).toBe("#eeeeee")
    expect(failure!.backgroundHex).toBe("#ffffff")
    expect(failure!.ratio).toBeLessThan(1.2)
  })

  it("names the slot, so a failure says which of them is unreadable", () => {
    // A map has several slots and one report. `styles.badge` is the difference
    // between a finding somebody can act on and one they have to go hunting for.
    const failure = failures.find((entry) => entry.mode === "light")!
    expect(failure.foreground).toBe("styles.badge:color:#eeeeee")
    expect(failure.background).toBe("styles.badge:background:#ffffff")
  })
})

describe("scanContrast reads a styles map slot written as a plain object", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Plain.tsx"),
    `export function Plain() {
  return <Tour styles={{ badge: { backgroundColor: "#ffffff", color: "#eeeeee" } }} />
}
`,
  )

  it("does not require the arrow form to see the pair", () => {
    const failure = scanContrast({ appDir: root, regions: REGIONS }).find(
      (entry) => entry.mode === "light",
    )
    expect(failure?.foreground).toBe("styles.badge:color:#eeeeee")
  })
})

describe("scanContrast leaves half a styles map slot unmeasured", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Half.tsx"),
    `export function Half() {
  return <Tour styles={{ badge: (base) => ({ ...base, color: "#eeeeee" }) }} />
}
`,
  )

  it("invents no failure against a surface the slot does not render on", () => {
    // #eeeeee against this fixture's white app surface is 1.13:1, so a reader
    // that fell back to the enclosing context would report it. The slot is not
    // rendered there, and a scanner that guesses is the one nobody reads.
    expect(scanContrast({ appDir: root, regions: REGIONS })).toEqual([])
  })
})

describe("a styles map slot is not the surface its children inherit", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    join(root, "ui/Wrapper.tsx"),
    `export function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <Tour styles={{ popover: (base) => ({ ...base, backgroundColor: "#000000", color: "#ffffff" }) }}>
      <span style={{ color: "#eeeeee" }}>Bonjour</span>
    </Tour>
  )
}
`,
  )

  const failures = scanContrast({ appDir: root, regions: REGIONS })

  it("measures the child against the app's surface, not the slot's", () => {
    // The discriminating case, and the reason containment is asserted rather
    // than assumed. `<TourProvider styles={{ popover: … }}>` wraps the WHOLE
    // admin. If the slot's black leaked into the context, #eeeeee on it is
    // 18.4:1 and this file goes silent in light mode; against the app's own
    // white it is 1.13:1 and reported. Silence here is the bug, not a pass.
    const light = failures.find((entry) => entry.mode === "light")
    expect(light).toBeDefined()
    expect(light!.backgroundHex).toBe("#ffffff")
    expect(light!.foreground).toBe("style:color:#eeeeee")
  })

  it("still measures the slot's own pair", () => {
    // #ffffff on #000000 is 21:1, so the slot itself reports nothing — and the
    // test above would read the same whether the slot were measured or skipped
    // entirely. This is what keeps that from passing vacuously.
    expect(failures.every((entry) => !entry.foreground.startsWith("styles."))).toBe(true)
    const inverted = scanContrast({
      appDir: root,
      regions: REGIONS,
      minimumRatio: 25,
    }).filter((entry) => entry.foreground.startsWith("styles.popover:"))
    expect(inverted.length).toBeGreaterThan(0)
  })
})

/**
 * The floor a slot is judged at, which two of this file's heuristics get wrong
 * for the same reason: both read a fact about the element the prop is WRITTEN
 * on, and a slot is rendered somewhere else entirely.
 */
describe("a styles map slot is judged at the floor for body text", () => {
  const root = fixture()
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  // Self-closing, and nothing here relaxes the type scale.
  writeFileSync(
    join(root, "ui/Closed.tsx"),
    `export function Closed() {
  return <Tour styles={{ badge: (base) => ({ ...base, backgroundColor: "#ffffff", color: "#949494" }) }} />
}
`,
  )

  // Not self-closing, and wrapped in a heading scale.
  writeFileSync(
    join(root, "ui/Scaled.tsx"),
    `export function Scaled({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-2xl">
      <Tour styles={{ popover: (base) => ({ ...base, backgroundColor: "#ffffff", color: "#949494" }) }}>
        {children}
      </Tour>
    </div>
  )
}
`,
  )

  // #949494 on #ffffff is 3.03:1 — under AA for body text, over it for large
  // text and for a graphical object. So either heuristic firing turns this
  // pair silent, and only this value tells the two floors apart.
  const failures = scanContrast({ appDir: root, regions: REGIONS })

  it("does not read a self-closing element as a picture", () => {
    // `isGraphical` means "no JSX children, so it renders no text" — true of
    // `<AlertTriangle className="text-amber-500" />` and false of a component
    // themed through `styles`, whose children the third party supplies. The
    // popover this badge sits in is full of prose.
    const failure = failures.find((entry) => entry.foreground === "styles.badge:color:#949494")
    expect(failure).toBeDefined()
    expect(failure!.floor).toBe(4.5)
  })

  it("does not take the type scale of the element that declares it", () => {
    // An ancestor's `text-2xl` says nothing about a slot's size, and letting it
    // through would relax the floor to the large-text 3:1 — 3.03:1 would then
    // pass on the strength of a heading somewhere else in the tree.
    const failure = failures.find((entry) => entry.foreground === "styles.popover:color:#949494")
    expect(failure).toBeDefined()
    expect(failure!.floor).toBe(4.5)
    expect(failure!.sizePx).toBe(16)
  })
})
