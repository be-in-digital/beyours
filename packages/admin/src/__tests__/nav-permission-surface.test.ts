/**
 * Every sidebar link, checked against the permission its screen's server
 * actually enforces.
 *
 * WHY THIS EXISTS: the sidebar decides what to draw from
 * `nav-config.ts`'s `requiredPermission` (`components/app-sidebar.tsx:46-50`),
 * and the server decides what to serve from the `permission:` its Convex
 * wrapper declares. Nothing tied the two together, and they drifted: "Cuisine
 * (KDS)" was gated on `orders:read` while every KDS query enforces
 * `kitchen:read`, so `waiter` and `delivery` — two roles the owner hands out
 * from their own Team screen — were shown a link the server refuses. Convex
 * rethrows a refusal out of `useQuery` DURING RENDER, so the click did not
 * produce an empty screen, it produced an error page.
 *
 * WHY SOURCE-LEVEL: `packages/admin` receives the Convex API as `api: any`
 * (`stores/admin-api-store.ts`), so no type connects a screen to the function
 * it calls, and the screens themselves live in two places — some in this
 * package, some hand-rolled in the apps. The only way to answer "what does
 * this link actually open" is to walk the import graph from the route file.
 *
 * WHY MOUNT-TIME QUERIES ONLY: a nav gate answers "may you OPEN this", not
 * "may you use every control on it". `Design` is gated on `stores:read` and
 * not `stores:write` on purpose — a manager reaches it with the save buttons
 * drawn inert and explained (`lib/branding-eligibility.ts`). So this sweep
 * collects `useQuery` / `usePaginatedQuery` calls, which run on mount and
 * throw before anything renders, and ignores `useMutation` / `useAction`,
 * which run on click and are the eligibility helpers' business.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { Role, hasPermission, type Permission } from "@be-in-digital/core"

import { navGroups, isCollapsible, type NavEntry } from "../config/nav-config"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const

const read = (file: string): string => fs.readFileSync(file, "utf8")

/** The roles that can reach the sidebar at all — `customer` is redirected by `AuthGuard`. */
const OPERATOR_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.CLIENT_ADMIN,
  Role.MANAGER,
  Role.KITCHEN,
  Role.WAITER,
  Role.DELIVERY,
]

// ─── Walking the import graph from a route file ─────────────────────────────

/** `useQuery(api.x.y` and `usePaginatedQuery(api.x.y`, in every spelling this repo uses. */
const MOUNT_QUERY = /use(?:Paginated)?Query\(\s*api\??\.(\w+)\??\.(\w+)/g

/** Named import or re-export: captures the bound names and the module specifier. */
const NAMED_BINDING = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g

/** Default import: `import Foo from "./foo"`. */
const DEFAULT_IMPORT = /import\s+(\w+)\s+from\s*"(\.[^"]+|@\/[^"]+)"/g

function firstExisting(base: string): string | null {
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  }
  return null
}

