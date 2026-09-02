import { describe, expect, test } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { adminRoutes } from "../config/admin-routes"
import { navGroups, isCollapsible } from "../config/nav-config"

/**
 * The owner's way in to what the contact form collects.
 *
 * `contactMessages.create` is called by the storefront form. `list` and
 * `updateStatus` are exposed and permission-guarded, and nothing in the product
 * called either: a visitor wrote, the row landed in `contactMessages`, and the
 * restaurant had no screen to read it on (issue #272).
 *
 * Asserted against the source, like `apps/*\/tests/convex/scheduled-paths.test.ts`,
 * because what was missing is a screen and a link to it — neither of which is
 * something `convex-test` can see.
 */

const SRC = join(__dirname, "..")

/** Every TypeScript source under `packages/admin/src`, read once. */
function sources(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") sources(path, out)
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      out.push(readFileSync(path, "utf8"))
    }
  }
  return out
}

/** Every href the sidebar offers, sub-menu entries included. */
function navHrefs(): string[] {
  return navGroups.flatMap((group) =>
    group.items.flatMap((entry) =>
      isCollapsible(entry) ? entry.children.map((child) => child.href) : [entry.href]
    )
  )
}

/**
 * Source with its comments removed.
 *
 * Without this the assertions below pass on prose: every file here explains
 * itself, and "nothing calls `contactMessages.list`" written in a comment would
 * satisfy a test looking for `contactMessages.list`.
 */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

const admin = sources().map(code)

/** Reads `api?.contactMessages?.list` as well as `api.contactMessages.list`. */
const calls = (fn: string) =>
  admin.some((text) => new RegExp(`contactMessages\\??\\.${fn}\\b`).test(text))

describe("contact messages are readable from the admin", () => {
  test("a screen reads the store's messages", () => {
    expect(calls("list")).toBe(true)
  })

  test("a screen moves a message between new, read and archived", () => {
    expect(calls("updateStatus")).toBe(true)
  })

  test("the sidebar links that screen", () => {
    expect(navHrefs()).toContain(adminRoutes.messages)
  })
})
