/**
 * The payment connection surface: every state is named in French, and every
 * state a callback can write can be undone from the admin.
 *
 * WHY THIS EXISTS: the Stripe callback stopped writing `connected` — onboarding
 * finishing does not mean the restaurant is being paid, because `convex/stripe.ts`
 * charges on the platform key and never reads the connection row. The settings
 * screen decided whether to show "Déconnecter" by testing `status === "connected"`
 * inline, in each of the two provider cards, so the row it wrote instead could no
 * longer be removed: a live Stripe connected account, its id on file, and no
 * button. The `disconnect` mutation was reachable by nobody.
 *
 * WHY SOURCE-LEVEL IN PART: `packages/admin` renders nothing under test (no
 * jsdom, `environment: 'node'`), and the gate is JSX. So the checks below pull
 * the real expression that stands in front of each "Déconnecter" button and
 * execute it. A rule asserted only through the helper would stay green while the
 * component quietly stopped calling it — which is how this broke.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { PAYMENT_CONNECTION_STATUS_CONFIG } from "../lib/vocabulary"
import {
  canConnectProvider,
  canDisconnectProvider,
  type ProviderConnection,
} from "../lib/payment-connection"
import type { PaymentConnectionStatus } from "../lib/types"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const
const PAYMENTS_TAB = path.join(ADMIN_SRC, "pages/settings/payments-tab.tsx")

const read = (file: string): string => fs.readFileSync(file, "utf8")

const ALL_STATUSES = Object.keys(
  PAYMENT_CONNECTION_STATUS_CONFIG
) as PaymentConnectionStatus[]

const row = (status: PaymentConnectionStatus): ProviderConnection => ({
  status,
  merchantId: "acct_1Example",
})

/** The `v.literal("…")` values of a named union, in source order. */
function unionLiterals(source: string, from: string): string[] {
  const start = source.indexOf(from)
  if (start === -1) throw new Error(`no ${from} in source`)

  // Walk to the paren that closes `v.union(`, so a sibling union below cannot
  // leak in and a `),` inside it cannot cut the block short.
  let depth = 0
  let end = start + from.length - 1
  for (; end < source.length; end++) {
    if (source[end] === "(") depth++
    else if (source[end] === ")" && --depth === 0) break
  }

  const block = source.slice(start, end)
  return [...block.matchAll(/v\.literal\("([a-z_]+)"\)/g)].map((m) => m[1] as string)
}

/** Source with comments removed — a label named in a comment is not a label. */
const withoutComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

/**
 * The live render gate in front of a "Déconnecter" button, as a function of the
 * connection object. Reads whatever expression the component ships and runs it,
 * with the helper injected so a call through it is executed for real.
 */
function shippedDisconnectGate(connectionVar: string): (c: unknown) => boolean {
  const src = read(PAYMENTS_TAB)
  const at = src.indexOf("Déconnecter", src.indexOf(`handleDisconnect("${connectionVar.replace("Connection", "")}")`) - 400)
  expect(at, `no Déconnecter button for ${connectionVar}`).toBeGreaterThan(-1)

  const gates = [
    ...src
      .slice(0, at)
      .matchAll(new RegExp(`\\{([^{}]*?${connectionVar}[^{}]*?)\\s*(\\?|&&)\\s*\\(`, "g")),
  ]
  const expr = gates[gates.length - 1]?.[1]
  expect(expr, `no gate mentioning ${connectionVar} before its Déconnecter`).toBeTruthy()

  // Running the shipped gate, rather than pattern-matching it, is the point.
  const fn = new Function("canDisconnectProvider", connectionVar, `return !!(${expr})`) as (
    helper: typeof canDisconnectProvider,
    c: unknown
  ) => boolean
  return (c: unknown) => fn(canDisconnectProvider, c)
}

describe("every connection status is named in French", () => {
  it("covers the statuses the Convex schema allows, and only those", () => {
    const schema = unionLiterals(
      read(path.join(REPO, "packages/convex-schema/src/tables/paymentConnections.ts")),
      "status: v.union("
    )
    const validator = unionLiterals(
      read(path.join(REPO, "packages/convex-functions/src/paymentConnections.ts")),
      "const statusValidator = v.union("
    )

    expect(schema.length).toBeGreaterThan(3) // guards the guard
    expect([...schema].sort()).toEqual([...ALL_STATUSES].sort())
    expect([...validator].sort()).toEqual([...ALL_STATUSES].sort())
  })

  it("gives each one a label and a visual treatment, never a raw token", () => {
    for (const status of ALL_STATUSES) {
      const badge = PAYMENT_CONNECTION_STATUS_CONFIG[status]
      expect(badge.label, status).toBeTruthy()
      expect(badge.label, status).not.toBe(status)
      expect(badge.label, status).not.toMatch(/_/)
      expect(badge.dotClassName, status).toBeTruthy()
      expect(badge.textClassName, status).toBeTruthy()
    }
  })
})

