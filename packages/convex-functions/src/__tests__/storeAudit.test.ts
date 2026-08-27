import { describe, it, expect, vi } from "vitest"
import {
  MAX_DETAILS_LENGTH,
  REDACTED,
  STORE_AUDIT_ACTIONS,
  STORE_AUDIT_OPERATIONS,
  SYSTEM_ACTOR,
  diffStoreFields,
  prepareStoreFieldUpdate,
  recordStoreAudit,
  redactAuditValue,
  serializeAuditDetails,
  snapshotStore,
} from "../storeAudit"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCtx(subject?: string) {
  const inserted: Array<{ table: string; doc: any }> = []
  return {
    db: {
      insert: vi.fn(async (table: string, doc: any) => {
        inserted.push({ table, doc })
        return `${table}:${inserted.length}`
      }),
    },
    auth: {
      getUserIdentity: vi.fn(async () => (subject ? { subject } : null)),
    },
    inserted,
  }
}

const A_STORE = {
  _id: "stores:1",
  name: "Pizzeria Roma",
  slug: "pizzeria-roma",
  status: "open",
  address: { street: "1 rue de la Paix", city: "Paris", postalCode: "75002", country: "France" },
  phone: "+33100000000",
  email: "contact@roma.test",
  // Legacy `v.any()` blobs that must never reach the log.
  integrations: { deliveroo: { apiKey: "deliveroo-secret" } },
  branding: { primaryColor: "#000" },
  createdAt: 1,
  updatedAt: 2,
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

describe("redactAuditValue", () => {
  it("replaces the printer API key with a marker", () => {
    const redacted = redactAuditValue("printConfig", {
      provider: "star_cloud",
      apiKey: "sk-live-printer-secret",
      enabled: true,
    }) as Record<string, unknown>

    expect(redacted.apiKey).toBe(REDACTED)
    expect(redacted.provider).toBe("star_cloud")
    expect(JSON.stringify(redacted)).not.toContain("sk-live-printer-secret")
  })

  it("does not invent an apiKey when the config has none", () => {
    const value = { provider: "browser", enabled: false }
    expect(redactAuditValue("printConfig", value)).toEqual(value)
  })

  it("leaves a cleared printConfig alone", () => {
    expect(redactAuditValue("printConfig", undefined)).toBeUndefined()
    expect(redactAuditValue("printConfig", null)).toBeNull()
  })

  it("passes fields with no secret through untouched", () => {
    const hours = [{ day: 1, open: "09:00", close: "22:00", isClosed: false }]
    expect(redactAuditValue("hours", hours)).toBe(hours)
  })
})

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

describe("snapshotStore", () => {
  it("keeps only the allowlisted identity fields", () => {
    expect(Object.keys(snapshotStore(A_STORE)).sort()).toEqual([
      "address",
      "email",
      "name",
      "phone",
      "slug",
      "status",
    ])
  })

  it("drops the legacy any-typed blobs where a third-party token would sit", () => {
    const serialized = JSON.stringify(snapshotStore(A_STORE))
    expect(serialized).not.toContain("deliveroo-secret")
    expect(serialized).not.toContain("integrations")
    expect(serialized).not.toContain("branding")
  })

  it("returns an empty snapshot for a missing store", () => {
    expect(snapshotStore(null)).toEqual({})
    expect(snapshotStore(undefined)).toEqual({})
  })

  it("omits absent optional fields rather than writing undefined", () => {
    const snapshot = snapshotStore({ name: "Sans téléphone", slug: "s", status: "draft" })
    expect(snapshot).not.toHaveProperty("phone")
    expect(snapshot).not.toHaveProperty("email")
  })
})

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

describe("diffStoreFields", () => {
  it("records before and after for a changed field", () => {
    expect(diffStoreFields({ name: "Roma" }, { name: "Roma Trastevere" })).toEqual({
      name: { before: "Roma", after: "Roma Trastevere" },
    })
  })

  it("drops fields the edit did not move", () => {
    expect(diffStoreFields({ name: "Roma", status: "open" }, { name: "Roma" })).toEqual({})
  })

  it("only looks at the fields the mutation actually submitted", () => {
    const changes = diffStoreFields(A_STORE, { status: "closed" })
    expect(Object.keys(changes)).toEqual(["status"])
  })

  it("treats a first value as a change from nothing", () => {
    expect(diffStoreFields({}, { phone: "+33100000000" })).toEqual({
      phone: { before: undefined, after: "+33100000000" },
    })
  })

  it("compares nested objects structurally, not by reference", () => {
    const before = { address: { street: "1 rue de la Paix", city: "Paris" } }
    const after = { address: { city: "Paris", street: "1 rue de la Paix" } }
    expect(diffStoreFields(before, after)).toEqual({})
  })

  it("sees a nested change inside an otherwise equal object", () => {
    const changes = diffStoreFields(
      { address: { street: "1 rue de la Paix", city: "Paris" } },
      { address: { street: "2 rue de la Paix", city: "Paris" } },
    )
    expect(changes.address).toEqual({
      before: { street: "1 rue de la Paix", city: "Paris" },
      after: { street: "2 rue de la Paix", city: "Paris" },
    })
  })

  it("compares arrays element by element", () => {
    const hours = [{ day: 1, open: "09:00", close: "22:00", isClosed: false }]
    expect(diffStoreFields({ hours }, { hours: [...hours] })).toEqual({})
    expect(
      Object.keys(
        diffStoreFields({ hours }, { hours: [{ ...hours[0], close: "23:00" }] }),
      ),
    ).toEqual(["hours"])
  })

  it("does not read an absent optional field as a change to undefined", () => {
    expect(diffStoreFields({ name: "Roma" }, { description: undefined })).toEqual({})
  })

  it("redacts the printer key on BOTH sides of the diff", () => {
    const changes = diffStoreFields(
      { printConfig: { provider: "star_cloud", apiKey: "old-secret", enabled: true } },
      { printConfig: { provider: "star_cloud", apiKey: "new-secret", enabled: true } },
    )
    const serialized = JSON.stringify(changes)
    expect(serialized).not.toContain("old-secret")
    expect(serialized).not.toContain("new-secret")
    expect(serialized.match(new RegExp(REDACTED.replace(/[[\]]/g, "\\$&"), "g"))).toHaveLength(2)
  })

  it("still reports a key rotation as a change even though both sides are masked", () => {
    const changes = diffStoreFields(
      { printConfig: { provider: "star_cloud", apiKey: "old-secret", enabled: true } },
      { printConfig: { provider: "star_cloud", apiKey: "new-secret", enabled: true } },
    )
    expect(Object.keys(changes)).toEqual(["printConfig"])
  })
})

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

describe("serializeAuditDetails", () => {
  it("round-trips a normal payload", () => {
    const details = serializeAuditDetails({
      operation: STORE_AUDIT_OPERATIONS.update,
      storeName: "Roma",
      changes: { name: { before: "A", after: "B" } },
    })
    expect(JSON.parse(details)).toEqual({
      operation: "update",
      storeName: "Roma",
      changes: { name: { before: "A", after: "B" } },
    })
  })

  it("degrades to field names once the payload outgrows the cap", () => {
    const huge = "x".repeat(MAX_DETAILS_LENGTH * 2)
    const details = serializeAuditDetails({
      operation: STORE_AUDIT_OPERATIONS.updateHours,
      storeName: "Roma",
      changes: { hours: { before: huge, after: huge } },
    })

    expect(details.length).toBeLessThanOrEqual(MAX_DETAILS_LENGTH)
    expect(JSON.parse(details)).toEqual({
      operation: "updateHours",
      storeName: "Roma",
      changedFields: ["hours"],
      snapshotFields: [],
      truncated: true,
    })
  })

  it("never exceeds the cap, even when the degraded form is itself too long", () => {
    const changes: Record<string, { before: unknown; after: unknown }> = {}
    for (let i = 0; i < 500; i++) {
      changes[`field_${"n".repeat(40)}_${i}`] = { before: 1, after: 2 }
    }
    const details = serializeAuditDetails({
      operation: STORE_AUDIT_OPERATIONS.update,
      changes,
    })
    expect(details.length).toBeLessThanOrEqual(MAX_DETAILS_LENGTH)
  })
})

// ---------------------------------------------------------------------------
// Writing entries
// ---------------------------------------------------------------------------

describe("recordStoreAudit", () => {
  it("writes one systemAuditLog row naming actor, establishment and time", async () => {
    const before = Date.now()
    const ctx = createCtx("user_42")

    await recordStoreAudit(ctx, {
      action: STORE_AUDIT_ACTIONS.created,
      operation: STORE_AUDIT_OPERATIONS.create,
      storeId: "stores:1",
      storeName: "Pizzeria Roma",
      snapshot: snapshotStore(A_STORE),
    })

    expect(ctx.inserted).toHaveLength(1)
    const [{ table, doc }] = ctx.inserted
    expect(table).toBe("systemAuditLog")
    expect(doc.action).toBe("store_created")
    expect(doc.performedBy).toBe("user_42")
    expect(doc.targetStoreId).toBe("stores:1")
    expect(doc.result).toBe("success")
    expect(doc.performedAt).toBeGreaterThanOrEqual(before)
    expect(doc.performedAt).toBeLessThanOrEqual(Date.now())
  })

  it("falls back to the system actor when no session is attached", async () => {
    const ctx = createCtx()
    await recordStoreAudit(ctx, {
      action: STORE_AUDIT_ACTIONS.deleted,
      operation: STORE_AUDIT_OPERATIONS.remove,
      storeId: "stores:1",
    })
    expect(ctx.inserted[0]!.doc.performedBy).toBe(SYSTEM_ACTOR)
  })

  it("does not throw when the context carries no auth at all", async () => {
    const inserted: Array<{ table: string; doc: any }> = []
    const ctx = {
      db: { insert: async (table: string, doc: any) => void inserted.push({ table, doc }) },
    }
    await recordStoreAudit(ctx, {
      action: STORE_AUDIT_ACTIONS.updated,
      operation: STORE_AUDIT_OPERATIONS.update,
      storeId: "stores:1",
    })
    expect(inserted[0]!.doc.performedBy).toBe(SYSTEM_ACTOR)
  })
})

describe("prepareStoreFieldUpdate", () => {
  it("takes the establishment and its id off the pre-patch document", async () => {
    const ctx = createCtx("user_42")
    await recordStoreAudit(
      ctx,
      prepareStoreFieldUpdate(A_STORE, STORE_AUDIT_OPERATIONS.updateOrderMode, {
        orderMode: "auto_accept",
      }),
    )

    const entry = ctx.inserted[0]!.doc
    expect(entry.action).toBe("store_updated")
    expect(entry.targetStoreId).toBe("stores:1")
    expect(JSON.parse(entry.details)).toEqual({
      operation: "updateOrderMode",
      storeName: "Pizzeria Roma",
      changes: { orderMode: { before: undefined, after: "auto_accept" } },
    })
  })

  it("still records the attempt when the edit changed nothing", async () => {
    const ctx = createCtx("user_42")
    await recordStoreAudit(
      ctx,
      prepareStoreFieldUpdate(A_STORE, STORE_AUDIT_OPERATIONS.update, {
        name: A_STORE.name,
      }),
    )

    expect(ctx.inserted).toHaveLength(1)
    expect(JSON.parse(ctx.inserted[0]!.doc.details).changes).toEqual({})
  })

  it("is pure, so a later in-place patch cannot rewrite the before side", () => {
    const live: Record<string, unknown> = { ...A_STORE }
    const audit = prepareStoreFieldUpdate(live, STORE_AUDIT_OPERATIONS.update, {
      name: "Roma Trastevere",
    })

    // Whatever the runtime does to the document afterwards.
    live.name = "Roma Trastevere"

    expect(audit.changes).toEqual({
      name: { before: "Pizzeria Roma", after: "Roma Trastevere" },
    })
  })
})
