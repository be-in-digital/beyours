import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"

import { envManifest, optionalSiteVars } from "@be-yours/core/env"

/**
 * An operator setting a variable this product reads.
 *
 * WHAT WAS BROKEN (#434.4). The documentation instructed setting four
 * variables that no code has ever read:
 *
 *     apps/docs/getting-started/installation.md:132  SUMUP_API_KEY=
 *     apps/docs/getting-started/installation.md:141  UBER_EATS_API_KEY=
 *     apps/docs/getting-started/installation.md:142  DELIVEROO_API_KEY=
 *     apps/docs/getting-started/installation.md:143  UBER_DIRECT_CUSTOMER_ID=
 *
 * and the same four in `_project/PROJECT_STRUCTURE.md`, plus
 * `UBER_DIRECT_CUSTOMER_ID` in the integrations guide and the production
 * checklist.
 *
 * That is not a typo. SumUp and PayPal are OAuth CLIENT PAIRS, so an operator
 * who followed the guide set `SUMUP_API_KEY`, saw it accepted by nothing, and
 * believed SumUp was configured — while the connection that actually takes a
 * card payment had never been made. `CLAUDE.md` already said the authoritative
 * list is `packages/core/src/env/schemas.ts`; the operator documents did not
 * agree with it and nothing compared them.
 *
 * WHY A TEST AND NOT A CORRECTION. Because the corrections were made once
 * before. `ARCHITECTURE.md` has carried "read by no code in this repository"
 * about these four for some time, and the installation guide went on asking
 * for them regardless — a document that describes the defect sitting beside a
 * document that commits it. What was missing is something that compares.
 *
 * SCOPE, and it is deliberately narrow: only `NAME=` lines inside fenced
 * blocks in the operator-facing documents. Prose is where a document explains
 * that a variable is NOT read, which is exactly the sentence this must not
 * punish.
 */

const REPO = path.join(__dirname, "../../..")

/**
 * The documents an operator follows to configure a deployment.
 *
 * Not every Markdown file in the repository: an audit note or a task file
 * quoting a stale variable is a record of the defect, not an instruction.
 */
const OPERATOR_DOCS = [
  "apps/docs/getting-started/installation.md",
  "apps/docs/packages/integrations.md",
  "apps/docs/packages/core.md",
  "apps/docs/guides/payments.md",
  "_project/PROJECT_STRUCTURE.md",
]

/** Every name the env schemas declare, from the schemas themselves. */
function declaredNames(): Set<string> {
  return new Set<string>([
    ...envManifest.required,
    ...envManifest.groups.flatMap((group) => group.vars),
    ...envManifest.convexKeys,
    ...optionalSiteVars,
  ])
}

/**
 * `NAME=` assignments inside fenced code blocks, with their line numbers.
 *
 * Inside a fence only, because prose is where a document says a variable is not
 * read — and a check that failed on "there is no `SUMUP_API_KEY`" would force
 * the sentence out of the one place it belongs.
 */
function assignmentsIn(source: string): Array<{ name: string; line: number }> {
  const found: Array<{ name: string; line: number }> = []
  let fenced = false
  source.split("\n").forEach((raw, index) => {
    if (/^\s*(?:```|~~~)/.test(raw)) {
      fenced = !fenced
      return
    }
    if (!fenced) return
    const line = raw.trim()
    // A comment inside a fence is still prose.
    if (line.startsWith("#")) return
    const match = /^([A-Z][A-Z0-9_]{2,})=/.exec(line)
    if (match) found.push({ name: match[1]!, line: index + 1 })
  })
  return found
}

/**
 * Names that legitimately appear in a fence and are not this product's env.
 *
 * Each one is a decision, written down, rather than a hole: the alternative is
 * a check nobody can keep green, which gets deleted.
 */
const NOT_OUR_ENV = new Set([
  // The client's own AWS CLI session, in the S3/SES setup snippets.
  "AWS_PAGER",
  "AWS_PROFILE",
  "AWS_DEFAULT_REGION",
  // Node and pnpm, in build snippets.
  "NODE_ENV",
  "NODE_AUTH_TOKEN",
  "NODE_OPTIONS",
  "CI",
  "DEBUG",
  // `apps/site` has its own Convex backend and its own env tier; these
  // documents describe both products.
  "STRIPE_BID_SECRET_KEY",
  "STRIPE_BID_WEBHOOK_SECRET",
])

describe("the documents an operator configures from", () => {
  test("the scan finds assignments, so it cannot pass vacuously", () => {
    const total = OPERATOR_DOCS.reduce((count, file) => {
      const full = path.join(REPO, file)
      if (!fs.existsSync(full)) return count
      return count + assignmentsIn(fs.readFileSync(full, "utf8")).length
    }, 0)
    expect(total).toBeGreaterThan(20)
  })

  test("every variable they tell an operator to set is one this product reads", () => {
    const declared = declaredNames()
    const orphans: string[] = []

    for (const file of OPERATOR_DOCS) {
      const full = path.join(REPO, file)
      if (!fs.existsSync(full)) continue
      for (const { name, line } of assignmentsIn(fs.readFileSync(full, "utf8"))) {
        if (declared.has(name) || NOT_OUR_ENV.has(name)) continue
        if (name.startsWith("NEXT_PUBLIC_")) continue
        orphans.push(`${file}:${line} ${name}`)
      }
    }

    expect(orphans).toEqual([])
  })

  test("and the four this was written for are gone", () => {
    // Named, because a sweep that passes over an empty set says nothing about
    // the four that made this necessary.
    const declared = declaredNames()
    for (const name of [
      "SUMUP_API_KEY",
      "UBER_EATS_API_KEY",
      "DELIVEROO_API_KEY",
      "UBER_DIRECT_CUSTOMER_ID",
    ]) {
      expect(declared.has(name), `${name} is declared after all`).toBe(false)
    }
  })

  test("the OAuth pairs that replaced them ARE declared", () => {
    // The other half: a check that only refuses is a check that would pass on
    // a document listing nothing at all.
    const declared = declaredNames()
    for (const name of [
      "SUMUP_CLIENT_ID",
      "SUMUP_CLIENT_SECRET",
      "UBER_EATS_CLIENT_ID",
      "UBER_EATS_CLIENT_SECRET",
      "DELIVEROO_CLIENT_ID",
      "DELIVEROO_CLIENT_SECRET",
    ]) {
      expect(declared.has(name), `${name} is not declared`).toBe(true)
    }
  })
})
