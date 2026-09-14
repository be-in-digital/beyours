import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Every URL a payment provider sends a customer back to must be a real route
 * (#110).
 *
 * WHAT WENT WRONG. `bidSubscription.ts` told Stripe:
 *
 *     success_url: `${appUrl}/admin/subscription?status=success`
 *
 * `app/(admin)/` is a Next.js route GROUP — the parentheses mean it contributes
 * nothing to the URL — so `/admin/subscription` matched no route in either app.
 * An owner who had just paid for BeYours landed on a **404**: the subscription
 * was active, because the webhook does that, and the confirmation screen they
 * were sent to did not exist. The `?status=success` toast never fired either.
 *
 * It was one line away from correct — the maintenance checkout in the same file
 * used `/dashboard/system` and worked — which is exactly the kind of defect
 * nothing catches. The URL is a string, the provider is remote, and the failure
 * only appears to somebody who has already paid.
 *
 * WHAT THIS CHECKS. Every `success_url` / `cancel_url` / `return_url` literal in
 * the app's Convex functions is resolved against the App Router tree. A path with
 * no `page.tsx` behind it fails here rather than in front of a customer.
 */

const APP = path.resolve(__dirname, "..")
const APP_DIR = path.join(APP, "app")
const CONVEX_DIR = path.join(APP, "convex")

/** The URL fields a provider redirects a browser to. */
const RETURN_URL_FIELDS = ["success_url", "cancel_url", "return_url"] as const

/**
 * Every path the App Router serves, as a set of URL pathnames.
 *
 * Route groups — `(admin)`, `(storefront)` — are stripped, because that is
 * precisely what the parentheses mean and precisely what was misread. Dynamic
 * segments become wildcards, and a candidate matches if its segments line up.
 */
function routePathnames(): string[] {
  const routes: string[] = []

  const walk = (dir: string, segments: string[]) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // `(group)` contributes nothing to the URL. `@slot` and `_private` are
        // not routes either.
        if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")")
        walk(full, isGroup ? segments : [...segments, entry.name])
        continue
      }

      if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        routes.push("/" + segments.join("/"))
      }
    }
  }

  walk(APP_DIR, [])
  return routes
}

/** Does `pathname` match a route, allowing for dynamic segments? */
function isServedBy(pathname: string, routes: string[]): boolean {
  const wanted = pathname.split("/").filter(Boolean)
  return routes.some((route) => {
    const have = route.split("/").filter(Boolean)
    // `[...slug]` swallows the rest; `[id]` matches exactly one segment.
    const catchAllAt = have.findIndex((s) => s.startsWith("[..."))
    if (catchAllAt >= 0) {
      return (
        wanted.length >= catchAllAt &&
        have.slice(0, catchAllAt).every((s, i) => s === wanted[i])
      )
    }
    if (have.length !== wanted.length) return false
    return have.every((s, i) => (s.startsWith("[") && s.endsWith("]")) || s === wanted[i])
  })
}

/**
 * The origin variables that mean "this Next.js app".
 *
 * TWO UNIVERSES, and conflating them is how this check produces false alarms.
 * A URL built on `CONVEX_SITE_URL` is served by the Convex HTTP router in
 * `convex/http.ts` — `/connect/stripe/callback` is one — and has no `page.tsx`
 * anywhere, correctly. Only URLs on the APP origin are the App Router's to
 * answer for.
 */
const APP_ORIGIN_VARS = ["appUrl", "APP_URL", "baseUrl", "SITE_URL"]

/** Every return URL literal in the app's Convex functions, with its file. */
function declaredReturnUrls(): Array<{ file: string; field: string; pathname: string }> {
  const found: Array<{ file: string; field: string; pathname: string }> = []

  for (const entry of fs.readdirSync(CONVEX_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue
    const source = fs.readFileSync(path.join(CONVEX_DIR, entry.name), "utf8")

    for (const field of RETURN_URL_FIELDS) {
      const pattern = new RegExp(
        `${field}\\s*:\\s*\`\\$\\{([A-Za-z0-9_.]+)\\}([^\`]*)\``,
        "g"
      )
      for (const match of source.matchAll(pattern)) {
        const origin = match[1] ?? ""
        const raw = match[2] ?? ""

        // Not this app's router: `CONVEX_SITE_URL` paths are `convex/http.ts`
        // routes, which is where the OAuth callbacks live.
        if (!APP_ORIGIN_VARS.includes(origin)) continue

        // A path assembled from a caller's argument is not a literal to check —
        // `stripe.ts` takes its `successUrl` from the storefront. Skipping it is
        // honest; pretending to resolve `${args.x.includes('?') ? …}` is not.
        if (raw.includes("${")) continue

        // Only the path. A query string is the provider's business, not the
        // router's, and a hash never reaches the server.
        const pathname = raw.split("?")[0]!.split("#")[0]!
        if (pathname.length === 0) continue
        found.push({ file: entry.name, field, pathname })
      }
    }
  }

  return found
}

describe("payment provider return URLs", () => {
  const routes = routePathnames()
  const declared = declaredReturnUrls()

  it("resolves the App Router tree at all", () => {
    // A sweep that finds no routes would call every URL broken; one that finds
    // no URLs would call every URL fine. Both read as the same green.
    expect(routes.length).toBeGreaterThan(20)
    expect(routes).toContain("/dashboard/subscription")
  })

  it("finds the return URLs it is about", () => {
    expect(declared.length).toBeGreaterThan(0)
    expect(declared.map((d) => d.file)).toContain("bidSubscription.ts")
  })

  it("sends every customer back to a route that exists", () => {
    /*
     * The one that would have caught it. `/admin/subscription` is not a route —
     * `(admin)` is a group — so an owner who had just paid landed on a 404.
     */
    const broken = declared
      .filter((d) => !isServedBy(d.pathname, routes))
      .map((d) => `${d.file} ${d.field} → ${d.pathname}`)

    expect(broken).toEqual([])
  })

  it("never sends anybody to a route group path", () => {
    // The specific misreading, named: a URL containing `/admin/` or
    // `/storefront/` has taken a folder name for a URL segment.
    const groupish = declared
      .filter((d) => /\/(admin|storefront|auth|test)(\/|$)/.test(d.pathname))
      .map((d) => `${d.file} ${d.field} → ${d.pathname}`)

    expect(groupish).toEqual([])
  })
})
