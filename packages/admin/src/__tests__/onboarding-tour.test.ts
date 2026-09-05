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

import { describe, it, expect } from "vitest"
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

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const

const read = (file: string): string => fs.readFileSync(file, "utf8")

/** `data-tour="X"` literals, mapped to the files that render them. */
function anchorSources(): Map<string, string[]> {
  const roots = [
    path.join(ADMIN_SRC, "pages"),
    path.join(ADMIN_SRC, "components"),
    ...APPS.map((app) => path.join(REPO, "apps", app, "app")),
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

  it("names the kitchen's real columns", () => {
    // The board has three statuses; `kitchen-page.tsx` explains why the fourth
    // was removed. The copy claimed four, in the same way the Gamification step
    // claimed four tabs after #159 split that screen into five pages.
    const kitchen = read(path.join(ADMIN_SRC, "pages/kitchen/kitchen-page.tsx"))
    const columns = [...kitchen.matchAll(/^\s{2}(\w+): \{ title: "([^"]+)"/gm)].map(
      (m) => m[2] as string
    )
    expect(columns.length).toBeGreaterThan(0)

    const step = TOUR_STEP_SPECS.find((s) => s.navFor === adminRoutes.kitchen)
    expect(step).toBeDefined()
    for (const column of columns) {
      expect(step?.content, `the kitchen step does not name the "${column}" column`).toContain(
        column
      )
    }
  })
})

describe("onboarding tour — when it opens", () => {
  const provider = read(
    path.join(ADMIN_SRC, "components/onboarding/tour-provider.tsx")
  )

  it("waits for an establishment before offering itself", () => {
    // `StoreGuard` replaces every page except Établissements, Paramètres and
    // Équipe with "Aucun établissement" until one exists — and a brand-new
    // owner, the person this tour opens for, has none. It used to narrate
    // twenty screens of empty state.
    expect(provider).toContain("resolveStoreSelection")
    expect(provider).toMatch(/hasStore/)
  })

  it("does not re-offer itself forever where storage throws", () => {
    // `hasSeenTour` answers false on a throw. Without an in-memory fallback the
    // tour reopened after every page load in a private window, with a mask that
    // swallows clicks.
    expect(provider).toContain("seenInSession")
  })

  it("forgets one account at a time", () => {
    const replay = read(
      path.join(ADMIN_SRC, "components/onboarding/replay-tour-button.tsx")
    )
    // It used to loop over every `bid-tour-*` key, so one replay on a shared
    // back-office tablet re-armed the tour for every colleague.
    expect(replay).not.toMatch(/Object\.keys\(localStorage\)/)
    expect(replay).toContain("clearTourSeen")
  })
})
