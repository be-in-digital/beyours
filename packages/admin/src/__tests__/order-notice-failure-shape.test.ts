/**
 * The admin's `OrderNoticeFailure` says what the schema stores (#530).
 *
 * WHY THIS CAN DRIFT AT ALL. The admin reads Convex through a `api` object
 * resolved at runtime from the host app, so it has no generated `Doc<"orders">`
 * to lean on: `lib/types.ts` restates the order shape by hand and the screen
 * casts the query's answer to it. That is a deliberate arrangement — one admin
 * package serves three apps — and its cost is exactly this: a union narrowed or
 * widened in the schema changes nothing here, and TypeScript is happy on both
 * sides while the screen renders a branch that can no longer occur, or misses
 * one that can.
 *
 * The order detail's banner switches on `reason`. A third member added to the
 * schema and not to this file would fall through to the `transport` wording and
 * tell an owner the provider failed when it had not.
 *
 * Read as text rather than imported: `@be-in-digital/convex-schema` is a
 * workspace dependency of this package for its validators, but what is being
 * compared is the SET OF LITERALS each side declares, and a type cannot be
 * enumerated at runtime.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

const SCHEMA = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "convex-schema",
  "src",
  "tables",
  "orders.ts"
)
const ADMIN_TYPES = path.join(__dirname, "..", "lib", "types.ts")

/** `v.literal("…")` members of the reason union, in declaration order. */
function schemaReasons(): string[] {
  const source = readFileSync(SCHEMA, "utf8")
  // `\n\)` and not `\)`: the union's members each end in one, and a pattern
  // that stops at the first closing paren eats the last literal's own — which
  // silently dropped `transport` from this list while the test still ran.
  const union = source.match(
    /export const noticeFailureReasonValidator = v\.union\(([\s\S]*?)\n\)/
  )
  // `union?.[1]` and `flatMap`, not `union[1]` and `map`: `noUncheckedIndexedAccess`
  // is on, so both a match group and a capture are `string | undefined` to the
  // compiler even where this regex cannot produce one. Narrowing keeps the
  // return `string[]` without an assertion; the anti-vacuity test below is what
  // catches a capture that really did go missing.
  const body = union?.[1]
  if (!body) return []
  return [...body.matchAll(/v\.literal\("([a-z_]+)"\)/g)].flatMap((m) =>
    m[1] ? [m[1]] : []
  )
}

/** The members of the admin's own union, in declaration order. */
function adminReasons(): string[] {
  const source = readFileSync(ADMIN_TYPES, "utf8")
  const declared = source.match(/reason:\s*((?:"[a-z_]+"\s*\|?\s*)+)/)
  const body = declared?.[1]
  if (!body) return []
  return [...body.matchAll(/"([a-z_]+)"/g)].flatMap((m) => (m[1] ? [m[1]] : []))
}

describe("the order-notice failure shape", () => {
  it("both declarations are found", () => {
    // Anti-vacuity. A rename on either side makes the comparison below compare
    // two empty lists, which is the quietest way for a guard to stop guarding.
    expect(schemaReasons().length).toBeGreaterThan(1)
    expect(adminReasons().length).toBeGreaterThan(1)
  })

  it("names the same reasons as the schema", () => {
    expect(
      adminReasons(),
      "packages/admin/src/lib/types.ts restates what the schema stores; the two " +
        "unions have drifted, and the order detail banner switches on this value"
    ).toEqual(schemaReasons())
  })

  it("the screen has a branch for every reason", () => {
    // A reason the banner does not name falls through to the `transport`
    // wording, which would tell an owner the provider failed when it had not.
    const page = readFileSync(
      path.join(__dirname, "..", "pages", "orders", "order-detail-page.tsx"),
      "utf8"
    )
    for (const reason of schemaReasons()) {
      if (reason === "transport") continue // the fall-through, by design
      expect(page, `the banner does not handle "${reason}"`).toContain(
        `"${reason}"`
      )
    }
  })
})
