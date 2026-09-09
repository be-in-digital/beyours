/**
 * The inline-style reader, on its own.
 *
 * WHY IT NEEDS ITS OWN TEST. The app-level sweep proves the reader is WIRED —
 * it counts the pairs resolved out of the real tree. It cannot prove the reader
 * is CORRECT about a shape the tree does not currently contain, and every one
 * of those is a way for it to go quietly blind again. A reader that resolves
 * nothing reports no failures, which is the same green as a sound product; that
 * is exactly how `style={{}}` went unmeasured while the class sweep grew four
 * guards around it.
 *
 * The gap this closes, measured: painting the onboarding tour's badge
 * `--primary` on `--primary` gave a pair of EXACTLY 1.000:1 with both the tour's
 * own test and the whole contrast sweep green — the sweep because it read
 * `className` and nothing else, the tour's test because its assertions are
 * about the shape of the style object rather than the numbers in it.
 */

import { mkdtempSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { scanContrast } from "../lib/contrast-scan"

/**
 * A throwaway app just complete enough for the scanner: a `globals.css` with a
 * palette, a `node_modules/tailwindcss/theme.css` for the swatch table, and one
 * component to read.
 */
const root = mkdtempSync(join(tmpdir(), "contrast-inline-"))
afterAll(() => rmSync(root, { recursive: true, force: true }))

mkdirSync(join(root, "app"), { recursive: true })
mkdirSync(join(root, "src"), { recursive: true })
mkdirSync(join(root, "node_modules/tailwindcss"), { recursive: true })

writeFileSync(
  join(root, "app/globals.css"),
  `@layer base {
     :root {
       --background: 0 0% 100%;
       --foreground: 0 0% 0%;
       --primary: 24 95% 37%;
       --primary-foreground: 0 0% 100%;
     }
     .dark {
       --background: 0 0% 0%;
       --foreground: 0 0% 100%;
       --primary: 24 95% 58%;
       --primary-foreground: 0 0% 0%;
     }
   }`
)
// The scanner reads Tailwind's own palette out of the installed package. An
// empty sheet is enough: these fixtures name tokens, not swatches.
writeFileSync(join(root, "node_modules/tailwindcss/theme.css"), ":root { }")

const write = (name: string, source: string) => {
  writeFileSync(join(root, "src", name), source)
}

const scan = () =>
  scanContrast({ appDir: root, regions: [{ dir: "src", scope: "" }] })

const clear = () => {
  rmSync(join(root, "src"), { recursive: true, force: true })
  mkdirSync(join(root, "src"), { recursive: true })
}

describe("inline style={{ }}", () => {
  it("reports a pair that cannot be read", () => {
    clear()
    // The exact shape the audit used: one token painted on itself. 1.000:1.
    write("Bad.tsx", `export const Bad = () => (
      <div style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }}>
        Bonjour
      </div>
    )`)
    const failures = scan()
    expect(failures.length).toBeGreaterThan(0)
    expect(failures[0]!.ratio).toBe(1)
    expect(failures[0]!.foreground).toBe("style.color=primary")
    expect(failures[0]!.background).toBe("style.background=primary")
  })

  it("passes a pair that can", () => {
    clear()
    write("Good.tsx", `export const Good = () => (
      <div style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
        Bonjour
      </div>
    )`)
    expect(scan()).toEqual([])
  })

  it("reads hex literals as well as tokens", () => {
    clear()
    write("Hex.tsx", `export const Hex = () => (
      <div style={{ backgroundColor: "#ffffff", color: "#eeeeee" }}>Bonjour</div>
    )`)
    // TWO, not one: the sweep runs in light and in dark, and a hex literal is
    // the same colour in both — so a fixed pair that fails, fails twice. A
    // token pair would differ between the two and could fail in only one.
    const failures = scan()
    expect(failures.length).toBe(2)
    expect(failures[0]!.foreground).toBe("style.color=[#eeeeee]")
  })

  it("takes the fallback of a ?? , because that is what the engine ships", () => {
    clear()
    // `block.textColor ?? "#eeeeee"` is the real shape in the email block
    // preview: the left-hand side is whatever a client later chooses and no
    // static reading can know it; the right-hand side is what we ship.
    write("Fallback.tsx", `export const Fallback = ({ block }: any) => (
      <div style={{ backgroundColor: block.bg ?? "#ffffff", color: block.ink ?? "#eeeeee" }}>
        Bonjour
      </div>
    )`)
    // Light and dark; see the note above.
    expect(scan().length).toBe(2)
  })

  it("says nothing when only one half of the pair is declared", () => {
    clear()
    // The other half is inherited from somewhere this cannot see. A real
    // finding, but not a measurable one — and guessing is how a guard earns a
    // reputation for false alarms and gets switched off.
    write("Half.tsx", `export const Half = () => (
      <div style={{ color: "hsl(var(--primary))" }}>Bonjour</div>
    )`)
    expect(scan()).toEqual([])
  })

  it("says nothing when the value is built at runtime", () => {
    clear()
    write("Runtime.tsx", `const COLORS = ["#111", "#222"]
    export const Runtime = ({ i }: any) => (
      <div style={{ backgroundColor: COLORS[i], color: COLORS[i] }}>Bonjour</div>
    )`)
    expect(scan()).toEqual([])
  })
})

describe("a styles={{ }} map handed to a third-party component", () => {
  it("measures each named surface on its own", () => {
    clear()
    // Reactour's shape, which is what the onboarding tour uses: a map of named
    // surfaces whose values are functions returning a style object. Two
    // entries, one sound and one not, so the test proves it reads both and
    // judges them separately.
    write("Tour.tsx", `export const Tour = () => (
      <Provider
        styles={{
          popover: (base: any) => ({
            ...base,
            backgroundColor: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
          }),
          badge: (base: any) => ({
            ...base,
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary))",
          }),
        }}
      />
    )`)
    // One of the two surfaces fails, in both colour schemes — and `popover`
    // appears in neither, which is what proves they are judged separately
    // rather than as one blob.
    const failures = scan()
    expect(failures.length).toBe(2)
    expect(failures.every((f) => f.foreground === "styles.badge.color=primary")).toBe(true)
    expect(failures.every((f) => f.ratio === 1)).toBe(true)
  })

  it("reads a plain object as readily as a function returning one", () => {
    clear()
    write("Plain.tsx", `export const Plain = () => (
      <Provider styles={{ badge: { backgroundColor: "#ffffff", color: "#eeeeee" } }} />
    )`)
    expect(scan().length).toBe(2)
  })
})
