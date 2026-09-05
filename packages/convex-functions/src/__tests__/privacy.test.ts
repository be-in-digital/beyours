import { describe, expect, it } from "vitest"
import { schema } from "@be-in-digital/convex-schema"
import {
  ANONYMISED_CUSTOMER_NAME,
  DEFAULT_CUSTOMER_RETENTION_DAYS,
  foldEmail,
  retentionIsArmed,
  retentionWindowMs,
} from "../privacyPolicy"
import {
  DINER_TABLES,
  PERSON_KEYED_LIMITS,
  anonymisedOrderPatch,
  anonymisedPaymentPatch,
  assertSubject,
  orderIsErasable,
} from "../privacy"
import { RATE_LIMITS } from "../rateLimit"

/**
 * The list of tables an erasure walks, against the schema itself.
 *
 * A hand-written list of places to look rots the moment somebody adds a table,
 * and the way it rots is silent: the erasure keeps passing its own tests while
 * leaving the new table untouched. So this reads the schema, finds every table
 * that declares a field capable of naming or locating a person, and insists
 * each one has been classified — either as a table the erasure reaches, or as
 * one deliberately left out with the reason written down here.
 *
 * If this fails, a table holding personal data was added. Decide which list it
 * belongs in; do not delete the assertion.
 */

/** Field names that mean "a natural person is in this row". */
const PERSONAL_FIELD_PATTERN =
  /^(email|phone|phones|customerEmail|playerEmail|playerPhone|playerName|playerFirstName|playerLastName|customerName|customerPhone|fingerprint|referrerFingerprint|ipAddress|userAgent|customerInfo|deliveryAddress|customerAddresses|street|postalCode|avatarUrl|rawBody|userId|customerId)$/

/**
 * Tables that match the pattern and are deliberately NOT part of a diner's
 * erasure, each with the reason. Keeping the reason here rather than in prose
 * is the point: the next person to read this list is deciding whether their
 * new table belongs in it.
 */
const NOT_A_DINER: Record<string, string> = {
  stores: "The establishment's own address and phone — the controller, not a data subject.",
  teamMembers: "Staff. Their erasure is an employment matter, not a diner request.",
  userProfiles: "Reached by the erasure, and listed in DINER_TABLES; also holds staff.",
  globalSettings: "A PayPal payee address and a lock holder — the business, not a diner.",
  cms: "Editorial contact details the establishment publishes about itself.",
  cmsContact: "Field LABELS on the contact form, not values.",
  cmsCheckout: "Field labels on the checkout form, not values.",
  cmsAccount: "Field labels on the account screen, not values.",
  cmsBlogPosts: "An article author — the establishment's own staff.",
  emailTemplates: "Blocks an owner composed. Any person named in one is editorial content.",
  emailCampaigns: "Same blocks, sent. Aggregate stats only.",
  paymentConnections: "A merchant id and provider tokens. The establishment's, not a diner's.",
  uberEatsConnections: "The establishment's own platform account.",
  migrationRequests: "The owner asking to move their deployment. Staff, not a diner.",
  maintenanceContracts: "A commercial contract with the establishment.",
  systemAuditLog: "The record that a request WAS answered. Keeping it is the point.",
  blogArticles: "Author ids — the establishment's own staff.",
  blogAutoConfig: "An owner id.",
  blogAutoQueue: "An owner id.",
  blogAutoUsage: "An owner id.",
  ownerEntitlements: "An owner id and their Stripe customer.",
  cmsPages: "The staff member who last edited the page.",
  cmsBlocks: "The staff member who last edited the block.",
  cmsMedia: "The staff member who uploaded the file.",
  printerSettings: "A printer's LAN address, not a person's.",
  oauthStates: "A CSRF nonce tied to no person.",
  orphanProducts: "Platform menu items that failed to import.",
}

/** Every field name a table declares, however deeply nested. */
function fieldNames(validator: unknown, into = new Set<string>()): Set<string> {
  const json = JSON.stringify(validator ?? {})
  for (const match of json.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)":\{"type"/g)) {
    if (match[1]) into.add(match[1])
  }
  return into
}

