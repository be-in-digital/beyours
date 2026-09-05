/**
 * One design system, and only one.
 *
 * WHAT WAS BROKEN. There were five copies of it. `packages/ui` held 50
 * components, `apps/reference/components/ui` and `apps/themes/components/ui`
 * held 37 each (byte-identical to one another, divergent from the package),
 * and `packages/admin/src/ui` held nine more. Sixteen of the twenty-six shared
 * names had drifted: a default Button was `h-10` in the package and `h-9` in
 * the apps, with different focus rings, so the same storefront rendered two
 * button heights depending on which page a diner was on. Twelve files per app
 * imported from both systems at once — `BlogAutoConfigForm.tsx` took
 * Button/Badge/Input/Separator from the package and Label/Switch from the local
 * copy, on one form.
 *
 * A comparison test would not have caught it: the two apps' copies were
 * byte-identical to each other, so every twin check in the repository was
 * blind. What catches it is asserting there is nowhere else for a second copy
 * to live, and pinning the geometry the survivor has.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

import { buttonVariants } from "../components/Button"
import { badgeVariants } from "../components/Badge"

const UI_SRC = path.join(__dirname, "..")
const REPO = path.join(UI_SRC, "../../..")

/** Every place a second copy of the design system used to live. */
const FORMER_COPIES = [
  "apps/reference/components/ui",
  "apps/themes/components/ui",
  "packages/admin/src/ui",
]

/** Source trees that consume the design system rather than being it. */
const CONSUMERS = [
  "apps/reference/app",
  "apps/reference/components",
  "apps/reference/lib",
  "apps/themes/app",
  "apps/themes/components",
  "apps/themes/lib",
  "packages/admin/src",
]

/**
 * Every name a module exports, in both spellings that matter here: the
 * `export function X` form and the `function X` + `export { X }` form that
 * every shadcn component uses. Reading only the first is how the collision
 * check below silently found nothing.
 */
