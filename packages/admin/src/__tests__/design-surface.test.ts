/**
 * The Design screen's save buttons, checked against the mutation behind them.
 *
 * WHY SOURCE-LEVEL, AGAIN: `packages/admin` receives the Convex API as
 * `api: any` (`stores/admin-api-store.ts`), so `api?.stores?.updateBranding`
 * type-checked perfectly for as long as the mutation did not exist — all three
 * buttons resolved to `undefined` and threw on click, the same way the refund
 * button did. `refund-surface.test.ts` now catches that first failure, because
 * its sweep resolves every `api.module.fn` against the apps and no longer
 * carries `stores.updateBranding` as a known-broken exception.
 *
 * What the sweep cannot see is the FIELDS. It checks that a function exists,
 * not that the object handed to it is one the server would accept, and
 * `branding` is a single blob argument. So this file reads the page's source
 * and measures the field names against `BRANDING_FIELDS` — the validator the
 * mutation actually enforces. A field the page sends that the validator does
 * not name is a save that throws; a field the page reads back that the
 * validator refuses is a setting that can never be set.
 *
 * REACHABILITY, added second: agreeing with the validator is worth nothing on a
 * screen no operator can open. `DesignPage` was exported from the package and
 * mounted by NEITHER app — no `dashboard/design` route, no nav entry, and
 * `DesignTabContent` (the wrapper written to embed it in Settings) rendered by
 * nobody. The buttons were dead twice over and only one death had been fixed.
 *
 * The route now exists in both apps, and the sweep at the bottom is what keeps
 * it that way. `scripts/check-app-divergence.mjs` cannot help here: its parity
 * check covers `e2e/` and `convex/` only, so a route added to one app and
 * forgotten in the other passes `pnpm check:divergence` in silence. Both apps
 * are asserted below, and their route files compared byte for byte.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { BRANDING_FIELDS } from "@be-in-digital/convex-functions/stores"
import { Role, hasPermission } from "@be-in-digital/core"

import { adminRoutes } from "../config/admin-routes"
import { navGroups, isCollapsible, type NavItem } from "../config/nav-config"
import { titles } from "../config/route-titles"
import {
  BRANDING_PERMISSION,
  brandingControlState,
} from "../lib/branding-eligibility"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const
const DESIGN_ROUTE = "app/(admin)/dashboard/design/page.tsx"
const DESIGN_PAGE = path.join(ADMIN_SRC, "pages/design/design-page.tsx")
const source = fs.readFileSync(DESIGN_PAGE, "utf8")
const read = (file: string): string => fs.readFileSync(file, "utf8")

const VALIDATED = Object.keys(BRANDING_FIELDS)

/** The `branding: { ... }` object literals the page hands to the mutation. */
function sentFields(): string[] {
  const literals = [...source.matchAll(/branding:\s*\{([^}]*)\}/g)].map((m) => m[1] as string)
  expect(literals.length, "found no branding payload in design-page.tsx").toBeGreaterThan(0)
  return [
    ...new Set(
      literals.flatMap((body) =>
        [...body.matchAll(/(?:^|[\s,{])([A-Za-z_]\w*)\s*(?:,|:|$)/g)].map((m) => m[1] as string)
      )
    ),
  ]
}

/** The `store.branding.X` reads the page performs when it loads the form. */
function readFields(): string[] {
  return [
    ...new Set(
      [...source.matchAll(/store\.branding\.(\w+)/g)].map((m) => m[1] as string)
    ),
  ]
}

describe("the Design page and the branding validator agree", () => {
  it("calls the mutation that now exists", () => {
    expect(source).toContain("api?.stores?.updateBranding")
  })

  it("sends only fields the validator names", () => {
    // `v.object` refuses an unnamed field, so a typo here is a button that
    // throws — invisibly, because the API is typed `any`.
    expect(sentFields().filter((f) => !VALIDATED.includes(f))).toEqual([])
  })

  it("reads back only fields the validator can set", () => {
    // The mirror of the above: a field the form loads but no save can write is
    // a control that resets itself on every visit.
    expect(readFields().filter((f) => !VALIDATED.includes(f))).toEqual([])
  })

  it("covers every validated field between its three save buttons", () => {
    // Colours, typography and logo between them own the whole shape. A field in
    // the validator that no button writes has no way of ever being set.
    expect(VALIDATED.filter((f) => !sentFields().includes(f))).toEqual([])
  })

  it("sends a cleared field as an empty string, not as undefined", () => {
    // The mutation merges, so an absent field means "leave it alone". The logo
    // handler used to send `logoUrl || undefined`, which Convex drops from the
    // payload entirely — an owner deleting their logo got a success toast and
    // kept the logo.
    expect(source).not.toMatch(/(logoUrl|faviconUrl):\s*\w+\s*\|\|\s*undefined/)
  })
})

