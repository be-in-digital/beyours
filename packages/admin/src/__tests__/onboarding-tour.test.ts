/**
 * The onboarding tour, measured against the UI it claims to describe.
 *
 * WHY THIS FILE EXISTS: the tour auto-launches after a new owner's first login
 * (`tour-provider.tsx`) and is the first thing a paying client sees. It had
 * never been tested. When the admin moved under `/dashboard`, the sidebar's
 * `data-tour` ids followed the hrefs and the tour's hand-typed copies did not:
 * 19 of 20 highlights pointed at elements that are never rendered, a 20th
 * (`games-tabs`) belonged to a tabbed Gamification screen that #159 split into
 * five pages, and two steps narrated a full feature before landing on
 * `<ComingSoon/>`. Everything compiled and every suite stayed green, because a
 * CSS selector matching nothing is not a type error and nothing asserted
 * otherwise.
 *
 * WHY SOURCE-LEVEL: the spotlight is a string the browser resolves against a
 * DOM this package never renders in a unit test. So the emitted side is
 * reconstructed two ways — the computed `nav-*` ids from `navGroups`, and every
 * literal `data-tour="…"` grepped out of the pages and the two app layouts —
 * and the tour is measured against them.
 *
 * WHAT THE FIRST REPAIR GOT WRONG, and why the assertions below are shaped the
 * way they are: it fixed the ids and left `highlightedSelectors` in place. In
 * `@reactour/tour@3.8.0` `bypassElem` defaults to `true`, so `getHighlightedRect`
 * builds the mask from the highlighted selectors ALONE — making the ids resolve
 * turned 21 steps from "spotlight the content, highlight nothing" into
 * "spotlight the menu item, ignore the content". A green anchor test said
 * nothing about it. Hence `spotlights exactly one element`, and hence the
 * page-membership assertion: a real anchor from the wrong page used to pass.
 *
 * The `e2e/auth.setup.ts` of both apps writes `bid-tour-<userId> = "done"`
 * before saving storage state, because the tour's mask swallowed every click in
 * the other suites. That suppression is why no e2e run can catch any of this;
 * the comment there asks for exactly this file.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"

import { Role } from "@be-in-digital/core"
import { adminRoutes } from "../config/admin-routes"
import {
  navGroups,
  isCollapsible,
  navTourId,
  navTourIds,
  canRoleSeeNavHref,
} from "../config/nav-config"
import {
  TOUR_STEPS,
  TOUR_STEP_SPECS,
  ALWAYS_MOUNTED_ANCHORS,
  spotlightOf,
  tourStepsFor,
} from "../components/onboarding/tour-steps"
import { shouldOfferTour } from "../components/onboarding/tour-provider"
import {
  hasSeenTour,
  markTourSeen,
  clearTourSeen,
} from "../components/onboarding/tour-storage"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const

const read = (file: string): string => fs.readFileSync(file, "utf8")

/** `data-tour="X"` literals, mapped to the files that render them. */
function anchorSources(): Map<string, string[]> {
  const roots = [
    path.join(ADMIN_SRC, "pages"),
    path.join(ADMIN_SRC, "components"),
    // Both trees: an app mounts most admin screens from the package, but some
    // — the kitchen among them — render the app's own component instead, and
    // scanning only `app/` left six tour destinations unverified.
    ...APPS.flatMap((app) => [
      path.join(REPO, "apps", app, "app"),
      path.join(REPO, "apps", app, "components"),
    ]),
  ]
  const found = new Map<string, string[]>()

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      // The tour consumes these ids; it is not a source of them.
      if (full.includes(`${path.sep}onboarding${path.sep}`)) continue
      for (const m of read(full).matchAll(/data-tour="([^"]+)"/g)) {
        const name = m[1] as string
        found.set(name, [...(found.get(name) ?? []), full])
      }
    }
  }

  roots.forEach(walk)
  return found
}