describe("onboarding_complete reads as neither a success nor a failure", () => {
  const badge = PAYMENT_CONNECTION_STATUS_CONFIG.onboarding_complete

  it("has its own label, not the connected or the disconnected one", () => {
    expect(badge.label).toBe("Vérifié, pas encore actif")
    expect(badge.label).not.toBe(PAYMENT_CONNECTION_STATUS_CONFIG.connected.label)
    expect(badge.label).not.toBe(PAYMENT_CONNECTION_STATUS_CONFIG.disconnected.label)
  })

  it("has its own dot colour, shared with no other state", () => {
    const dots = ALL_STATUSES.map((s) => PAYMENT_CONNECTION_STATUS_CONFIG[s].dotClassName)
    expect(new Set(dots).size).toBe(ALL_STATUSES.length)
    expect(badge.dotClassName).toContain("amber")
  })

  it("tells the owner the takings are not reaching the account yet", () => {
    expect(badge.detail).toBeTruthy()
    expect(badge.detail).toContain("ne sont pas encore reversés")
  })
})

describe("a connection the admin recorded can be removed from the admin", () => {
  for (const status of ALL_STATUSES) {
    it(`offers "Déconnecter" for a row in "${status}"`, () => {
      expect(canDisconnectProvider(row(status))).toBe(true)
    })
  }

  it("offers nothing to disconnect when there is no row", () => {
    expect(canDisconnectProvider(undefined)).toBe(false)
    expect(canDisconnectProvider(null)).toBe(false)
  })

  // Both cards, because the inline test that broke was written twice.
  for (const connectionVar of ["stripeConnection", "sumupConnection"] as const) {
    it(`${connectionVar}: the shipped gate says yes in every status`, () => {
      const gate = shippedDisconnectGate(connectionVar)
      for (const status of ALL_STATUSES) {
        expect(gate(row(status)), status).toBe(true)
      }
      expect(gate(undefined)).toBe(false)
    })
  }
})

describe("(re)connecting is offered where it would achieve something", () => {
  it("is offered with no row, and to retry a failed or dropped connection", () => {
    expect(canConnectProvider(undefined)).toBe(true)
    expect(canConnectProvider(row("error"))).toBe(true)
    expect(canConnectProvider(row("disconnected"))).toBe(true)
  })

  it("is not offered once the provider side is finished", () => {
    // Re-running onboarding fixes nothing: what blocks onboarding_complete is
    // our charge routing, not the owner's Stripe account.
    expect(canConnectProvider(row("connected"))).toBe(false)
    expect(canConnectProvider(row("onboarding_complete"))).toBe(false)
  })
})

describe("the settings screen reads from the one map", () => {
  const src = withoutComments(read(PAYMENTS_TAB))

  it("renders the badge from PAYMENT_CONNECTION_STATUS_CONFIG", () => {
    expect(src).toContain("PAYMENT_CONNECTION_STATUS_CONFIG")
  })

  it("holds no inline status label of its own", () => {
    // `status === "connected" ? "Connecté" : "Non connecté"` was written twice
    // and folded every other state into a grey "Non connecté".
    expect(src).not.toMatch(/"Non connecté"/)
    expect(src).not.toMatch(/\?\s*"Connecté"/)
  })
})

describe("what the Stripe callback writes, the admin can undo", () => {
  function statusesWritten(app: string): string[] {
    const src = read(path.join(REPO, "apps", app, "convex/oauthCallbackHandlers.ts"))
    const upsert = src.slice(src.indexOf("internal.paymentConnections.upsert"))
    const line = upsert
      .slice(0, upsert.indexOf("});"))
      .split("\n")
      .find((l) => l.trim().startsWith("status:"))
    expect(line, `no status: line in apps/${app} stripeCallback upsert`).toBeTruthy()
    return [...(line as string).matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as string)
  }

  for (const app of APPS) {
    it(`apps/${app} writes only statuses the admin knows and can clear`, () => {
      const written = statusesWritten(app)
      expect(written.length).toBeGreaterThan(0) // guards the guard
      for (const status of written) {
        expect(ALL_STATUSES, `apps/${app} writes an unmapped status`).toContain(status)
        expect(canDisconnectProvider(row(status as PaymentConnectionStatus)), status).toBe(true)
      }
    })

    it(`apps/${app} does not call a verified Stripe account "connected"`, () => {
      // Charges are not routed to it; see convex/stripe.ts.
      expect(statusesWritten(app)).not.toContain("connected")
    })
  }

  it("keeps the two callbacks byte-identical", () => {
    const [reference, themes] = APPS.map((app) =>
      read(path.join(REPO, "apps", app, "convex/oauthCallbackHandlers.ts"))
    )
    expect(reference).toEqual(themes)
  })
})

describe("only connected opens a charge path", () => {
  for (const app of APPS) {
    it(`apps/${app} SumUp checkout still requires "connected"`, () => {
      // onboarding_complete must not become a way to charge: it means the money
      // is NOT arriving at the merchant account.
      const src = read(path.join(REPO, "apps", app, "convex/sumup.ts"))
      expect(src).toContain('connection.status !== "connected"')
      expect(src).not.toContain("onboarding_complete")
    })
  }
})
