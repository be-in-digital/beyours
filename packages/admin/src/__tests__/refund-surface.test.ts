/**
 * The refund surface: wired to a function that exists, and reachable.
 *
 * WHY SOURCE-LEVEL: `packages/admin` receives the Convex API as `api: any`
 * (`stores/admin-api-store.ts`), so `useMutation(api?.payments?.refund)` type-
 * checked perfectly for as long as `payments.refund` had been deleted. `tsc`
 * cannot catch this class of bug and there is no jsdom in this package, so the
 * guard reads the source and resolves every `api.module.fn` — in both
 * spellings — against the Convex modules the apps actually export.
 *
 * The refund button in the order detail dialog was dead exactly this way, and
 * the sweep below found a second one the same day.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { ORDER_PAYMENT_STATUS_CONFIG } from "../lib/vocabulary"

const ADMIN_SRC = path.join(__dirname, "..")
const REPO = path.join(ADMIN_SRC, "../../..")
const APPS = ["reference", "themes"] as const
const PAYMENTS_ROUTE = "app/(admin)/dashboard/payments/page.tsx"

const read = (file: string): string => fs.readFileSync(file, "utf8")

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Names exported by an app's Convex module, or null if there is no such module. */
function convexExports(app: string, moduleName: string): string[] | null {
  const file = path.join(REPO, "apps", app, "convex", `${moduleName}.ts`)
  if (!fs.existsSync(file)) return null
  return [...read(file).matchAll(/export const (\w+)/g)].map((m) => m[1] as string)
}

/**
 * Every way this codebase spells a Convex call.
 *
 * The sweep used to read `api\?\.(\w+)\?\.(\w+)` — optional chaining only —
 * and was therefore blind to the 50-odd `api.games.updateWinRatio` and
 * `api.contactMessages.unreadCount` written without it. None of those was
 * broken on the day the blind spot was found, so this widening fixed no live
 * defect; what it fixes is the next stale call written in the plain style,
 * which would have slipped through in silence. That is exactly how the dead
 * refund button shipped.
 *
 * `\b` keeps it off `adminApi.x.y` and friends; the two `\??` cover the mixed
 * forms (`api?.x.y`, `api.x?.y`) as well.
 */
const API_REFERENCE = /\bapi\??\.(\w+)\??\.(\w+)/g

/** Every `api.module.fn` the admin source mentions, in either spelling. */
function apiReferences(): { file: string; module: string; fn: string }[] {
  return sourceFiles(path.join(ADMIN_SRC)).flatMap((file) =>
    [...read(file).matchAll(API_REFERENCE)].map((m) => ({
      file: path.relative(REPO, file),
      module: m[1] as string,
      fn: m[2] as string,
    }))
  )
}

/** Whether an app exports this function from the Convex module of that name. */
function resolves(app: string, module: string, fn: string): boolean {
  const exported = convexExports(app, module)
  return exported !== null && exported.includes(fn)
}

/**
 * Calls known to be broken, kept out of the sweep so it can still catch NEW
 * breakage. Each entry is a live defect, not an exemption — delete the row when
 * the backend function lands.
 *
 * Empty, and the cap below says it must stay that way. The one entry it ever
 * held was `stores.updateBranding`, the Design page's three save buttons: the
 * mutation landed, the rot-detection test underneath fired exactly as designed,
 * and the row came out.
 */
const KNOWN_BROKEN = new Set<string>([])

/**
 * The size this list is allowed to reach, and no larger.
 *
 * A bare `Set` filtered before the assertion is a hole with no lid: one more
 * line makes one more broken call invisible, and nothing anywhere says so. The
 * cap turns "add a row" into "raise a number in a test", which a reviewer sees.
 * Raise it only alongside the row it admits, and only for a defect being
 * tracked rather than tolerated.
 *
 * Zero now that the branding mutation exists. Every call the admin makes
 * resolves, and the sweep below has no exceptions to carry.
 */
const MAX_KNOWN_BROKEN = 0

