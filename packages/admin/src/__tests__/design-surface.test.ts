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
import { buildBrandingCss } from "@be-in-digital/ui/branding"

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
const STOREFRONT_LAYOUT = "app/(storefront)/layout.tsx"
const STORE_THEME = "components/storefront/store-theme.tsx"
const GLOBALS = "app/globals.css"
const DESIGN_PAGE = path.join(ADMIN_SRC, "pages/design/design-page.tsx")
const source = fs.readFileSync(DESIGN_PAGE, "utf8")
const read = (file: string): string => fs.readFileSync(file, "utf8")

/** Every `.ts`/`.tsx` under `dir`, for the sweeps that ask about a whole tree. */
function walkTsx(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return []
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walkTsx(full) : /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

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

  it("covers every colour and typography field between its two save handlers", () => {
    // What is left after the logo moved to the CMS. A field in this list that
    // no handler writes has no way of ever being set.
    const OWNED = [
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "fontHeading",
      "fontBody",
    ]
    expect(OWNED.filter((f) => !sentFields().includes(f))).toEqual([])
  })

  it("leaves the logo to the CMS block rather than writing a rival copy", () => {
    // `logoUrl`/`faviconUrl` stay in `BRANDING_FIELDS` because deployed stores
    // may hold them and `mergeBranding` must keep carrying them through. What
    // must not come back is a second input for a fact the CMS `branding` block
    // already owns across the storefront header, the favicon, the JSON-LD and
    // this dashboard's own sidebar.
    expect(sentFields()).not.toContain("logoUrl")
    expect(sentFields()).not.toContain("faviconUrl")
    expect(VALIDATED).toContain("logoUrl")
    expect(VALIDATED).toContain("faviconUrl")
  })

  it("sends a cleared field as an empty string, not as undefined", () => {
    // The mutation merges, so an absent field means "leave it alone". The logo
    // handler used to send `logoUrl || undefined`, which Convex drops from the
    // payload entirely — an owner deleting their logo got a success toast and
    // kept the logo. Stated over every payload rather than that one field, so
    // the trap is closed for whoever writes the next save handler.
    const literals = [...source.matchAll(/branding:\s*\{([^}]*)\}/g)].map((m) => m[1] as string)
    for (const body of literals) {
      expect(body).not.toMatch(/\|\|\s*undefined/)
    }
  })
})

describe("the screen says what it does not do", () => {
  it("no longer offers themes that no template backs", () => {
    // Six themes were listed; `fine-dining` and `cafe` matched no directory in
    // `apps/themes/templates/`, and the "Appliquer" button saved three hex
    // strings while the chosen id died in local state. Choosing a design is
    // `pnpm template:apply <slug>` at clone time.
    for (const id of ["fine-dining", "cafe", "fast-food", "chinese", "sushi"]) {
      expect(source, `theme "${id}" is back`).not.toContain(`"${id}"`)
    }
    expect(source).not.toContain('TabsTrigger value="theme"')
    expect(source).not.toContain("Appliquer le thème")
  })

  it("keeps no writer for the `themeId` the schema still carries", () => {
    // It has neither a reader nor a writer anywhere in the repository. A save
    // added here would make it a stored value nothing consumes. The header
    // comment names it, so this asks for a write rather than for the word.
    expect(sentFields()).not.toContain("themeId")
    expect(source).not.toMatch(/themeId\s*[:=]/)
  })

})