/** Does `file` define `name` itself, rather than re-export it? */
function defines(src: string, name: string): boolean {
  return new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|class)\\s+${name}\\b`).test(src)
}

/**
 * The file that DEFINES `name`, starting from `entry` and following barrels.
 *
 * `null` when `entry` neither defines nor re-exports it — which is how a
 * barrel that happens to sit on the import path stops the walk from pulling in
 * every screen it lists. Following a barrel wholesale is what made this sweep
 * report `customers:read` as a requirement of the Design screen.
 */
function definitionFile(entry: string, name: string): string | null {
  const src = read(entry)
  if (defines(src, name)) return entry
  const line = src.match(
    new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`)
  )
  if (!line) return null
  const spec = line[1] as string
  if (isUiOnly(spec)) return null
  const next = firstExisting(
    spec.startsWith(".")
      ? path.resolve(path.dirname(entry), spec)
      : path.join(ADMIN_SRC, spec.replace(/^\.\//, ""))
  )
  return next ? definitionFile(next, name) : null
}

/** Where `packages/admin` defines `name`, entered through its top-level barrel. */
function packageFileFor(name: string): string | null {
  return definitionFile(path.join(ADMIN_SRC, "index.ts"), name)
}

/** UI primitives never call Convex; walking them only slows the sweep down. */
function isUiOnly(spec: string): boolean {
  return spec.startsWith("@be-in-digital/ui") || /(^|\/)components\/ui(\/|$)/.test(spec)
}

function entryFileFor(fromFile: string, spec: string, appDir: string): string | null {
  if (isUiOnly(spec)) return null
  if (spec.startsWith("@/")) return firstExisting(path.join(appDir, spec.slice(2)))
  if (spec.startsWith(".")) return firstExisting(path.resolve(path.dirname(fromFile), spec))
  return null
}

/** Every `module.fn` reached by a mount-time query from this route file. */
function mountQueriesOf(routeFile: string, appDir: string): string[] {
  const found = new Set<string>()
  const seen = new Set<string>()

  const visit = (file: string, depth: number): void => {
    if (depth > 8 || seen.has(file)) return
    seen.add(file)
    const src = read(file)
    for (const m of src.matchAll(MOUNT_QUERY)) found.add(`${m[1]}.${m[2]}`)

    const follow = (spec: string, names: string[]): void => {
      if (spec === "@be-in-digital/admin") {
        for (const n of names) {
          const f = packageFileFor(n)
          if (f) visit(f, depth + 1)
        }
        return
      }
      const entry = entryFileFor(file, spec, appDir)
      if (!entry) return
      for (const n of names) {
        const f = definitionFile(entry, n)
        if (f) visit(f, depth + 1)
      }
    }

    for (const m of src.matchAll(NAMED_BINDING)) {
      const names = (m[1] as string)
        .split(",")
        .map((n) => (n.trim().split(/\s+as\s+/)[0] ?? "").replace(/^type\s+/, "").trim())
        .filter(Boolean)
      follow(m[2] as string, names)
    }
    for (const m of src.matchAll(DEFAULT_IMPORT)) {
      const entry = entryFileFor(file, m[2] as string, appDir)
      if (entry) visit(entry, depth + 1)
    }
  }

  visit(routeFile, 0)
  return [...found]
}

// ─── Reading what the server enforces ───────────────────────────────────────

/**
 * The permission an app's Convex wrapper declares for `module.fn`.
 *
 * `null` means the wrapper enforces no named permission — an unguarded query,
 * or one gated on membership alone. Those constrain nothing, so they drop out
 * of the comparison rather than counting as "allowed to everyone".
 */
function serverPermission(app: string, mod: string, fn: string): Permission | null {
  const file = path.join(REPO, "apps", app, "convex", `${mod}.ts`)
  if (!fs.existsSync(file)) return null
  const src = read(file)
  const at = src.indexOf(`export const ${fn} =`)
  if (at < 0) return null
  const end = src.indexOf("\nexport ", at + 1)
  const block = src.slice(at, end < 0 ? undefined : end)
  return (block.match(/permission:\s*"([^"]+)"/)?.[1] ?? null) as Permission | null
}

// ─── The nav entries, flattened ─────────────────────────────────────────────

interface FlatEntry {
  label: string
  hrefs: string[]
  permission: Permission | undefined
}

const flatEntries: FlatEntry[] = navGroups.flatMap((group) =>
  group.items.map((entry: NavEntry) => ({
    label: entry.label,
    hrefs: isCollapsible(entry)
      ? [...new Set(entry.children.map((c) => c.href))]
      : [entry.href],
    permission: entry.requiredPermission,
  }))
)

function routeFileFor(app: string, href: string): string | null {
  const file = path.join(REPO, "apps", app, "app/(admin)", href, "page.tsx")
  return fs.existsSync(file) ? file : null
}

/** The permissions a role must hold to get past the screen's mount-time queries. */
function requiredToOpen(app: string, entry: FlatEntry): Permission[] {
  const perms = new Set<Permission>()
  for (const href of entry.hrefs) {
    const routeFile = routeFileFor(app, href)
    if (!routeFile) continue
    for (const call of mountQueriesOf(routeFile, path.join(REPO, "apps", app))) {
      const [mod, fn] = call.split(".") as [string, string]
      const perm = serverPermission(app, mod, fn)
      if (perm) perms.add(perm)
    }
  }
  return [...perms]
}

// ─── The guard ──────────────────────────────────────────────────────────────

describe("the sweep can see what it claims to see", () => {
  it("resolves a route file for every nav href, in both apps", () => {
    const missing: string[] = []
    for (const app of APPS) {
      for (const entry of flatEntries) {
        for (const href of entry.hrefs) {
          if (!routeFileFor(app, href)) missing.push(`${app}:${entry.label}:${href}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it("finds the KDS query the sweep exists to catch", () => {
    // A walker that silently resolves nothing would pass every assertion below.
    expect(requiredToOpen("reference", flatEntries.find((e) => e.label === "Cuisine (KDS)")!))
      .toContain("kitchen:read")
  })

  it("finds a mount-time permission for most entries", () => {
    const withPerms = flatEntries.filter((e) => requiredToOpen("reference", e).length > 0)
    expect(withPerms.length).toBeGreaterThanOrEqual(8)
  })
})

describe.each(APPS)("nav gates against the server — apps/%s", (app) => {
  it.each(flatEntries.map((e) => [e.label, e] as const))(
    "%s shows the link to no role the server refuses",
    (_label, entry) => {
      const serverPerms = requiredToOpen(app, entry)
      const shown = OPERATOR_ROLES.filter(
        (role) => !entry.permission || hasPermission(role, entry.permission)
      )
      const refused = shown.filter((role) =>
        serverPerms.some((perm) => !hasPermission(role, perm))
      )
      expect({ entry: entry.label, serverPerms, refused }).toEqual({
        entry: entry.label,
        serverPerms,
        refused: [],
      })
    }
  )
})

describe("a nav gate names the resource its screen is about", () => {
  /**
   * Beyond the role check above, the resource NAME matters on its own. The
   * server runs a second gate — `profileAllowsPermission`
   * (`convex-functions/src/teamAccess.ts`) — which maps a permission's
   * resource to one of the eight module checkboxes the invite dialog offers.
   * `settings` maps to the `settings` module; `content`, `marketing` and
   * `games` all map to `marketing`. A link gated on `settings:read` whose
   * screen enforces `content:read` therefore passes the sidebar's test and is
   * refused by the server for anyone granted `settings` without `marketing` —
   * the same failure as the KDS one, reached by a different route.
   */
  it.each(flatEntries.map((e) => [e.label, e] as const))(
    "%s is gated on a resource one of its own queries enforces",
    (_label, entry) => {
      const serverPerms = requiredToOpen("reference", entry)
      if (serverPerms.length === 0 || !entry.permission) return
      const resource = (p: string) => p.split(":")[0]
      expect(serverPerms.map(resource)).toContain(resource(entry.permission))
    }
  )
})