describe("the known-broken list stays honest", () => {
  // Worded to read correctly at any cap: with the cap at 0 TypeScript narrows
  // the constant to the literal `0`, and the pluralising `=== 1` that used to
  // sit in this title became a comparison it could prove impossible.
  it(`holds no more than ${MAX_KNOWN_BROKEN} known-broken calls`, () => {
    expect([...KNOWN_BROKEN].sort()).toHaveLength(MAX_KNOWN_BROKEN)
  })

  for (const entry of KNOWN_BROKEN) {
    const [module, fn] = entry.split(".") as [string, string]

    it(`${entry} is still genuinely missing from every app`, () => {
      // Rot detection: once the backend function lands, this row stops
      // describing a defect and starts hiding whatever is written next to it.
      // Failing here forces the deletion instead of letting it sit for ever.
      const present = APPS.filter((app) => resolves(app, module, fn))
      expect(
        present,
        `api.${entry} now exists — delete it from KNOWN_BROKEN`
      ).toEqual([])
    })

    it(`${entry} is still called by the admin source`, () => {
      // A row for a call nobody makes any more protects nothing and only
      // raises the cap for the next one.
      const callers = apiReferences().filter((r) => `${r.module}.${r.fn}` === entry)
      expect(
        callers.length,
        `nothing calls api.${entry} any more — delete it from KNOWN_BROKEN`
      ).toBeGreaterThan(0)
    })
  }
})

describe("every Convex function the admin calls actually exists", () => {
  const references = apiReferences().filter(
    ({ module, fn }) => !KNOWN_BROKEN.has(`${module}.${fn}`)
  )

  it("finds api references to check at all", () => {
    // Guards the guard: a regex that silently matches nothing proves nothing.
    // 180 is roughly what the widened sweep sees today; the narrow one saw 128,
    // so this floor also fails if the regex ever narrows back.
    expect(references.length).toBeGreaterThan(150)
  })

  for (const app of APPS) {
    it(`resolves against apps/${app}/convex`, () => {
      const broken = references.filter(({ module, fn }) => !resolves(app, module, fn))
      expect(
        broken.map((b) => `${b.file}: api.${b.module}.${b.fn}`),
      ).toEqual([])
    })
  }
})

describe("the refund is wired to the action, not the deleted mutation", () => {
  const files = [
    path.join(ADMIN_SRC, "pages/orders/order-detail-page.tsx"),
    path.join(ADMIN_SRC, "pages/payments/refund-dialog.tsx"),
  ]

  for (const file of files) {
    const name = path.basename(file)

    it(`${name} calls payments.refundPayment through useAction`, () => {
      const src = read(file)
      expect(src).toContain("useAction(api?.payments?.refundPayment")
    })

    it(`${name} no longer calls the deleted payments.refund`, () => {
      // A refund moves money at a provider; a mutation cannot. `payments.refund`
      // was a database-only patch that reported success while the customer was
      // never paid back, and it was deleted.
      expect(read(file)).not.toMatch(/api\?\.payments\?\.refund\b(?!Payment)/)
    })
  }
})

