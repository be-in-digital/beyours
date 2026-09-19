/**
 * The RGPD screen is reachable, in both apps, from the sidebar.
 *
 * WHY SOURCE-LEVEL: a page exported from this package and imported by neither
 * app type-checks perfectly and renders nowhere. Two already shipped that way —
 * `KitchenPage` and `LanguagesPage` are exported here and mounted by nothing —
 * and `PaymentsPage` carried the admin's only working refund dialog for months
 * behind a route that did not exist.
 *
 * This one matters more than most: an establishment that cannot open this
 * screen cannot answer an access, erasure or portability request at all, and
 * it is the data controller either way.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { adminRoutes } from "../config/admin-routes"
import { navGroups, type NavItem } from "../config/nav-config"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const
const PRIVACY_ROUTE = "app/(admin)/dashboard/privacy/page.tsx"

const read = (file: string): string => fs.readFileSync(file, "utf8")

describe("the RGPD screen", () => {
  it("has a route file in every app, importing the package page", () => {
    for (const app of APPS) {
      const file = path.join(REPO, "apps", app, PRIVACY_ROUTE)
      expect(fs.existsSync(file), `apps/${app}/${PRIVACY_ROUTE} is missing`).toBe(true)
      const source = read(file)
      expect(source, `apps/${app} must render the package page`).toContain(
        "PrivacyPage"
      )
      expect(source).toContain("@be-yours/admin")
    }
  })

  it("is exported from the package root", () => {
    expect(read(path.join(ADMIN_SRC, "index.ts"))).toContain(
      'export { PrivacyPage } from "./pages/privacy"'
    )
  })

  it("has a sidebar entry pointing at the route the apps mount", () => {
    // `navGroups` mixes plain links with collapsible parents; only the former
    // carry an `href`, and the RGPD screen is one of them.
    const entry = navGroups
      .flatMap((group) => group.items)
      .find((item): item is NavItem => "href" in item && item.href === adminRoutes.privacy)
    expect(entry, "no sidebar entry points at adminRoutes.privacy").toBeDefined()
    // A waiter holds `customers:read`; answering a data-subject request is the
    // controller's act, so the entry must not be visible on `read`.
    expect(entry?.requiredPermission).toBe("customers:manage")
  })

  it("mounts at the path the route constant declares", () => {
    // `/dashboard/privacy` and `app/(admin)/dashboard/privacy/` have to agree,
    // or the sidebar links to a 404.
    expect(adminRoutes.privacy).toBe("/dashboard/privacy")
    expect(PRIVACY_ROUTE).toContain(adminRoutes.privacy.replace("/dashboard", "dashboard"))
  })

  it("calls Convex functions that exist in both apps", () => {
    // The same class of bug `refund-surface` was written for: the admin
    // receives its API as an untyped object, so `api.privacy.eraseDataSubject`
    // type-checks whether or not the function was ever written.
    const page = read(path.join(ADMIN_SRC, "pages/privacy/privacy-page.tsx"))
    const calls = [
      ...page.matchAll(/api\??\.?\??\.privacy\??\.(\w+)/g),
    ].map((match) => match[1] as string)
    expect(calls.length).toBeGreaterThan(3)

    for (const app of APPS) {
      const convexFile = path.join(REPO, "apps", app, "convex", "privacy.ts")
      expect(fs.existsSync(convexFile), `apps/${app}/convex/privacy.ts is missing`).toBe(
        true
      )
      const exported = [...read(convexFile).matchAll(/export const (\w+)/g)].map(
        (match) => match[1] as string
      )
      const missing = [...new Set(calls)].filter((fn) => !exported.includes(fn))
      expect(missing, `apps/${app}/convex/privacy.ts is missing: ${missing}`).toEqual([])
    }
  })

  it("is scheduled to run its sweep in both apps", () => {
    // A retention window nothing enforces is a published promise the code does
    // not keep, which is worse than no promise.
    for (const app of APPS) {
      const crons = read(path.join(REPO, "apps", app, "convex", "crons.ts"))
      expect(crons, `apps/${app} does not schedule the retention sweep`).toContain(
        "internal.privacy.sweepExpiredCustomerData"
      )
    }
  })
})
