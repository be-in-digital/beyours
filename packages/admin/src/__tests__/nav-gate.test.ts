/**
 * The sidebar's visibility rule, against the server's own two gates.
 *
 * `nav-permission-surface.test.ts` answers "does each entry name the
 * permission its screen enforces". This file answers the other half: given a
 * role and a module selection, does the sidebar draw exactly what the server
 * would serve?
 */

import { describe, it, expect } from "vitest"
import { Role, hasPermission, type Permission } from "@be-in-digital/core"
import { profileAllowsPermission } from "@be-in-digital/convex-functions/teamAccess"

import { navGroups, isCollapsible, type NavEntry } from "../config/nav-config"
import { canSeeNavEntry, visibleNavGroups } from "../lib/nav-visibility"

const ENTRIES: NavEntry[] = navGroups.flatMap((g) => g.items)
const entry = (label: string): NavEntry => {
  const found = ENTRIES.find((e) => e.label === label)
  if (!found) throw new Error(`no nav entry labelled "${label}"`)
  return found
}

/** Unrestricted: the module list every existing deployment carries. */
const ALL_MODULES: string[] = []

describe("the KDS link, which is what this rule was written for", () => {
  it("is drawn for the roles that hold kitchen:read", () => {
    for (const role of [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.MANAGER, Role.KITCHEN]) {
      expect(canSeeNavEntry(role, ALL_MODULES, entry("Cuisine (KDS)"))).toBe(true)
    }
  })

  it("is withheld from waiter and delivery, whom the server refuses", () => {
    for (const role of [Role.WAITER, Role.DELIVERY]) {
      expect(hasPermission(role, "orders:read")).toBe(true)
      expect(hasPermission(role, "kitchen:read")).toBe(false)
      expect(canSeeNavEntry(role, ALL_MODULES, entry("Cuisine (KDS)"))).toBe(false)
    }
  })

  it("still shows those two roles the Commandes link they can use", () => {
    for (const role of [Role.WAITER, Role.DELIVERY]) {
      expect(canSeeNavEntry(role, ALL_MODULES, entry("Commandes"))).toBe(true)
    }
  })
})

describe("the module gate, which the sidebar used to ignore entirely", () => {
  it("withholds an entry whose module the owner did not tick", () => {
    // A manager granted the orders module only: the role permits Promotions,
    // the module selection does not.
    expect(canSeeNavEntry(Role.MANAGER, ["orders"], entry("Promotions"))).toBe(false)
    expect(canSeeNavEntry(Role.MANAGER, ["marketing"], entry("Promotions"))).toBe(true)
  })

  it("keeps the content entries on the marketing module, where the server puts them", () => {
    for (const label of ["Pages", "Blog", "Médiathèque", "Email Marketing"]) {
      expect(canSeeNavEntry(Role.MANAGER, ["settings"], entry(label))).toBe(false)
      expect(canSeeNavEntry(Role.MANAGER, ["marketing"], entry(label))).toBe(true)
    }
  })

  it("reads an empty selection as unrestricted, not as nothing", () => {
    const drawn = visibleNavGroups(Role.MANAGER, [])
    expect(drawn.flatMap((g) => g.items).length).toBeGreaterThan(5)
  })

  it("never narrows an owner, whose authority is not the roster's to narrow", () => {
    for (const role of [Role.SUPER_ADMIN, Role.CLIENT_ADMIN]) {
      const restricted = visibleNavGroups(role, ["orders"])
      const unrestricted = visibleNavGroups(role, [])
      expect(restricted).toEqual(unrestricted)
    }
  })
})

describe("the rule agrees with the server for every entry, role and module", () => {
  const ROLES = [
    Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.MANAGER,
    Role.KITCHEN, Role.WAITER, Role.DELIVERY,
  ]
  const MODULE_SETS: string[][] = [
    [], ["orders"], ["kitchen"], ["marketing"], ["settings"],
    ["products"], ["team"], ["integrations"], ["dashboard"],
    ["orders", "kitchen"], ["marketing", "settings"],
  ]

  it("draws an entry exactly when both server gates would pass it", () => {
    const disagreements: string[] = []
    for (const role of ROLES) {
      for (const modules of MODULE_SETS) {
        for (const e of ENTRIES) {
          const permission = e.requiredPermission
          const serverWouldServe =
            !permission ||
            (hasPermission(role, permission as Permission) &&
              profileAllowsPermission({ role, permissions: modules }, permission))
          if (canSeeNavEntry(role, modules, e) !== serverWouldServe) {
            disagreements.push(`${role} [${modules.join("+") || "all"}] ${e.label}`)
          }
        }
      }
    }
    expect(disagreements).toEqual([])
  })
})

describe("visibleNavGroups", () => {
  it("drops a group whose every entry was withheld", () => {
    // `kitchen` holds neither `products:read` nor `customers:read` nor
    // `payments:read`, but does hold `orders:read` and `kitchen:read`, so
    // "Opérations" survives while "Marketing", "Contenu" and "Organisation" do not.
    const labels = visibleNavGroups(Role.KITCHEN, []).map((g) => g.label)
    expect(labels).toContain("Opérations")
    expect(labels).not.toContain("Marketing")
    expect(labels).not.toContain("Contenu")
    expect(labels).not.toContain("Organisation")
  })

  it("leaves a collapsible entry's children alone — the parent gate decides", () => {
    const games = visibleNavGroups(Role.MANAGER, []).flatMap((g) => g.items).find(
      (e) => e.label === "Gamification"
    )
    expect(games && isCollapsible(games) && games.children.length).toBe(5)
  })
})