function exportedNames(src: string): Set<string> {
  const names = new Set<string>()
  for (const m of src.matchAll(/^export (?:function|const|class) (\w+)/gm)) {
    names.add(m[1]!)
  }
  for (const m of src.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const raw of m[1]!.split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim()
      if (name) names.add(name)
    }
  }
  return names
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") return []
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe("the design system has one home", () => {
  for (const dir of FORMER_COPIES) {
    it(`${dir} no longer exists`, () => {
      expect(fs.existsSync(path.join(REPO, dir)), `${dir} is back`).toBe(false)
    })
  }

  it("nothing imports a local copy of a primitive", () => {
    // The import specifier is the thing that lets a fork grow back: as long as
    // `@/components/ui/button` resolves to anything, someone can put a second
    // Button behind it and no type error will say so.
    const offenders: string[] = []
    for (const dir of CONSUMERS) {
      for (const file of walk(path.join(REPO, dir))) {
        const src = fs.readFileSync(file, "utf8")
        if (/from ["']@\/components\/ui|from ["'](?:\.\.\/)+ui\/|from ["']\.\/ui\//.test(src)) {
          offenders.push(path.relative(REPO, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("defines no variants of its own", () => {
    // The sharpest of these checks, and the one the others missed. A second
    // design system does not have to reappear at a path this file knows about
    // or behind an import specifier it recognises: a `cva()` in any consumer
    // file is a component with its own geometry, whatever it is called and
    // wherever it lives. A scratch `packages/admin/src/components/design/
    // button.tsx` — old geometry, `h-10`, the deleted ring-offset focus
    // treatment — passed every other assertion here.
    //
    // Zero is the honest bar. Variants belong to the design system; a consumer
    // that needs a new one needs it in `packages/ui`.
    const offenders: string[] = []
    for (const dir of CONSUMERS) {
      for (const file of walk(path.join(REPO, dir))) {
        if (/\bcva\(/.test(fs.readFileSync(file, "utf8"))) {
          offenders.push(path.relative(REPO, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("has no second implementation of a name it exports", () => {
    // The name check behind the variant one: a component defined in an app or
    // in `packages/admin` under a name the design system already exports is
    // the fork in its earliest form, before anyone notices the two look
    // different.
    //
    // One pair is known and allowed, with its reason. Do not add a row here to
    // silence a finding — converge it or rename it.
    const ALLOWED = new Map<string, string>([
      [
        "EmptyState",
        // Two genuinely different components sharing a name. The apps' takes a
        // `LucideIcon` and an `{ label, onClick }` action and has three
        // consumers; the package's takes `ReactNode`s, draws a dashed border,
        // and has none. The one that renders is the app's. This is the fork
        // pattern, caught early: it closes by converging the two or renaming
        // one, not by deleting the dead half — see the dead-code verdict in
        // `tasks/reference-themes-divergence.md`.
        "apps/*/components/admin/EmptyState.tsx",
      ],
    ])

    const exported = new Set<string>()
    for (const file of walk(path.join(UI_SRC, "components"))) {
      for (const name of exportedNames(fs.readFileSync(file, "utf8"))) {
        if (/^[A-Z]/.test(name) || name.endsWith("Variants")) exported.add(name)
      }
    }
    // The set has to be non-trivial, or this test passes by finding nothing.
    // It read `^export function` only at first, which misses the form every
    // shadcn file uses — `function Button()` with `export { Button }` at the
    // bottom — so `Button` itself was not in it.
    expect(exported.has("Button"), "the export scan found no Button").toBe(true)
    expect(exported.size).toBeGreaterThan(80)

    const offenders: string[] = []
    for (const dir of CONSUMERS) {
      for (const file of walk(path.join(REPO, dir))) {
        const src = fs.readFileSync(file, "utf8")
        // A re-export is not a second implementation; a local definition is.
        for (const name of exportedNames(src)) {
          if (!exported.has(name) || ALLOWED.has(name)) continue
          const defined = new RegExp(
            `^(?:export )?(?:function|const|class) ${name}\\b`,
            "m"
          ).test(src)
          if (defined) offenders.push(`${name} in ${path.relative(REPO, file)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it("is reached through one specifier", () => {
    // `@be-in-digital/ui/components` and the root now resolve to the same
    // modules, so two spellings would not fork the code — but they would hide
    // which system a line is talking about, which is how the last one grew.
    const offenders: string[] = []
    for (const dir of CONSUMERS) {
      for (const file of walk(path.join(REPO, dir))) {
        const src = fs.readFileSync(file, "utf8")
        if (/from ["']@be-in-digital\/ui\/(components|restaurant|admin)["']/.test(src)) {
          offenders.push(path.relative(REPO, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("the surviving geometry is the newer generation", () => {
  // Pinned rather than described: these exact strings are what a diner sees,
  // and the defect was that two of them existed. A change here should be a
  // deliberate design decision showing up in a diff, not a drift.

  it("sizes the Button as shadcn's current generation does", () => {
    expect(buttonVariants({ size: "default" })).toContain("h-9")
    expect(buttonVariants({ size: "sm" })).toContain("h-8")
    expect(buttonVariants({ size: "lg" })).toContain("h-10")
    expect(buttonVariants({ size: "icon" })).toContain("size-9")
  })

  it("keeps the sizes the old package copy never had", () => {
    // `xs`, `icon-xs` and `icon-lg` exist only in the newer generation.
    // Converging the other way would have deleted them.
    for (const size of ["xs", "icon-xs", "icon-lg"] as const) {
      expect(buttonVariants({ size }), size).not.toEqual(buttonVariants({ size: "default" }))
    }
  })

  it("uses the Tailwind v4 focus ring, once", () => {
    const base = buttonVariants()
    expect(base).toContain("focus-visible:ring-[3px]")
    expect(base).toContain("focus-visible:border-ring")
    // The old package ring. Two components carrying different focus treatments
    // is what made the fork visible to a keyboard user.
    expect(base).not.toContain("ring-offset-2")
  })

  it("keeps the Badge variants the newer generation added", () => {
    for (const variant of ["ghost", "link"] as const) {
      expect(badgeVariants({ variant }), variant).not.toEqual(badgeVariants())
    }
  })

  it("emits the data-slot attributes the app and stylesheet select on", () => {
    // `app/globals.css` has a rule keyed on `[data-slot="dialog-overlay"]`
    // (it is what makes a Google Places suggestion clickable inside a dialog),
    // and the e2e helpers reach for `[data-slot="sidebar"]`,
    // `[data-slot="dialog-content"]` and `[data-slot="checkbox"]`. The old
    // package generation had none of them.
    const required: Record<string, string[]> = {
      "Dialog.tsx": ["dialog-overlay", "dialog-content"],
      "Sidebar.tsx": ["sidebar", "sidebar-trigger"],
      "Checkbox.tsx": ["checkbox"],
      "Button.tsx": ["button"],
      "Table.tsx": ["table", "table-container"],
    }
    for (const [file, slots] of Object.entries(required)) {
      const src = fs.readFileSync(path.join(UI_SRC, "components", file), "utf8")
      for (const slot of slots) {
        expect(src, `${file} lost data-slot="${slot}"`).toContain(`data-slot="${slot}"`)
      }
    }
  })

  it("keeps CardTitle in the document outline", () => {
    // The newer generation renders a `<div>` here. Sixty cards in
    // `packages/admin` alone were `<h3>` before the convergence, and five e2e
    // assertions find a card by `getByRole("heading")` — "Uber Eats",
    // "Deliveroo", "Uber Direct", "Alertes sonores", "Type de commande". A
    // `<div>` drops every one of them from the outline, silently: nothing
    // type-checks it and no unit test renders it.
    const src = fs.readFileSync(path.join(UI_SRC, "components", "Card.tsx"), "utf8")
    expect(src).toMatch(/as: Comp = "h3"/)
    expect(src).toContain('data-slot="card-title"')
  })

  it("kept the dialog fix the app copy had lost", () => {
    // The one place the package was ahead: a dialog taller than the window grew
    // past it in both directions, so its buttons sat below the screen. The fix
    // lived only in the package copy, and the app copy is the one that
    // rendered. Converging on the app copy verbatim would have shipped the bug.
    const src = fs.readFileSync(path.join(UI_SRC, "components", "Dialog.tsx"), "utf8")
    expect(src).toContain("max-h-[calc(100dvh-2rem)]")
    expect(src).toContain("overflow-y-auto")
  })
})