describe("DINER_TABLES against the schema", () => {
  it("classifies every table that can name or locate a person", () => {
     
    const tables = (schema as any).tables as Record<string, any>
    const names = Object.keys(tables)
    // A silent zero here would make this pass by looking at nothing.
    expect(names.length).toBeGreaterThan(50)

    const reached = new Set<string>(DINER_TABLES)
    const unclassified: string[] = []

    for (const [name, table] of Object.entries(tables)) {
      if (reached.has(name)) continue
      if (name in NOT_A_DINER) continue
      const fields = fieldNames(table.validator)
      const personal = [...fields].filter((field) => PERSONAL_FIELD_PATTERN.test(field))
      if (personal.length > 0) {
        unclassified.push(`${name} (${personal.join(", ")})`)
      }
    }

    expect(
      unclassified,
      "a table holding personal data is in neither DINER_TABLES nor NOT_A_DINER"
    ).toEqual([])
  })

  it("names only tables that exist", () => {
     
    const names = Object.keys((schema as any).tables)
    const unknown = [...DINER_TABLES, ...Object.keys(NOT_A_DINER)].filter(
      (table) => !names.includes(table)
    )
    expect(unknown).toEqual([])
  })

  it("can reach every table it claims to, by an index that exists", () => {
     
    const tables = (schema as any).tables as Record<string, any>
    const required: Array<[string, string]> = [
      ["orders", "by_storeId_createdAt"],
      ["gamePlays", "by_storeId_playedAt"],
      ["contactMessages", "by_storeId_createdAt"],
      ["promotionUsages", "by_storeId_usedAt"],
      ["emailSubscribers", "by_storeId_email"],
      ["gameReferrals", "by_storeId_referrerFingerprint"],
      ["prizeRedemptions", "by_gamePlayId"],
      ["kitchenTickets", "by_orderId"],
      ["payments", "by_orderId"],
      ["deliveryQuotes", "by_estimateId"],
      ["emailEvents", "by_subscriberId"],
      ["emailAutomationRuns", "by_subscriberId"],
      ["favorites", "by_userId"],
      ["customerAddresses", "by_userId"],
      ["userProfiles", "by_userId"],
      ["rateLimits", "by_key"],
      // Retention needs a clock where a request needs a subject.
      ["customerAddresses", "by_updatedAt"],
      ["rateLimits", "by_windowStart"],
      ["deliveryQuotes", "by_expiresAt"],
      ["gameReferrals", "by_storeId_updatedAt"],
      ["kitchenTickets", "by_status_createdAt"],
      ["platformWebhookFailures", "by_receivedAt"],
    ]
    for (const [table, index] of required) {
       
      const found = (tables[table]?.indexes ?? []).find(
         
        (i: any) => i.indexDescriptor === index
      )
      expect(found, `${table} has no index ${index}`).toBeDefined()
    }
  })

  it("marks an anonymised order so the sweep does not walk it for ever", () => {
     
    const orders = (schema as any).tables.orders
    expect(Object.keys(orders.validator.fields)).toContain("anonymisedAt")
  })
})

describe("what the erasure keeps and what it takes", () => {
  it("keeps the accounting content of an order and drops the person", () => {
    const patch = anonymisedOrderPatch(
      { items: [{ productName: "Margherita", subtotal: 1200, notes: "allergique" }] },
      1_700_000_000_000
    )
    expect(patch.customerInfo).toEqual({ name: ANONYMISED_CUSTOMER_NAME })
    expect(patch.deliveryAddress).toBeUndefined()
    expect(patch.notes).toBeUndefined()
    // The live pointers, which are not identifiers but resolve to them.
    expect(patch.viewToken).toBeUndefined()
    expect(patch.uberDirectTrackingUrl).toBeUndefined()
    expect(patch.externalPlatformData).toBeUndefined()
    // The line survives without the sentence the diner typed on it.
    expect(patch.items).toEqual([
      { productName: "Margherita", subtotal: 1200, notes: undefined },
    ])
    expect(patch.anonymisedAt).toBe(1_700_000_000_000)
  })

  it("uses one placeholder for everybody, not a per-order pseudonym", () => {
    // A per-order token would be a pseudonym — still personal data under
    // art. 4.5, still re-identifiable by whoever holds the mapping — and the
    // establishment would believe it had erased something it had not.
    const a = anonymisedOrderPatch({ items: [] }, 1)
    const b = anonymisedOrderPatch({ items: [] }, 2)
    expect(a.customerInfo).toEqual(b.customerInfo)
  })

  it("keeps the proof the money moved and drops the link to the person", () => {
    const patch = anonymisedPaymentPatch(
      {
        metadata: { last4: "4242", brand: "visa", receiptUrl: "https://s/r?email=x@y.fr" },
        refunds: [{ amount: 100, reason: "Mme Dupont s'est plainte", state: "confirmed" }],
      },
      1
    )
    expect(patch.metadata).toEqual({ last4: "4242", brand: "visa" })
    expect(patch.refundReason).toBeUndefined()
    expect((patch.refunds as Array<{ reason?: string; amount: number }>)[0]).toEqual({
      amount: 100,
      reason: undefined,
      state: "confirmed",
    })
  })

  it("will not anonymise an order that is still being served", () => {
    // Blanking the address of an undispatched order makes the courier booking
    // throw MISSING_DELIVERY_ADDRESS for ever.
    expect(orderIsErasable({ status: "completed", paymentStatus: "paid" })).toBe(true)
    expect(orderIsErasable({ status: "cancelled", paymentStatus: "failed" })).toBe(true)
    expect(orderIsErasable({ status: "out_for_delivery", paymentStatus: "paid" })).toBe(false)
    expect(orderIsErasable({ status: "preparing", paymentStatus: "paid" })).toBe(false)
    // `delivered` is NOT terminal in this product — it still moves to
    // `completed`, so it waits like every other live order.
    expect(orderIsErasable({ status: "delivered", paymentStatus: "paid" })).toBe(false)
    // Money is owed back and the operator may still need to reach them.
    expect(orderIsErasable({ status: "completed", paymentStatus: "refund_pending" })).toBe(false)
  })
})

