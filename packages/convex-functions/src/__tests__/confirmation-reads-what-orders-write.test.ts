/**
 * The confirmation email may only render from fields an order actually carries.
 *
 * WHAT WAS BROKEN. `timingLine` had two branches and neither could run.
 *
 * The first read `order.scheduledFor`. That field's only writer was a dead Uber
 * Eats importer deleted with #313, and #363 had already removed its sibling
 * `scheduledAt` on the explicit finding that customer-facing scheduled ordering
 * is a capability this product does not have. The branch was nonetheless
 * written afterwards, in #367, against a field that was unbacked before it was
 * read. It is gone with the field (#413).
 *
 * The second reads `order.estimatedPrepTime`, and `orders.create` wrote the prep
 * time it computes onto the **kitchen ticket**, not onto the order. So the email
 * printed no timing row for any real order, and had never printed one. Fixed:
 * the create loop already holds every product, so it takes the longest
 * preparation time as it goes and stamps it on the order too.
 *
 * WHY THE UNIT TESTS DID NOT CATCH IT. `packages/core`'s tests call
 * `timingLine({ ...BASE, scheduledFor, estimatedPrepTime })` with fields they
 * supply themselves, so they exercise the rendering and say nothing about
 * whether an order can reach it. Both were green throughout. This test asks the
 * other question — does any order path write the field? — which is the one that
 * was never asked.
 *
 * WHAT IT ASSERTS. Every optional field the confirmation payload reads off an
 * order is either written by an `insert("orders", …)` / `patch` in `orders.ts`,
 * or is named below as knowingly unfed. The allowlist is the point: a field can
 * be unfed, but not silently.
 */

import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const SRC = path.join(__dirname, "..")

/**
 * Every module that inserts or patches an order. `orders.ts` alone is not
 * enough: `confirmationEmailAt` is stamped by `orderConfirmation.ts` itself,
 * and the payment and invoice paths patch the order they settle.
 */
const ORDER_WRITERS = [
  "orders.ts",
  "orderConfirmation.ts",
  "payments.ts",
  "invoices.ts",
  "privacy.ts",
]

const orders = ORDER_WRITERS.map((f) =>
  fs.readFileSync(path.join(SRC, f), "utf8")
).join("\n")
const confirmation = fs.readFileSync(path.join(SRC, "orderConfirmation.ts"), "utf8")

/**
 * Fields the confirmation payload reads off the order document, spelled
 * `typeof order.x === …` or `order.x ?? …` in `orderConfirmation.ts`.
 */
function fieldsReadFromOrder(source: string): string[] {
  return [...new Set([...source.matchAll(/\border\.(\w+)/g)].map((m) => m[1]!))].sort()
}

/** The object literal that starts at `from`, balanced on braces. */
function objectAt(source: string, from: number): string {
  const start = source.indexOf("{", from)
  if (start === -1) return ""
  let depth = 0
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1)
  }
  return ""
}

/** Top-level keys of an object literal. */
function keysOf(objectLiteral: string): string[] {
  const body = objectLiteral.slice(1, -1)
  const keys: string[] = []
  let depth = 0
  for (const line of body.split("\n")) {
    if (depth === 0) {
      // `orderNumber,` as well as `orderNumber: x` — the orders insert uses
      // shorthand for a third of its fields, and a colon-only regex missed them.
      const m = /^\s*(\w+)\s*[,:]/.exec(line)
      if (m) keys.push(m[1]!)
    }
    for (const ch of line) {
      if (ch === "{" || ch === "[" || ch === "(") depth++
      else if (ch === "}" || ch === "]" || ch === ")") depth--
    }
  }
  return keys
}

/**
 * Field names written onto an order document.
 *
 * Two sources, and the distinction is the whole test: `insert("orders", {…})`,
 * and the object literal of a `patch(…)` call. NOT every object key in the
 * file — the first draft of this did that, and it passed while the defect was
 * present, because `orders.ts` also builds the kitchen ticket and that literal
 * carries an `estimatedPrepTime` of its own. A scan loose enough to see the
 * ticket cannot tell the two documents apart, which is exactly the confusion
 * that produced the bug.
 */
function fieldsWrittenToOrders(source: string): Set<string> {
  const written = new Set<string>()
  for (const match of source.matchAll(/insert\("orders",/g)) {
    for (const key of keysOf(objectAt(source, match.index!))) written.add(key)
  }
  for (const match of source.matchAll(/\.patch\(([^,]*),/g)) {
    // Only a patch whose target NAMES an order. Crediting every `.patch(` in
    // these files was the first draft, and it reintroduced the exact confusion
    // this test exists to catch: `orders.ts` also patches the kitchen ticket
    // (`.patch(ticket._id as string, { … })`), and `payments.ts` and
    // `privacy.ts` patch payments, profiles, settings and webhook failures. A
    // scan loose enough to count those would have reported `estimatedPrepTime`
    // as written the moment anyone stamped it on a ticket — while the email,
    // which reads it off the order, still printed nothing.
    //
    // Deliberately conservative: an ambiguous target like `args.id` is NOT
    // counted. That can only make this test flag a field it should not, which
    // fails loudly and gets looked at — the opposite error passes silently.
    if (!/order/i.test(match[1]!)) continue
    const comma = match.index! + match[0].length - 1
    for (const key of keysOf(objectAt(source, comma))) written.add(key)
  }
  return written
}

/**
 * Read by the email, written by nothing — each with the reason it is tolerated.
 *
 * Empty, and worth keeping empty. `estimatedPrepTime` sat here: `orders.create`
 * put the computed prep time on the kitchen ticket and not on the order, so the
 * email's timing row never printed for any order. It is written now, which is
 * why the entry is gone — and "keeps the unfed allowlist honest" below is what
 * makes leaving a stale entry here fail rather than pass.
 *
 * An entry may be added for a field that genuinely cannot be fed yet. It may not
 * be added to silence this test.
 */
const KNOWINGLY_UNFED: Record<string, string> = {}

/** Convex's own document metadata, and fields set by the id rather than a key. */
const NOT_ORDER_FIELDS = new Set(["_id", "_creationTime"])

describe("the confirmation email", () => {
  const read = fieldsReadFromOrder(confirmation)
  const written = fieldsWrittenToOrders(orders)

  it("reads at least the fields this test was written about", () => {
    // Guards the regex: if `orderConfirmation.ts` is restructured so nothing
    // matches, every assertion below would vacuously pass.
    expect(read).toContain("total")
    expect(read).toContain("orderNumber")
    expect(read.length).toBeGreaterThan(10)
  })

  it("renders only from fields some order path writes", () => {
    const unfed = read.filter(
      (f) => !written.has(f) && !NOT_ORDER_FIELDS.has(f) && !(f in KNOWINGLY_UNFED)
    )
    expect(unfed).toEqual([])
  })

  it("no longer reads scheduledFor, which nothing ever wrote", () => {
    expect(read).not.toContain("scheduledFor")
    expect(confirmation.includes("order.scheduledFor")).toBe(false)
  })

  it("keeps the unfed allowlist honest — an entry that IS written should leave", () => {
    const nowWritten = Object.keys(KNOWINGLY_UNFED).filter((f) => written.has(f))
    expect(nowWritten).toEqual([])
  })
})
