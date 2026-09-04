/**
 * The Stripe charge tripwire — ISSUE #162, sub-point 4.
 *
 * `convex/stripe.ts` charges on the PLATFORM secret key and sends no
 * `stripeAccount`, `on_behalf_of` or `transfer_data`. For a while the connect
 * flow wrote `status: "connected"` anyway, so the admin showed a green
 * "Connecté" to an owner whose card takings were landing somewhere else. The
 * flow now writes `onboarding_complete` — nothing writes `connected` for Stripe
 * at all — and this guard is what stops it coming back silently.
 *
 * The rule is narrow on purpose, and the wide version is a trap: refusing
 * whenever a Stripe connection EXISTS would mean completing Connect onboarding
 * breaks card payments outright for that restaurant. Only the one status that
 * asserts something untrue is refused.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  resolveStripeCharge,
  StripeChargeRouteError,
  type StripeConnectionState,
} from "../stripeChargeRouting"

function connection(over: Partial<StripeConnectionState> = {}): StripeConnectionState {
  return { status: "onboarding_complete", merchantId: "acct_1234", ...over }
}

function refusal(state: StripeConnectionState | null): StripeChargeRouteError {
  try {
    resolveStripeCharge(state)
  } catch (error) {
    if (error instanceof StripeChargeRouteError) return error
    throw error
  }
  throw new Error("expected the charge to be refused, but it was allowed")
}

describe("resolveStripeCharge", () => {
  it('refuses "connected", the one status the charge path cannot honour', () => {
    const error = refusal(connection({ status: "connected" }))

    expect(error.reason).toBe("connected_without_routing")
    expect(error).toBeInstanceOf(Error)
  })

  it("names the connected account, so an operator can find it in Stripe", () => {
    const error = refusal(connection({ status: "connected", merchantId: "acct_9f2" }))

    expect(error.merchantId).toBe("acct_9f2")
    expect(error.message).toContain("acct_9f2")
  })

  it("still refuses when no account id was stored", () => {
    const error = refusal({ status: "connected" })

    expect(error.reason).toBe("connected_without_routing")
    expect(error.merchantId).toBeUndefined()
    // No dangling "(compte )" where the id should have been.
    expect(error.message).not.toContain("(compte )")
  })

  it("points at the work that would make the state legal, not at a stack trace", () => {
    // The refusal surfaces to a restaurant operator, so it has to say what is
    // wrong, why no card payment is going through, and which of the two ways
    // out is a fix rather than a cover-up.
    const { message } = refusal(connection({ status: "connected" }))

    expect(message).toContain("tasks/stripe-connect-runbook.md")
    expect(message).toContain("onboarding_complete")
    expect(message).toMatch(/encaissements/)
  })

  it('lets "onboarding_complete" charge on the platform, exactly as before', () => {
    // THE TRAP: this is the state a restaurant lands in the moment it finishes
    // Connect onboarding. Refusing here would break card payments for it
    // outright — a far worse defect than the mis-routing being flagged. The
    // admin already tells the owner the truth in this state.
    expect(resolveStripeCharge(connection({ status: "onboarding_complete" }))).toEqual({
      mode: "platform",
    })
  })

  it('lets "disconnected" and "error" charge on the platform', () => {
    expect(resolveStripeCharge(connection({ status: "disconnected" }))).toEqual({
      mode: "platform",
    })
    expect(resolveStripeCharge(connection({ status: "error" }))).toEqual({
      mode: "platform",
    })
  })

  it("charges on the platform when there is no connection at all", () => {
    // The overwhelmingly common case: a restaurant that never touched Connect.
    expect(resolveStripeCharge(null)).toEqual({ mode: "platform" })
    expect(resolveStripeCharge(undefined)).toEqual({ mode: "platform" })
  })

  it("refuses only that one literal, not anything that merely resembles it", () => {
    // A near-miss must not be read as the claim. `connected` is the exact
    // literal in the schema union; nothing else asserts routing.
    expect(resolveStripeCharge({ status: "Connected" })).toEqual({ mode: "platform" })
    expect(resolveStripeCharge({ status: "not_connected" })).toEqual({ mode: "platform" })
    expect(resolveStripeCharge({ status: "" })).toEqual({ mode: "platform" })
  })
})

describe("the status union this rule is written against", () => {
  /**
   * Guards the guard, against the schema rather than against itself.
   *
   * The rule above decides one literal in, three literals out. If a fifth
   * status is added to `paymentConnections` and nobody comes back here, it
   * silently gets the permissive branch — which for a status meaning "money is
   * routed elsewhere" would be the original defect all over again. So the
   * decision is measured against the schema's own text.
   */
  const SCHEMA = join(
    __dirname,
    "../../../convex-schema/src/tables/paymentConnections.ts"
  )

  /** The literals of the `status:` union, read out of the table definition. */
  function declaredStatuses(): string[] {
    const source = readFileSync(SCHEMA, "utf8")
    const open = source.indexOf("status: v.union(")
    if (open === -1) return []

    // Walk to the parenthesis that closes `v.union(`. Stopping at the first
    // `),` instead reads only as far as the first literal, which is how the
    // first version of this returned an empty list and passed nothing.
    let depth = 0
    let end = open
    for (let i = source.indexOf("(", open); i < source.length; i += 1) {
      if (source[i] === "(") depth += 1
      else if (source[i] === ")") {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    return [...source.slice(open, end).matchAll(/v\.literal\("([^"]+)"\)/g)].map(
      (m) => m[1]
    )
  }

  const REFUSED = ["connected"]
  const ALLOWED = ["onboarding_complete", "disconnected", "error"]

  it("reads the union out of the schema at all", () => {
    // Without this, a regex that matched nothing would make the test below
    // vacuously true.
    expect(declaredStatuses().length).toBeGreaterThan(0)
  })

  it("every declared status has a decision here", () => {
    expect([...declaredStatuses()].sort()).toEqual([...REFUSED, ...ALLOWED].sort())
  })

  it("each declared status gets the decision this file claims for it", () => {
    for (const status of declaredStatuses()) {
      if (REFUSED.includes(status)) {
        expect(refusal({ status }).reason).toBe("connected_without_routing")
      } else {
        expect(resolveStripeCharge({ status })).toEqual({ mode: "platform" })
      }
    }
  })
})
