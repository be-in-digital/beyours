/**
 * The guided tour may not walk an owner into a page that is not built.
 *
 * `TourAutoLauncher` opens this tour 1.2 s after a first login, unprompted, so
 * it is the first thing a paying restaurateur sees. Two of its steps used to
 * narrate a whole feature and then navigate to a `<ComingSoon/>` placeholder:
 *
 *   « Clients — Votre carnet d'adresses intelligent ! Retrouvez chaque client,
 *     son historique de commandes, ses coordonnées et ses préférences. »
 *   « Composants — Des blocs réutilisables … Assemblez-les comme des Lego
 *     pour créer des pages uniques. »
 *
 * Both are gone. This suite stops either coming back, and stops a third being
 * added when some future screen is stubbed: it resolves each step's `goTo`
 * against the real route files in both apps and refuses any destination that
 * renders the placeholder.
 *
 * It reads the apps from disk on purpose. `packages/admin` has no import path
 * into `apps/*` — that is why nothing caught this in the first place, and why
 * the check has to reach across rather than infer.
 */

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const

const TOUR_STEPS_FILE = path.join(ADMIN_SRC, "components/onboarding/tour-steps.ts")
const source = fs.readFileSync(TOUR_STEPS_FILE, "utf8")

/** Every path a step navigates to, in declaration order. */
function tourDestinations(): string[] {
  return [...source.matchAll(/goTo\("([^"]+)"\)/g)].map((m) => m[1] as string)
}

/**
 * Where an admin path actually lands.
 *
 * The admin lives under the `(admin)` route group, and most top-level paths are
 * a one-line `redirect()` into `/dashboard/...`. Follow that hop, because it is
 * the hop the tour itself takes.
 */
function resolvePage(app: string, route: string): string | null {
  const direct = path.join(REPO, "apps", app, `app/(admin)${route}/page.tsx`)
  if (!fs.existsSync(direct)) return null

  const src = fs.readFileSync(direct, "utf8")
  const redirect = src.match(/redirect\("([^"]+)"\)/)
  if (!redirect) return src

  const target = path.join(REPO, "apps", app, `app/(admin)${redirect[1]}/page.tsx`)
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null
}

describe("every tour step lands somewhere a client can use", () => {
  for (const app of APPS) {
    it(`apps/${app}: no step navigates to a route that does not exist`, () => {
      const missing = tourDestinations().filter((route) => resolvePage(app, route) === null)

      expect(missing).toEqual([])
    })

    it(`apps/${app}: no step navigates to a ComingSoon placeholder`, () => {
      const placeholders = tourDestinations().filter((route) => {
        const page = resolvePage(app, route)
        return page !== null && page.includes("ComingSoon")
      })

      expect(placeholders).toEqual([])
    })
  }

  it("still walks the owner through a real tour", () => {
    // A guard that passes because the tour is empty would be worse than none.
    expect(tourDestinations().length).toBeGreaterThan(15)
  })
})

describe("the removed steps stay removed until their pages ship", () => {
  it("does not narrate a customer book that does not exist", () => {
    expect(source).not.toContain("carnet d'adresses")
    expect(source).not.toContain('goTo("/customers")')
  })

  it("does not narrate a component library that does not exist", () => {
    expect(source).not.toContain('goTo("/content/components")')
  })

  it("no longer highlights the Clients nav entry, which does not exist", () => {
    // `AppSidebar` derives each anchor from a nav entry's href, so a step that
    // highlights something absent from the nav highlights nothing at all. That
    // was true of the Clients anchor: the entry is deliberately kept out of the
    // nav until the page is built.
    //
    // Scoped to this one anchor on purpose. The tour's other anchors are stale
    // in a different way — the sidebar emits `nav-dashboard-orders` where the
    // steps ask for `nav-orders`, so most of them resolve to nothing either.
    // That is a wider repair than the two dead-end steps this suite covers, and
    // it belongs to whoever fixes the tour's anchors as a whole.
    expect(source).not.toContain('[data-tour="nav-customers"]')
  })
})