/** `apps/<app>/app/(admin)<route>/page.tsx` — the file a step's route opens. */
function pageFor(app: string, route: string): string {
  return path.join(REPO, "apps", app, "app", "(admin)", route.replace(/^\//, ""), "page.tsx")
}

/** The route each step is standing on, carried forward from the last `route`. */
function routeAtEachStep(): string[] {
  let current: string = adminRoutes.dashboard
  return TOUR_STEP_SPECS.map((spec) => {
    if (spec.route) current = spec.route
    return current
  })
}

describe("onboarding tour — the spotlight", () => {
  it("spotlights exactly one element per step", () => {
    // Never `highlightedSelectors`: reactour's default `bypassElem` discards
    // the target's rect as soon as a highlighted selector resolves, which
    // silently moves the spotlight off the thing the copy describes.
    for (const [i, step] of TOUR_STEPS.entries()) {
      expect(step.highlightedSelectors, `step ${i} would move its own spotlight`).toBeUndefined()
      expect(typeof step.selector, `step ${i} has no selector`).toBe("string")
    }
  })

  it("spotlights only elements that are actually rendered", () => {
    const rendered = new Set([...anchorSources().keys(), ...navTourIds()])
    const dead = TOUR_STEP_SPECS.map(spotlightOf)
      .map((selector) => /\[data-tour="([^"]+)"\]/.exec(selector)?.[1] as string)
      .filter((anchor) => !rendered.has(anchor))

    expect([...new Set(dead)], "these tour steps spotlight nothing").toEqual([])
  })

  it("never spotlights a page element on a step that has just navigated", () => {
    // reactour measures when the step becomes current; `router.push` has not
    // painted, so an element on the destination page measures as a 0x0 rect in
    // the top-left corner. The sidebar entry is mounted throughout.
    const early = TOUR_STEP_SPECS.filter(
      (spec) =>
        spec.route &&
        spec.anchor &&
        !(ALWAYS_MOUNTED_ANCHORS as readonly string[]).includes(spec.anchor)
    )
    expect(
      early.map((s) => `${s.route} → ${s.anchor}`),
      "a navigating step must spotlight its sidebar entry, not the page it is opening"
    ).toEqual([])
  })

  it("spotlights an element that lives on the page the step is standing on", () => {
    // A real anchor belonging to a different screen used to satisfy the old
    // global check: the inventory step could point at `products-filters`.
    const sources = anchorSources()
    const routes = routeAtEachStep()
    const misplaced: string[] = []

    TOUR_STEP_SPECS.forEach((spec, i) => {
      if (!spec.anchor) return
      if ((ALWAYS_MOUNTED_ANCHORS as readonly string[]).includes(spec.anchor)) return

      const files = sources.get(spec.anchor) ?? []
      // `/dashboard/orders/kitchen` → pages/kitchen, `/dashboard/products` →
      // pages/products: the screen directory is the last segment of the route.
      const screen = (routes[i] as string).split("/").filter(Boolean).pop() as string
      const onThisScreen = files.some((f) =>
        f.includes(`${path.sep}pages${path.sep}${screen}${path.sep}`)
      )
      if (!onThisScreen) {
        misplaced.push(`step ${i}: "${spec.anchor}" is not on ${routes[i]} (${files.join(", ")})`)
      }
    })

    expect(misplaced).toEqual([])
  })

  it("only exempts anchors the chrome really always renders", () => {
    // Membership of ALWAYS_MOUNTED_ANCHORS waives both the "not on a
    // navigating step" and the "lives on this page" checks, so an unverified
    // name in that list is a free escape hatch for any anchor at all.
    const chrome = [
      read(path.join(ADMIN_SRC, "components/app-sidebar.tsx")),
      ...APPS.map((app) => read(path.join(REPO, "apps", app, "app/(admin)/layout.tsx"))),
    ].join("\n")

    for (const anchor of ALWAYS_MOUNTED_ANCHORS) {
      expect(chrome, `"${anchor}" is exempted but the chrome does not render it`).toContain(
        `data-tour="${anchor}"`
      )
    }
    // `main-content` wraps the whole content pane: a mask cut around it covers
    // the viewport and spotlights nothing, so it is not a legitimate exemption
    // however reliably it is mounted.
    expect(ALWAYS_MOUNTED_ANCHORS as readonly string[]).not.toContain("main-content")
    expect(TOUR_STEP_SPECS.map((s) => s.anchor)).not.toContain("main-content")
  })

  it("keeps the sidebar's id expression in one place", () => {
    // Two inline copies of this template literal in app-sidebar.tsx — one per
    // branch — are what drifted away from the tour in the first place.
    const sidebar = read(path.join(ADMIN_SRC, "components/app-sidebar.tsx"))
    expect(sidebar).toContain("navTourId(entry.href)")
    expect(sidebar).toContain("navTourId(item.basePath)")
    expect(
      sidebar,
      "app-sidebar.tsx recomputes the tour id inline again — use navTourId()"
    ).not.toMatch(/`nav-\$\{/)

    // Same argument for the visibility rule. The tour asks by href and the
    // sidebar by entry; two copies of that rule can disagree silently, and the
    // tour would then skip a menu item the account can plainly see.
    expect(
      sidebar,
      "app-sidebar.tsx reimplements the permission check — delegate to canRoleSeeNavHref()"
    ).toContain("canRoleSeeNavHref(role,")
    expect(sidebar).not.toMatch(/hasPermission\(role,/)
  })
})

describe("onboarding tour — destinations", () => {
  const routes = TOUR_STEP_SPECS.map((s) => s.route).filter((r): r is string => Boolean(r))
  // `adminRoutes` is `as const` and mixes literals with builder functions.
  const knownRoutes = new Set<string>(
    (Object.values(adminRoutes) as unknown[]).filter(
      (v): v is string => typeof v === "string"
    )
  )

  it("navigates only to canonical adminRoutes values", () => {
    // The legacy `/orders`-style paths are redirect stubs; going through one
    // costs a redirect hop before anything on the page can exist.
    expect(routes.filter((r) => !knownRoutes.has(r))).toEqual([])
  })

  it("opens a page that exists in both apps", () => {
    const missing: string[] = []
    for (const app of APPS) {
      for (const route of routes) {
        if (!fs.existsSync(pageFor(app, route))) missing.push(`${app}${route}`)
      }
    }
    expect(missing).toEqual([])
  })

  it("never narrates a feature and then lands on ComingSoon", () => {
    // « Clients — Votre carnet d'adresses intelligent » and « Composants …
    // Assemblez-les comme des Lego » both ended on a Clock icon reading
    // "Cette fonctionnalité arrive bientôt".
    const deadEnds: string[] = []
    for (const app of APPS) {
      for (const route of routes) {
        const file = pageFor(app, route)
        if (!fs.existsSync(file)) continue
        // Follow the one-line re-export into the package, so a ComingSoon
        // rendered by the shared component is visible too.
        const wrapper = read(file)
        if (wrapper.includes("<ComingSoon")) {
          deadEnds.push(`${app}${route}`)
          continue
        }
        const component = /import\s*\{\s*(\w+)\s*\}\s*from\s*"@be-in-digital\/admin"/.exec(wrapper)
        if (!component) continue
        const pagesDir = path.join(ADMIN_SRC, "pages")
        if (!fs.existsSync(pagesDir)) continue
        const hit = findExport(pagesDir, component[1] as string)
        if (hit && read(hit).includes("<ComingSoon")) deadEnds.push(`${app}${route}`)
      }
    }
    expect(deadEnds, "a tour step sells a feature that renders as ComingSoon").toEqual([])
  })
})

/** The file that exports `name`, if one of the package's pages does. */
function findExport(dir: string, name: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = findExport(full, name)
      if (nested) return nested
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    if (new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\b`).test(read(full))) {
      return full
    }
  }
  return null
}

describe("onboarding tour — coverage and copy", () => {
  it("visits every screen the sidebar offers", () => {
    // The opening step promises « On va les parcourir une par une ». A nav
    // entry added without a step makes that sentence false, silently.
    const visited = new Set(TOUR_STEP_SPECS.map((s) => s.navFor).filter(Boolean))
    const unvisited = navGroups.flatMap((group) =>
      group.items
        .map((entry) => (isCollapsible(entry) ? entry.basePath : entry.href))
        .filter((href) => !visited.has(href))
    )

    expect(
      unvisited,
      "these sidebar entries are never shown to a new owner — add a step or drop the promise"
    ).toEqual([])
  })

  it("declares the page each step belongs to", () => {
    // Role filtering drops a page's steps as a group. A detail step without
    // `navFor` would survive its own page being filtered out.
    const orphans = TOUR_STEP_SPECS.map((spec, i) => ({ spec, i }))
      .filter(({ spec }) => !spec.navFor && spec.anchor !== "sidebar-brand")
      .map(({ i }) => i)
    expect(orphans, "these steps belong to no page").toEqual([])
  })

  it("cuts itself down to the menu each role is actually shown", () => {
    // `kitchen` and `delivery` see 3 of 21 entries, and invitations hand out
    // exactly those roles (`team-page.tsx`).
    const full = tourStepsFor(() => true).length
    expect(full).toBe(TOUR_STEP_SPECS.length)

    for (const role of [Role.KITCHEN, Role.DELIVERY, Role.WAITER]) {
      const steps = tourStepsFor((href) => canRoleSeeNavHref(role, href))
      expect(steps.length, `${role} is shown the whole tour`).toBeLessThan(full)
      expect(steps.length, `${role} is shown no tour at all`).toBeGreaterThan(0)

      const visible = new Set(
        TOUR_STEP_SPECS.filter((s) => !s.navFor || canRoleSeeNavHref(role, s.navFor)).map(
          spotlightOf
        )
      )
      for (const step of steps) {
        expect(visible.has(step.selector as string)).toBe(true)
      }
    }
  })

  it("opens each page's step with that page's own name", () => {
    // Swapping two steps' copy outright — Catégories narrating Promotions and
    // vice versa — left every other assertion green. A page step now has to
    // announce the menu entry it is standing on.
    const labelOf = new Map<string, string>()
    for (const group of navGroups) {
      for (const entry of group.items) {
        labelOf.set(isCollapsible(entry) ? entry.basePath : entry.href, entry.label)
      }
    }

    const wrong: string[] = []
    for (const spec of TOUR_STEP_SPECS) {
      // Detail steps continue a page their predecessor introduced.
      if (!spec.route || !spec.navFor) continue
      const label = labelOf.get(spec.navFor)
      if (!label) continue
      if (!spec.content.startsWith(label)) {
        wrong.push(`${spec.navFor}: copy should open with "${label}"`)
      }
    }
    expect(wrong).toEqual([])
  })

  it("pins which element each detail step spotlights", () => {
    // The one thing no derived rule catches: a detail step moved onto another
    // anchor of the SAME page. `dashboard-charts` → `dashboard-recent` leaves
    // the copy describing the bar chart while the spotlight sits on the recent
    // orders table, and every other assertion here stays green.
    //
    // Changing this table is fine. Changing it by accident is what it stops.
    const EXPECTED: Record<string, string[]> = {
      [adminRoutes.dashboard]: ["dashboard-charts", "dashboard-actions"],
      [adminRoutes.orders]: ["orders-tabs"],
      [adminRoutes.products]: ["products-filters"],
    }

    const actual: Record<string, string[]> = {}
    for (const spec of TOUR_STEP_SPECS) {
      if (spec.route || !spec.anchor || !spec.navFor) continue
      actual[spec.navFor] = [...(actual[spec.navFor] ?? []), spec.anchor]
    }
    expect(actual).toEqual(EXPECTED)

    // And no PAGE anchor does double duty, which would make the table
    // ambiguous. `sidebar-brand` is deliberately used twice: it bookends the
    // tour, opening on the brand and closing on it.
    const pageAnchors = TOUR_STEP_SPECS.map((s) => s.anchor).filter(
      (a): a is string =>
        a !== undefined && !(ALWAYS_MOUNTED_ANCHORS as readonly string[]).includes(a)
    )
    expect(pageAnchors.length, "a page anchor is spotlit by two steps").toBe(
      new Set(pageAnchors).size
    )
  })

  it("carries real French copy on every step", () => {
    // `content.length > 40` was the whole of the old assertion, so English
    // placeholder text of sufficient length passed.
    const FRENCH = /[àâçéèêëîïôûùüœ]/i
    TOUR_STEP_SPECS.forEach((spec, i) => {
      expect(spec.content.length, `step ${i} has no copy`).toBeGreaterThan(40)
      expect(spec.content, `step ${i} does not read as French`).toMatch(FRENCH)
      expect(spec.content, `step ${i} still carries placeholder copy`).not.toMatch(
        /TODO|TBD|placeholder|lorem ipsum/i
      )
    })
  })

  it("names the kitchen's real columns, and counts them right", () => {
    // Read what SHIPS. That used to mean the apps' local `KitchenContent`,
    // because this package's own `kitchen-page.tsx` was exported and mounted by
    // neither — measuring it would have blessed a rename on a screen no owner
    // opens. The live screen was lifted here and both apps now render it, so
    // there is one copy and this is it.
    const NUMBER_WORDS: Record<number, string> = { 2: "Deux", 3: "Trois", 4: "Quatre", 5: "Cinq" }
    const step = TOUR_STEP_SPECS.find((s) => s.navFor === adminRoutes.kitchen)
    expect(step).toBeDefined()

    // Both apps must still be mounting it, or "what ships" has moved again.
    for (const app of APPS) {
      const route = read(
        path.join(REPO, "apps", app, "app/(admin)/dashboard/orders/kitchen/page.tsx")
      )
      expect(route, `${app} does not mount the packaged KitchenPage`).toContain(
        "KitchenPage"
      )
      expect(route, `${app} still renders a local kitchen screen`).not.toContain(
        "@/components/admin/kitchen"
      )
    }

    {
      const file = path.join(ADMIN_SRC, "pages/kitchen/kitchen-page.tsx")
      const columns = [...read(file).matchAll(/^\s{2}\w+: \{ title: "([^"]+)"/gm)].map(
        (m) => m[1] as string
      )
      expect(columns.length, "found no kitchen columns to compare").toBeGreaterThan(0)

      for (const column of columns) {
        expect(
          step?.content,
          `the kitchen step does not name the "${column}" column`
        ).toContain(column)
      }
      // The original defect was the COUNT, not the names: "4 colonnes …
      // Terminé" over a three-column board. Naming three and saying four
      // passed the first version of this assertion.
      const claimed = NUMBER_WORDS[columns.length]
      expect(claimed, `no word for ${columns.length} columns`).toBeDefined()
      expect(
        step?.content,
        `the kitchen step should say "${claimed} colonnes" for ${columns.length} columns`
      ).toContain(`${claimed} colonnes`)
      for (const [n, word] of Object.entries(NUMBER_WORDS)) {
        if (Number(n) === columns.length) continue
        expect(
          step?.content,
          `the kitchen step claims "${word} colonnes" but there are ${columns.length}`
        ).not.toContain(`${word} colonnes`)
      }
    }
  })
})

describe("onboarding tour — when it opens", () => {
  const base = {
    isAuthenticated: true,
    isAuthLoading: false,
    userId: "user_1",
    stores: [{ _id: "store_1" }],
    selectedStoreId: "store_1",
    alreadySeen: false,
  }

  it("offers itself to an owner who has an establishment", () => {
    expect(shouldOfferTour(base)).toBe(true)
  })

  it("does not offer itself to an owner who has none", () => {
    // `StoreGuard` replaces every page except Établissements, Paramètres and
    // Équipe with "Aucun établissement" until one exists — and a brand-new
    // owner, the person this tour opens for, has none. It used to narrate
    // twenty screens of empty state.
    expect(shouldOfferTour({ ...base, stores: [], selectedStoreId: null })).toBe(false)
  })

  it("waits rather than guessing while the store list is in flight", () => {
    // An undecided list is not an empty one. Asserting only on "empty" let an
    // inverted comparison open the tour before the answer arrived.
    expect(shouldOfferTour({ ...base, stores: undefined })).toBe(false)
  })

  it("does not offer itself twice, or before auth settles", () => {
    expect(shouldOfferTour({ ...base, alreadySeen: true })).toBe(false)
    expect(shouldOfferTour({ ...base, isAuthLoading: true })).toBe(false)
    expect(shouldOfferTour({ ...base, isAuthenticated: false })).toBe(false)
    expect(shouldOfferTour({ ...base, userId: null })).toBe(false)
  })
})

describe("onboarding tour — remembering that it was offered", () => {
  const KEY = "bid-tour-user_1"

  afterEach(() => {
    clearTourSeen("user_1")
    clearTourSeen("user_2")
    vi.unstubAllGlobals()
  })

  it("records and reads one account at a time", () => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })

    expect(hasSeenTour("user_1")).toBe(false)
    markTourSeen("user_1")
    expect(hasSeenTour("user_1")).toBe(true)
    expect(store.get(KEY)).toBe("done")

    // The replay button used to loop over every `bid-tour-*` key, so one
    // replay on a shared back-office tablet re-armed the tour for everyone.
    markTourSeen("user_2")
    clearTourSeen("user_1")
    expect(hasSeenTour("user_1")).toBe(false)
    expect(hasSeenTour("user_2")).toBe(true)
  })

  it("still remembers within the session when storage throws", () => {
    // A private window. `hasSeenTour` answers false on a throw, so without an
    // in-memory fallback the tour reopened after every page load, with a mask
    // that swallows clicks.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("access denied")
      },
      setItem: () => {
        throw new Error("access denied")
      },
      removeItem: () => {
        throw new Error("access denied")
      },
    })

    expect(hasSeenTour("user_1")).toBe(false)
    expect(() => markTourSeen("user_1")).not.toThrow()
    expect(hasSeenTour("user_1")).toBe(true)
  })
})