describe("the Design screen is reachable, in both apps", () => {
  it("registers the route once, in the package", () => {
    expect(adminRoutes.design).toBe("/dashboard/design")
  })

  for (const app of APPS) {
    it(`apps/${app} mounts DesignPage at that route`, () => {
      // The whole point. A page exported from the package and rendered by no
      // route is a page nobody can open, however correct it is.
      const file = path.join(REPO, "apps", app, DESIGN_ROUTE)
      expect(fs.existsSync(file), `missing ${DESIGN_ROUTE}`).toBe(true)
      expect(read(file)).toContain("DesignPage")
    })
  }

  it("keeps the two route files byte-identical", () => {
    // `PARITY_DIRS` in check-app-divergence.mjs is `e2e` and `convex` only, so
    // nothing else in this repo would notice the template missing this route.
    const [reference, themes] = APPS.map((app) =>
      read(path.join(REPO, "apps", app, DESIGN_ROUTE))
    )
    expect(reference).toEqual(themes)
  })

  it("exports DesignPage from the package barrel", () => {
    expect(read(path.join(ADMIN_SRC, "index.ts"))).toContain("DesignPage")
  })

  it("is linked from the sidebar, not only typeable as a URL", () => {
    // A route nothing links to is not reachable for an operator; it is a URL
    // for whoever already knows it exists.
    const entries = navGroups
      .flatMap((group) => group.items)
      .filter((entry): entry is NavItem => !isCollapsible(entry))
    const design = entries.find((entry) => entry.href === adminRoutes.design)

    expect(design, "no sidebar entry points at /dashboard/design").toBeDefined()
    expect(design?.label).toBe("Design")
    // `stores:read` is "may you look at it". Gating the LINK on `stores:write`
    // would hide the screen from a manager who is allowed to read it.
    expect(design?.requiredPermission).toBe("stores:read")
  })

  it("has a French title for the header and breadcrumb", () => {
    // Without a row here the breadcrumb capitalises the URL segment and the
    // operator is told the page is called "Design" by accident rather than
    // on purpose — and any renaming of the route would silently change it.
    expect(titles.design).toBe("Design")
  })

  it("no longer keeps a second, unrendered way in", () => {
    // `DesignTabContent` embedded this page in a Settings tab that Settings
    // never mounted. The route replaces it; leaving it behind would be one
    // more dead component pointing at a live screen.
    expect(
      fs.existsSync(path.join(ADMIN_SRC, "pages/settings/design-tab-content.tsx"))
    ).toBe(false)
  })
})

describe("the save buttons ask the same question the server does", () => {
  it("mirrors the permission the backend actually enforces", () => {
    // If the mutation ever moves to another permission, this is where the
    // mirror is caught out — in both apps, since either could drift alone.
    for (const app of APPS) {
      const src = read(path.join(REPO, "apps", app, "convex/stores.ts"))
      expect(src, app).toMatch(
        /export const updateBranding = storeMutation\(\{\s*permission: "stores:write"/
      )
    }
    expect(BRANDING_PERMISSION).toBe("stores:write")
  })

  it("lets the owner save", () => {
    for (const role of [Role.SUPER_ADMIN, Role.CLIENT_ADMIN]) {
      expect(brandingControlState(role), role).toEqual({ disabled: false })
    }
  })

  it("disables and explains for a role that may see but not write", () => {
    // `manager` is the case that matters: it holds `stores:read`, so the
    // sidebar shows it the Design link, and it does NOT hold `stores:write`,
    // so every save would have thrown on the click.
    expect(hasPermission(Role.MANAGER, "stores:read")).toBe(true)
    expect(hasPermission(Role.MANAGER, BRANDING_PERMISSION)).toBe(false)

    const state = brandingControlState(Role.MANAGER)
    expect(state.disabled).toBe(true)
    expect(state.reason).toBe(
      "Seul le propriétaire peut modifier l'apparence du site"
    )
  })

  it("refuses a missing role rather than assuming one", () => {
    expect(brandingControlState(undefined).disabled).toBe(true)
  })

  it("disables every role the server would refuse, and no other", () => {
    // Derived from the real permission table rather than restated, so adding a
    // role or moving `stores:write` cannot leave this test describing the past.
    const refused = Object.values(Role).filter(
      (role) => !hasPermission(role, BRANDING_PERMISSION)
    )
    for (const role of Object.values(Role)) {
      expect(brandingControlState(role).disabled, role).toBe(refused.includes(role))
    }
  })

  it("routes all four saves through the shared decision", () => {
    // Four buttons, one rule. The theme tab saves colours too, and it is the
    // one most easily forgotten.
    expect([...source.matchAll(/<BrandingControl state=\{branding\}>/g)]).toHaveLength(4)
    expect([...source.matchAll(/disabled=\{branding\.disabled\}/g)]).toHaveLength(4)
  })

  it("spells no permission rule of its own", () => {
    // A second mechanism is a second thing to forget. The permission name
    // belongs in `lib/branding-eligibility.ts` and nowhere else.
    expect(source).not.toContain('"stores:write"')
  })

  it("does not put the explanation on the button itself", () => {
    // The shared Button sets `disabled:pointer-events-none`, so a disabled one
    // is not hit-testable and its `title` never renders. Same trap the refund
    // control documents; the wrapper span is what the pointer can land on.
    expect(source).not.toContain("title={branding.reason}")
    const wrapper = read(path.join(ADMIN_SRC, "pages/design/branding-control.tsx"))
    expect(wrapper).toContain("title={state.reason}")
  })
})