describe("the logo tab points somewhere that exists", () => {
  const CMS_PAGE = "cms/pages/storefront-layout.ts"

  it("links to the CMS page editor rather than duplicating the field", () => {
    expect(source).toContain('adminRoutes.contentPageEdit(STOREFRONT_LAYOUT_SLUG)')
    expect(source).toContain('const STOREFRONT_LAYOUT_SLUG = "storefront-layout"')
    expect(adminRoutes.contentPageEdit("storefront-layout")).toBe(
      "/dashboard/content/pages/storefront-layout"
    )
  })

  for (const app of APPS) {
    it(`apps/${app} registers that slug with a branding block`, () => {
      // `packages/admin` cannot see an app's CMS registry, so the slug above is
      // spelled by hand. This is what stops the link rotting into a 404.
      const definition = read(path.join(REPO, "apps", app, CMS_PAGE))
      expect(definition).toContain('slug: "storefront-layout"')
      expect(definition).toContain('key: "branding"')
      expect(definition).toContain("logo:")
      expect(definition).toContain("favicon:")

      const registry = read(path.join(REPO, "apps", app, "cms/index.ts"))
      expect(registry).toContain('"storefront-layout": storefrontLayoutPage')
    })
  }

  it("is reachable from the sidebar it names", () => {
    // The alert tells the owner "Contenu › Pages". If that entry ever goes, the
    // instruction becomes a wild goose chase.
    const entries = navGroups
      .flatMap((group) => group.items)
      .filter((entry): entry is NavItem => !isCollapsible(entry))
    expect(entries.some((e) => e.href === adminRoutes.contentPages)).toBe(true)
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

  it("routes both remaining saves through the shared decision", () => {
    // Two buttons, one rule. It was four: the theme tab saved colours too, and
    // the logo tab has since handed its job to the CMS.
    expect([...source.matchAll(/<BrandingControl state=\{branding\}>/g)]).toHaveLength(2)
    expect([...source.matchAll(/disabled=\{branding\.disabled\}/g)]).toHaveLength(2)
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

describe("what the screen saves reaches a diner", () => {
  /**
   * The other half of the same defect, and the one that survived longest.
   * Reachability made the buttons clickable and the validator made the writes
   * land; the colours still went nowhere. `--primary` had exactly one
   * definition per app — the literal `24 95% 53%` in `app/globals.css` — so
   * every establishment the engine has delivered shipped the same orange, and
   * a product sold as "a theme by restaurant type" had a theme picker that
   * changed nothing. These are the tests that stop it going quiet again.
   */

  /** A value of the kind the screen produces, per validated field. */
  const SAMPLES: Record<string, string> = {
    primaryColor: "#d32f2f",
    secondaryColor: "#ffebee",
    accentColor: "#ff5722",
    fontHeading: "Playfair Display",
    fontBody: "Inter",
    logoUrl: "/logo.png",
    faviconUrl: "/favicon.png",
  }

  /** The fields whose consumer is the stylesheet rather than the markup. */
  const PAINTED = [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "fontHeading",
    "fontBody",
  ] as const

  it("has a sample for every field the validator names", () => {
    // Guards the loops below: a field added to `BRANDING_FIELDS` with no
    // sample here would be silently skipped rather than caught.
    expect(Object.keys(BRANDING_FIELDS).sort()).toEqual(Object.keys(SAMPLES).sort())
  })

  for (const field of PAINTED) {
    it(`turns ${field} into a design token`, () => {
      // One field at a time, so a deriver that quietly stopped reading one of
      // them cannot hide behind the other four.
      expect(buildBrandingCss({ [field]: SAMPLES[field] })).not.toBe("")
    })
  }

  it("leaves the theme untouched for an establishment that set nothing", () => {
    // The other side of it: this stylesheet is emitted on every storefront
    // page, so a store with no branding must produce no rule at all rather
    // than one that restates the defaults.
    expect(buildBrandingCss({})).toBe("")
  })

  for (const app of APPS) {
    it(`apps/${app} paints the storefront with it`, () => {
      const layout = read(path.join(REPO, "apps", app, STOREFRONT_LAYOUT))
      expect(layout, "storefront layout does not mount StoreTheme").toContain(
        "<StoreTheme"
      )
      // Server-resolved, so a returning visitor does not watch the engine
      // orange repaint into their restaurant's red after hydration.
      expect(layout).toContain("buildBrandingCss(store?.branding)")
      expect(fs.existsSync(path.join(REPO, "apps", app, STORE_THEME))).toBe(true)
    })

    // The logo and the favicon are deliberately NOT asserted here. `logoUrl`
    // and `faviconUrl` stay in `BRANDING_FIELDS` because deployed stores hold
    // them, but the Design screen sends the owner to the CMS `branding` block
    // for both and tells them the value saved on that tab "n'est utilisée
    // nulle part". A storefront fallback that quietly rendered it would make
    // that sentence false and put one fact back under two screens.

    it(`apps/${app} lets a stored font override the bundled one`, () => {
      // `@theme inline` substitutes a token's VALUE into the utility at build
      // time, so redefining `--font-sans` at `:root` would change nothing. The
      // override has to be the variable named inside that value, and it has to
      // be the name `buildBrandingCss` emits.
      const css = read(path.join(REPO, "apps", app, GLOBALS))
      const emitted = buildBrandingCss({
        fontHeading: SAMPLES.fontHeading,
        fontBody: SAMPLES.fontBody,
      })
      for (const token of ["--brand-font-heading", "--brand-font-body"]) {
        expect(emitted, `deriver stopped writing ${token}`).toContain(`${token}:`)
        expect(css, `globals.css never reads ${token}`).toContain(`var(${token},`)
      }
    })
  }

  it("does not promise a font it cannot deliver", () => {
    // Nothing fetches a webfont, so a stored family renders only where the
    // visitor already has it. The typography tab used to suggest "Roboto",
    // which is on essentially no desktop — a control that saves, previews
    // correctly on the owner's machine, and changes nothing for a diner. The
    // screen now says so, and suggests families that do render.
    expect(source).toContain("beid-safe-fonts")
    expect(source).toMatch(/le site ne télécharge aucune police/)
    // The two the engine actually bundles through `next/font`.
    expect(source).toContain('"Inter"')
    expect(source).toContain('"Poppins"')
  })

  it("paints the storefront through tokens, not through literal hex", () => {
    // THE TEST THAT WAS MISSING, and the gap every other test in this file sat
    // beside: they all proved the chain end to end and none of them asked
    // whether the storefront reads the tokens at the end of it. It did not.
    // 228 literal colour utilities across 34 files — `bg-[#0D5C3F]` 66 times,
    // `text-[#0D5C3F]` 36, `hover:bg-[#0A412D]` 20 — against eight uses of
    // `bg/text/border-primary`. So `--primary` became the owner's red exactly
    // as asserted, and the hero, the menu header, the add-to-cart button and
    // the checkout button stayed dark green.
    const BRAND_LITERAL = /(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|caret|accent)-\[#[0-9A-Fa-f]{3,8}\]/g
    // Uber Eats' green and Deliveroo's teal, on their own partner tiles. A
    // restaurant's palette must not repaint another company's logo.
    const THIRD_PARTY = /#(?:06C167|00CCBC)/i

    for (const app of APPS) {
      const offenders: string[] = []
      for (const dir of [
        "app/(storefront)",
        "components/storefront",
        "components/website",
      ]) {
        for (const file of walkTsx(path.join(REPO, "apps", app, dir))) {
          for (const hit of read(file).match(BRAND_LITERAL) ?? []) {
            if (!THIRD_PARTY.test(hit)) {
              offenders.push(`${path.relative(REPO, file)}: ${hit}`)
            }
          }
        }
      }
      expect(offenders, app).toEqual([])
    }
  })

  it("gives the storefront its own default palette, scoped and layered", () => {
    // Scoped, so the administration does not turn green. Layered, so an
    // establishment's own colours — which `StoreTheme` emits unlayered — beat
    // it whatever the specificity or the load order.
    for (const app of APPS) {
      const css = read(path.join(REPO, "apps", app, GLOBALS))
      const base = css.slice(css.indexOf("@layer base"))
      expect(base, `${app}: .storefront-theme is not in @layer base`).toMatch(
        /@layer base \{[\s\S]*?\.storefront-theme \{/
      )
      // The colours a diner saw before this change, unchanged.
      expect(css).toContain("--primary: 158 75% 21%;")
      expect(css).toContain("--background: 51 64% 98%;")

      const shell = read(
        path.join(REPO, "apps", app, "components/storefront/storefront-shell.tsx")
      )
      expect(shell, `${app}: nothing carries the scope`).toContain("storefront-theme")
    }
  })

  it("drives the two roles the storefront had been spelling by hand", () => {
    // `--primary-hover` because `primary/90` lightens a dark brand towards the
    // page instead of darkening it, and `--accent-solid` because `--accent` is
    // a hover tint — a cart badge needs the colour the owner actually picked.
    const css = buildBrandingCss(
      { primaryColor: "#d32f2f", accentColor: "#ff9800" },
      { darkSelector: null }
    )
    expect(css).toContain("--primary-hover:")
    expect(css).toContain("--accent-solid:36 100% 50%;")

    for (const app of APPS) {
      const globals = read(path.join(REPO, "apps", app, GLOBALS))
      for (const token of ["--color-primary-hover", "--color-accent-solid"]) {
        expect(globals, `${app}: ${token} has no utility`).toContain(token)
      }
    }
  })

  it("wins the cascade against the engine's own defaults", () => {
    // The reason the injected rules take effect at all. `globals.css` keeps
    // its literal `--primary: 24 95% 53%` — it has to, it is what an
    // establishment that set nothing still renders — but it declares it inside
    // `@layer base`, and every UNLAYERED rule beats every layered one whatever
    // the document order. Emitting this stylesheet into a layer, or moving the
    // defaults out of one, would silently restore the orange.
    const css = buildBrandingCss({ primaryColor: SAMPLES.primaryColor })
    expect(css).not.toContain("@layer")

    for (const app of APPS) {
      const globals = read(path.join(REPO, "apps", app, GLOBALS))
      const base = globals.slice(globals.indexOf("@layer base"))
      expect(base, `${app}: --primary left @layer base`).toMatch(
        /@layer base \{[\s\S]*?--primary:/
      )
    }
  })

  it("keeps the two storefront layouts and theme components byte-identical", () => {
    // Same reason as the route above: the divergence guard covers `e2e/` and
    // `convex/` only, so the template could lose per-store theming on its own
    // and every check in the repository would stay green.
    for (const file of [STOREFRONT_LAYOUT, STORE_THEME]) {
      const [reference, themes] = APPS.map((app) =>
        read(path.join(REPO, "apps", app, file))
      )
      expect(reference, file).toEqual(themes)
    }
  })
})
