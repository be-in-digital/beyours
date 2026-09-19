/**
 * Every screen this package exports is reachable, in both apps.
 *
 * WHY: the defect this package shipped most often is a screen that is written,
 * correct, and rendered by nothing. `PaymentsPage` — the only transaction
 * ledger in the product — had no route, no nav entry and no mount, so an owner
 * could not see a payment or issue a refund. `DesignPage` was the same, and so
 * were `KitchenPage` and `LanguagesPage`, which each had a hand-rolled copy in
 * both apps instead. None of it fails to compile, none of it fails a type
 * check, and nothing else notices.
 *
 * The rule this file enforces is the one the audit ended on: **an exported
 * page is either mounted or gone.** Adding a screen to `src/index.ts` without
 * a route in both apps fails here, which is the moment it is cheapest to fix.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const

const read = (file: string): string => fs.readFileSync(file, "utf8")

/** Every `*Page` this package offers as public API. */
function exportedPages(): string[] {
  const barrel = read(path.join(ADMIN_SRC, "index.ts"))
  const names = new Set<string>()
  for (const m of barrel.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
    for (const raw of (m[1] as string).split(",")) {
      const name = raw.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /Page$/.test(name)) names.add(name)
    }
  }
  return [...names].sort()
}

/** Every route file under an app's `(admin)` group, with its source. */
function routeFiles(app: string): { file: string; src: string }[] {
  const root = path.join(REPO, "apps", app, "app/(admin)")
  const out: { file: string; src: string }[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") out.push({ file: full, src: read(full) })
    }
  }
  walk(root)
  return out
}

const ROUTES = Object.fromEntries(APPS.map((app) => [app, routeFiles(app)])) as Record<
  string,
  { file: string; src: string }[]
>

/** The route files in `app` that import `name` from this package. */
function mountsOf(app: string, name: string): string[] {
  const used = new RegExp(`\\b${name}\\b`)
  return ROUTES[app]!
    .filter(({ src }) => src.includes("@be-yours/admin") && used.test(src))
    .map(({ file }) => file.split("(admin)")[1] as string)
}

describe("the sweep can see what it claims to see", () => {
  it("finds the exported pages and the route files", () => {
    expect(exportedPages().length).toBeGreaterThan(20)
    for (const app of APPS) expect(ROUTES[app]!.length).toBeGreaterThan(30)
  })

  it("resolves a known-good mount, so a silent zero is not mistaken for a pass", () => {
    for (const app of APPS) expect(mountsOf(app, "OrdersPage")).not.toEqual([])
  })
})

describe.each(APPS)("every exported page is mounted — apps/%s", (app) => {
  it.each(exportedPages())("%s has a route that renders it", (name) => {
    expect({ page: name, mounts: mountsOf(app, name) }).not.toEqual({
      page: name,
      mounts: [],
    })
  })
})

describe("the two apps mount the same screens", () => {
  it("mounts each page at the same routes in both apps", () => {
    const divergent = exportedPages().filter(
      (name) =>
        JSON.stringify(mountsOf("reference", name).sort()) !==
        JSON.stringify(mountsOf("themes", name).sort())
    )
    // `check:divergence` compares `e2e/` and `convex/` only, so a route added
    // to one app and forgotten in the other passes it in silence.
    expect(divergent).toEqual([])
  })
})

describe("the screens that had a second, unrendered way in", () => {
  it("keeps no `*TabContent` wrapper for a screen that has its own route", () => {
    // `DesignTabContent`, `LanguagesTabContent` and `PaymentsTabContent` each
    // embedded a page in a Settings tab that `settings-page.tsx` never mounted.
    // The routes replaced all three. Settings is headed "Paramètres Globaux —
    // valeurs par défaut héritées par tous les établissements", and these three
    // screens each edit ONE establishment, which is why they are routes and not
    // tabs.
    const settings = fs.readdirSync(path.join(ADMIN_SRC, "pages/settings"))
    expect(settings.filter((f) => f.includes("tab-content"))).toEqual([])
  })

  it("keeps no `embedded` prop, which existed only to serve those wrappers", () => {
    // Matched as a prop, not as a word: the history of why the flag existed is
    // worth keeping in a comment, the flag itself is not.
    for (const page of ["languages/languages-page", "payments/payments-page", "design/design-page"]) {
      expect(read(path.join(ADMIN_SRC, "pages", `${page}.tsx`)), page).not.toMatch(
        /embedded[?:]|embedded\s*=|\{\s*embedded\s*\}|<\w+ embedded/
      )
    }
  })
})

describe("the KDS and Langues screens live here, not in the apps", () => {
  it("leaves no hand-rolled copy in either app", () => {
    for (const app of APPS) {
      const local = path.join(REPO, "apps", app, "components/admin")
      expect(fs.existsSync(path.join(local, "kitchen")), app).toBe(false)
      expect(fs.existsSync(path.join(local, "languages/LanguagesContent.tsx")), app).toBe(false)
    }
  })

  it("keeps the packaged KDS complete — it used to be a thinner fork", () => {
    const kitchen = path.join(ADMIN_SRC, "pages/kitchen")
    for (const file of [
      "kitchen-page.tsx",
      "ticket-card.tsx",
      "ticket-timer.tsx",
      "station-filter.tsx",
      "completed-tickets.tsx",
      "kitchen-print-trigger.tsx",
      "kitchen-sound-manager.tsx",
      "print-status-badge.tsx",
      "print-ticket-layout.tsx",
    ]) {
      expect(fs.existsSync(path.join(kitchen, file)), file).toBe(true)
    }
    const page = read(path.join(kitchen, "kitchen-page.tsx"))
    // The four behaviours the packaged fork had lost.
    expect(page).toContain("KitchenPrintTrigger")
    expect(page).toContain("KitchenSoundManager")
    expect(page).toContain("CompletedTickets")
    expect(page).toContain("updateOrderMode")
  })

  it("keeps the UI-override tab in the app, where its key list lives", () => {
    for (const app of APPS) {
      const overrides = path.join(
        REPO, "apps", app, "components/admin/languages/UIOverridesContent.tsx"
      )
      expect(fs.existsSync(overrides), app).toBe(true)
    }
    expect(read(path.join(ADMIN_SRC, "pages/languages/languages-page.tsx"))).toContain(
      "uiOverrides"
    )
  })
})

describe("the `./pages` subpath the registry advertises", () => {
  it("resolves, along with every other subpath this package publishes", () => {
    const pkg = JSON.parse(read(path.join(ADMIN_SRC, "../package.json"))) as {
      exports: Record<string, string>
    }
    const broken = Object.entries(pkg.exports).filter(
      ([, target]) => !fs.existsSync(path.join(ADMIN_SRC, "..", target))
    )
    expect(broken).toEqual([])
  })

  it("exports every page `packages/mcp-server` tells a client build to import from it", () => {
    const registry = read(path.join(REPO, "packages/mcp-server/src/registry.ts"))
    const advertised = new Set<string>()
    for (const m of registry.matchAll(
      /name:\s*"(\w+)",\s*\n\s*type:\s*"component",[\s\S]{0,400}?importPath:\s*"@be-yours\/admin\/pages"/g
    )) {
      advertised.add(m[1] as string)
    }
    expect(advertised.size).toBeGreaterThan(5)
    const exported = new Set(exportedPages())
    expect([...advertised].filter((n) => !exported.has(n))).toEqual([])
  })
})