describe("the subject", () => {
  it("refuses a request that names nobody", () => {
    // Without this an empty subject matches every row with no address.
    expect(() => assertSubject({})).toThrow(/PRIVACY_SUBJECT_REQUIRED/)
    expect(() => assertSubject({ email: "   " })).toThrow(/PRIVACY_SUBJECT_REQUIRED/)
  })

  it("folds an address so one spelling finds the other", () => {
    expect(assertSubject({ email: "  Marie.Dupont@Example.FR " }).email).toBe(
      "marie.dupont@example.fr"
    )
    expect(foldEmail("MARIE@X.FR")).toBe(foldEmail(" marie@x.fr "))
  })

  it("does not fold a device fingerprint", () => {
    // A fingerprint is an opaque token, not something a human typed: folding
    // it would merge two devices onto one identity.
    expect(assertSubject({ fingerprint: "Fp-9F3C2a" }).fingerprint).toBe("Fp-9F3C2a")
  })
})

describe("the limiter rows that are the person", () => {
  it("names only rules that exist, and only ones keyed on a person", () => {
    for (const limit of PERSON_KEYED_LIMITS) {
      expect(RATE_LIMITS[limit.name], `${limit.name} is not a rate limit`).toBeDefined()
      // Every one of them folds its subject, which is what makes the key
      // exactly reconstructible from the folded address.
      expect(RATE_LIMITS[limit.name].foldSubjectCase).toBe(true)
    }
  })

  it("covers every rule whose subject is an address or a device", () => {
    const covered = new Set(PERSON_KEYED_LIMITS.map((l) => l.name as string))
    const shouldCover = Object.keys(RATE_LIMITS).filter(
      (name) => /PerEmail$|PerFingerprint$/.test(name)
    )
    expect(shouldCover.length).toBeGreaterThan(0)
    expect(shouldCover.filter((name) => !covered.has(name))).toEqual([])
  })
})

describe("the retention window", () => {
  it("defaults to the CNIL's three years", () => {
    expect(DEFAULT_CUSTOMER_RETENTION_DAYS).toBe(1095)
    expect(retentionWindowMs(undefined)).toBe(1095 * 86_400_000)
    expect(retentionWindowMs({})).toBe(1095 * 86_400_000)
  })

  it("reads an absent setting as the default, never as 'keep for ever'", () => {
    expect(retentionIsArmed(undefined)).toBe(true)
    expect(retentionIsArmed({})).toBe(true)
    expect(retentionIsArmed({ dataRetention: { enabled: true } })).toBe(true)
    // Only an explicit pause pauses it.
    expect(retentionIsArmed({ dataRetention: { enabled: false } })).toBe(false)
  })

  it("treats a nonsense window as unset rather than as 'delete everything'", () => {
    expect(retentionWindowMs({ dataRetention: { customerDataDays: 0 } })).toBe(
      1095 * 86_400_000
    )
    expect(retentionWindowMs({ dataRetention: { customerDataDays: -5 } })).toBe(
      1095 * 86_400_000
    )
  })

  it("honours a window the establishment set", () => {
    expect(retentionWindowMs({ dataRetention: { customerDataDays: 180 } })).toBe(
      180 * 86_400_000
    )
  })
})