describe("the refund button asks the same question the server does", () => {
  /**
   * The server gates the refund on `payments:refund`; the button used to gate
   * on the payment's status alone. `manager` and `waiter` hold `payments:read`,
   * so both reached the payments screen, both were shown a live "Rembourser",
   * and both got an exception on the click.
   *
   * The decision now lives once, in `refundControlState`. These greps exist so
   * a third call site cannot quietly go back to asking half the question — the
   * two copies of the old status test are how the partial-refund bug survived
   * being fixed once.
   */
  const CALL_SITES = [
    "pages/payments/payments-page.tsx",
    "pages/orders/order-detail-page.tsx",
  ]

  for (const file of CALL_SITES) {
    const src = read(path.join(ADMIN_SRC, file))
    const name = path.basename(file)

    it(`${name} decides through the shared helper`, () => {
      expect(src).toContain("refundControlState(")
    })

    it(`${name} does not gate the button on the payment alone`, () => {
      // `canRefundPayment` answers "is this money refundable", not "may you".
      expect(src).not.toContain("canRefundPayment(")
    })

    it(`${name} renders the control through RefundControl, disabled and all`, () => {
      expect(src).toContain("<RefundControl state={refund}")
      expect(src).toContain("disabled={refund.disabled}")
    })

    it(`${name} does not put the explanation on the button itself`, () => {
      // The shared button sets `disabled:pointer-events-none`, so a `title` on
      // a disabled one is in the DOM and invisible on screen. See
      // `refund-control.tsx`.
      expect(src).not.toContain("title={refund.reason}")
    })

    it(`${name} spells no permission rule of its own`, () => {
      // A second mechanism is a second thing to forget. The permission name
      // belongs in `refund-eligibility.ts` and nowhere else.
      expect(src).not.toContain('"payments:refund"')
    })
  }

  it("keeps the explanation somewhere a pointer can reach it", () => {
    const src = read(path.join(ADMIN_SRC, "pages/payments/refund-control.tsx"))
    expect(src).toContain("title={state.reason}")
    // Not refundable at all means no control — the words on the order banner
    // cover that case, and one more dead button would not.
    expect(src).toContain("if (!state.visible) return null")
  })

  it("keeps the permission the backend actually enforces", () => {
    // If the server ever moves the refund to another permission, this is where
    // the mirror is caught out.
    for (const app of APPS) {
      const src = read(path.join(REPO, "apps", app, "convex/payments.ts"))
      expect(src, app).toContain('"payments:refund"')
    }
    expect(read(path.join(ADMIN_SRC, "lib/refund-eligibility.ts"))).toContain(
      'REFUND_PERMISSION: Permission = "payments:refund"'
    )
  })
})

describe("a refund is reachable in both apps", () => {
  it("registers the payments route once, in the package", () => {
    expect(read(path.join(ADMIN_SRC, "config/admin-routes.ts"))).toContain(
      'payments: "/dashboard/payments"'
    )
  })

  for (const app of APPS) {
    it(`apps/${app} mounts PaymentsPage at that route`, () => {
      const file = path.join(REPO, "apps", app, PAYMENTS_ROUTE)
      expect(fs.existsSync(file), `missing ${PAYMENTS_ROUTE}`).toBe(true)
      expect(read(file)).toContain("PaymentsPage")
    })
  }

  it("keeps the two route files byte-identical for the twin guard", () => {
    const [reference, themes] = APPS.map((app) =>
      read(path.join(REPO, "apps", app, PAYMENTS_ROUTE))
    )
    expect(reference).toEqual(themes)
  })

  it("exports PaymentsPage from the package barrel", () => {
    expect(read(path.join(ADMIN_SRC, "index.ts"))).toContain("PaymentsPage")
  })
})

describe("refund_pending is a first-class payment status", () => {
  it("has a French label and a style", () => {
    const entry = ORDER_PAYMENT_STATUS_CONFIG.refund_pending
    expect(entry).toBeDefined()
    expect(entry.label).toBe("Remboursement à effectuer")
    expect(entry.className).toBeTruthy()
  })

  it("labels every order payment status in French, never as a raw token", () => {
    for (const [status, config] of Object.entries(ORDER_PAYMENT_STATUS_CONFIG)) {
      expect(config.label, status).toBeTruthy()
      expect(config.label, status).not.toBe(status)
    }
  })

  it("is rendered from that one map by both order screens", () => {
    for (const file of ["pages/orders/order-detail-page.tsx", "pages/orders/orders-table.tsx"]) {
      const src = read(path.join(ADMIN_SRC, file))
      expect(src, file).toContain("ORDER_PAYMENT_STATUS_CONFIG")
      // A local re-declaration is how the two maps drifted apart before.
      expect(src, file).not.toContain("const paymentConfig")
    }
  })

  it("routes the operator to the refund from the order detail banner", () => {
    const src = read(path.join(ADMIN_SRC, "pages/orders/order-detail-page.tsx"))
    expect(src).toContain('order?.paymentStatus === "refund_pending"')
    expect(src).toContain("Remboursement à effectuer")
    expect(src).toContain("Rembourser le client")
  })

  it("never shows a customer the raw status token", () => {
    for (const app of APPS) {
      const src = read(
        path.join(REPO, "apps", app, "app/(storefront)/checkout/success/page.tsx")
      )
      expect(src, app).toContain("CUSTOMER_PAYMENT_STATUS_LABELS")
      expect(src, app).not.toContain("{outcome.label}")
    }
  })
})
