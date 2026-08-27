import { describe, it, expect, vi } from "vitest"
import {
  create,
  remove,
  update,
  updateAddress,
  updateDisplayConfig,
  updateHours,
  updateOrderConfirmation,
  updatePrintConfig,
  updateSoundConfig,
} from "../stores"
import { REDACTED, SYSTEM_ACTOR } from "../storeAudit"

// ---------------------------------------------------------------------------
// Mock Convex DB
// ---------------------------------------------------------------------------

function createMockDb(records: Record<string, any> = {}) {
  const store: Record<string, any> = { ...records }
  const inserted: Array<{ table: string; doc: any }> = []
  let sequence = 0

  return {
    get: vi.fn(async (id: string) => store[id] ?? null),
    patch: vi.fn(async (id: string, updates: any) => {
      if (store[id]) {
        Object.assign(store[id], updates)
      }
    }),
    insert: vi.fn(async (table: string, doc: any) => {
      const id = `${table}:${++sequence}`
      store[id] = { _id: id, ...doc }
      inserted.push({ table, doc })
      return id
    }),
    delete: vi.fn(async (id: string) => {
      delete store[id]
    }),
    // Enough of the query builder for `grantCreatedStoreAccess` to find a
    // profile: rows belong to the table their id is prefixed with, and
    // `withIndex` is honoured as the equalities it declares.
    query: (table: string) => {
      const rows = Object.entries(store)
        .filter(([id]) => id.startsWith(`${table}:`))
        .map(([id, doc]) => ({ ...doc, _id: id }))
      return {
        withIndex: (_index: string, constrain?: (q: any) => unknown) => {
          const equalities: Record<string, unknown> = {}
          const q = {
            eq: (field: string, value: unknown) => {
              equalities[field] = value
              return q
            },
          }
          constrain?.(q)
          const matched = rows.filter((row) =>
            Object.entries(equalities).every(
              ([field, value]) => (row as any)[field] === value
            )
          )
          return {
            unique: async () => matched[0] ?? null,
            first: async () => matched[0] ?? null,
            collect: async () => matched,
          }
        },
        collect: async () => rows,
      }
    },
    inserted,
  }
}

/** A `client_admin` profile, the role that administers what it creates. */
function ownerProfile(userId: string, storeIds: string[] = []) {
  return {
    "userProfiles:owner": {
      userId,
      role: "client_admin",
      storeIds,
      permissions: [],
      language: "fr",
      twoFactorEnabled: false,
      createdAt: 1,
      updatedAt: 1,
    },
  }
}

/** A mutation context, optionally carrying a signed-in caller. */
function createCtx(db: ReturnType<typeof createMockDb>, subject?: string) {
  return {
    db,
    auth: { getUserIdentity: async () => (subject ? { subject } : null) },
  }
}

/** The audit rows a handler appended, newest last. */
function auditEntries(db: ReturnType<typeof createMockDb>) {
  return db.inserted
    .filter((row) => row.table === "systemAuditLog")
    .map((row) => row.doc)
}

/** The single audit row a handler appended, with `details` already parsed. */
function soleAuditEntry(db: ReturnType<typeof createMockDb>) {
  const entries = auditEntries(db)
  expect(entries).toHaveLength(1)
  return { ...entries[0]!, details: JSON.parse(entries[0]!.details) }
}

const A_STORE = {
  _id: "stores:1",
  name: "Pizzeria Roma",
  slug: "pizzeria-roma",
  status: "open",
  address: {
    street: "1 rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    country: "France",
  },
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe("create", () => {
  const ARGS = {
    name: "Pizzeria Roma",
    slug: "pizzeria-roma",
    address: {
      street: "1 rue de la Paix",
      city: "Paris",
      postalCode: "75002",
      country: "France",
    },
  }

  it("inserts the store and returns its id", async () => {
    const db = createMockDb(ownerProfile("user_42"))
    const id = await create.handler(createCtx(db, "user_42"), ARGS)

    expect(id).toBe("stores:1")
    expect(db.insert).toHaveBeenCalledWith("stores", expect.objectContaining({
      name: "Pizzeria Roma",
      status: "draft",
      useGlobalHours: true,
    }))
  })

  it("records who created which establishment", async () => {
    const db = createMockDb(ownerProfile("user_42"))
    await create.handler(createCtx(db, "user_42"), ARGS)

    const entry = soleAuditEntry(db)
    expect(entry.action).toBe("store_created")
    expect(entry.performedBy).toBe("user_42")
    expect(entry.targetStoreId).toBe("stores:1")
    expect(entry.details.operation).toBe("create")
    expect(entry.details.storeName).toBe("Pizzeria Roma")
    expect(entry.details.snapshot).toMatchObject({
      name: "Pizzeria Roma",
      slug: "pizzeria-roma",
      status: "draft",
    })
  })

  it("makes the owner an administrator of what they just created", async () => {
    const db = createMockDb(ownerProfile("user_42", ["stores:existing"]))

    const id = await create.handler(createCtx(db, "user_42"), ARGS)

    expect(db.patch).toHaveBeenCalledWith("userProfiles:owner", expect.objectContaining({
      storeIds: ["stores:existing", id],
    }))
  })

  it("leaves the role alone while granting the store", async () => {
    const db = createMockDb(ownerProfile("user_42"))

    await create.handler(createCtx(db, "user_42"), ARGS)

    const patched = db.patch.mock.calls.find((c) => c[0] === "userProfiles:owner")
    expect(patched?.[1]).not.toHaveProperty("role")
  })

  it("grants nothing when the creator has no session", async () => {
    const db = createMockDb(ownerProfile("user_42"))

    await create.handler(createCtx(db), ARGS)

    expect(db.patch).not.toHaveBeenCalled()
  })

  it("grants nothing when the caller has no profile", async () => {
    const db = createMockDb()

    await create.handler(createCtx(db, "user_ghost"), ARGS)

    expect(db.patch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("update", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      update.handler(createCtx(db), { id: "stores:missing", name: "X" })
    ).rejects.toThrow("Store not found")
  })

  it("writes no audit entry when the store does not exist", async () => {
    const db = createMockDb()
    await expect(
      update.handler(createCtx(db), { id: "stores:missing", name: "X" })
    ).rejects.toThrow()
    expect(auditEntries(db)).toHaveLength(0)
  })

  it("records the before and after of every field the edit moved", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })

    await update.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      name: "Roma Trastevere",
      status: "closed",
    })

    const entry = soleAuditEntry(db)
    expect(entry.action).toBe("store_updated")
    expect(entry.details.operation).toBe("update")
    expect(entry.details.changes).toEqual({
      name: { before: "Pizzeria Roma", after: "Roma Trastevere" },
      status: { before: "open", after: "closed" },
    })
  })

  it("leaves untouched fields out of the entry", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })

    await update.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      name: "Pizzeria Roma",
      status: "closed",
    })

    expect(Object.keys(soleAuditEntry(db).details.changes)).toEqual(["status"])
  })

  it("attributes the change to the system when no session is attached", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })
    await update.handler(createCtx(db), { id: "stores:1", status: "draft" })
    expect(soleAuditEntry(db).performedBy).toBe(SYSTEM_ACTOR)
  })
})

// ---------------------------------------------------------------------------
// updateHours
// ---------------------------------------------------------------------------

describe("updateHours", () => {
  const HOURS = [{ day: 1, open: "09:00", close: "22:00", isClosed: false }]

  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateHours.handler(createCtx(db), { id: "stores:missing", hours: HOURS })
    ).rejects.toThrow("Store not found")
  })

  it("patches the hours and records the change", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE, hours: [] } })

    await updateHours.handler(createCtx(db, "user_42"), { id: "stores:1", hours: HOURS })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({ hours: HOURS }))
    const entry = soleAuditEntry(db)
    expect(entry.details.operation).toBe("updateHours")
    expect(entry.details.changes.hours).toEqual({ before: [], after: HOURS })
  })
})

// ---------------------------------------------------------------------------
// updateAddress
// ---------------------------------------------------------------------------

describe("updateAddress", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateAddress.handler(createCtx(db), { id: "stores:missing", address: A_STORE.address })
    ).rejects.toThrow("Store not found")
  })

  it("records the move from one address to the other", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })
    const address = { ...A_STORE.address, street: "2 avenue de l'Opéra" }

    await updateAddress.handler(createCtx(db, "user_42"), { id: "stores:1", address })

    const entry = soleAuditEntry(db)
    expect(entry.details.changes.address.before.street).toBe("1 rue de la Paix")
    expect(entry.details.changes.address.after.street).toBe("2 avenue de l'Opéra")
  })
})

// ---------------------------------------------------------------------------
// updatePrintConfig
// ---------------------------------------------------------------------------

describe("updatePrintConfig", () => {
  it("should export args and handler", () => {
    expect(updatePrintConfig).toHaveProperty("args")
    expect(typeof updatePrintConfig.handler).toBe("function")
  })

  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updatePrintConfig.handler(createCtx(db), { id: "stores:missing", printConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch printConfig on existing store", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = {
      provider: "browser",
      triggers: ["confirmed", "ready"],
      paperSize: "80mm",
      enabled: true,
    }

    await updatePrintConfig.handler(createCtx(db), { id: "stores:1", printConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      printConfig: config,
      updatedAt: expect.any(Number),
    }))
  })

  it("should allow clearing printConfig with undefined", async () => {
    const db = createMockDb({
      "stores:1": { _id: "stores:1", printConfig: { enabled: true } },
    })

    await updatePrintConfig.handler(createCtx(db), { id: "stores:1", printConfig: undefined })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      printConfig: undefined,
    }))
  })

  it("never writes the printer credential into the journal", async () => {
    const db = createMockDb({
      "stores:1": {
        ...A_STORE,
        printConfig: { provider: "star_cloud", apiKey: "old-secret", enabled: true },
      },
    })

    await updatePrintConfig.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      printConfig: {
        provider: "star_cloud",
        apiKey: "new-secret",
        triggers: ["confirmed"],
        paperSize: "80mm",
        enabled: true,
      },
    })

    const raw = auditEntries(db)[0]!.details as string
    expect(raw).not.toContain("old-secret")
    expect(raw).not.toContain("new-secret")
    expect(raw).toContain(REDACTED)
    // The store itself still gets the real key.
    expect(db.patch.mock.calls[0]![1].printConfig.apiKey).toBe("new-secret")
  })
})

// ---------------------------------------------------------------------------
// updateDisplayConfig
// ---------------------------------------------------------------------------

describe("updateDisplayConfig", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateDisplayConfig.handler(createCtx(db), { id: "stores:missing", displayConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch displayConfig on existing store", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = { autoDismissEnabled: true, autoDismissMinutes: 10 }

    await updateDisplayConfig.handler(createCtx(db), { id: "stores:1", displayConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      displayConfig: config,
      updatedAt: expect.any(Number),
    }))
  })

  it("should set updatedAt timestamp", async () => {
    const before = Date.now()
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateDisplayConfig.handler(createCtx(db), {
      id: "stores:1",
      displayConfig: { autoDismissEnabled: false, autoDismissMinutes: 0 },
    })

    const updatedAt = db.patch.mock.calls[0]![1].updatedAt
    expect(updatedAt).toBeGreaterThanOrEqual(before)
    expect(updatedAt).toBeLessThanOrEqual(Date.now())
  })

  it("records the settings change", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })
    await updateDisplayConfig.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      displayConfig: { autoDismissEnabled: true, autoDismissMinutes: 10 },
    })
    expect(soleAuditEntry(db).details.operation).toBe("updateDisplayConfig")
  })
})

// ---------------------------------------------------------------------------
// updateSoundConfig
// ---------------------------------------------------------------------------

describe("updateSoundConfig", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateSoundConfig.handler(createCtx(db), { id: "stores:missing", soundConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch soundConfig with 3 channels", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = {
      newTicket: { enabled: true, volume: 80 },
      overdue: { enabled: true, volume: 100 },
      printerOffline: { enabled: false, volume: 50 },
    }

    await updateSoundConfig.handler(createCtx(db), { id: "stores:1", soundConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      soundConfig: config,
    }))
  })
})

// ---------------------------------------------------------------------------
// updateOrderConfirmation
// ---------------------------------------------------------------------------

describe("updateOrderConfirmation", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateOrderConfirmation.handler(createCtx(db), {
        id: "stores:missing",
        orderConfirmation: "auto",
      })
    ).rejects.toThrow("Store not found")
  })

  it("should set orderConfirmation to auto", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateOrderConfirmation.handler(createCtx(db), {
      id: "stores:1",
      orderConfirmation: "auto",
    })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      orderConfirmation: "auto",
      updatedAt: expect.any(Number),
    }))
  })

  it("should set orderConfirmation to manual", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateOrderConfirmation.handler(createCtx(db), {
      id: "stores:1",
      orderConfirmation: "manual",
    })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      orderConfirmation: "manual",
    }))
  })
})

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe("remove", () => {
  it("refuses to delete a store that is not there", async () => {
    const db = createMockDb()
    await expect(
      remove.handler(createCtx(db), { id: "stores:missing" })
    ).rejects.toThrow("Store not found")
    expect(db.delete).not.toHaveBeenCalled()
  })

  it("keeps a snapshot of what was deleted", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE } })

    await remove.handler(createCtx(db, "user_42"), { id: "stores:1" })

    expect(db.delete).toHaveBeenCalledWith("stores:1")
    const entry = soleAuditEntry(db)
    expect(entry.action).toBe("store_deleted")
    expect(entry.performedBy).toBe("user_42")
    expect(entry.targetStoreId).toBe("stores:1")
    expect(entry.details.storeName).toBe("Pizzeria Roma")
    expect(entry.details.snapshot).toMatchObject({
      name: "Pizzeria Roma",
      slug: "pizzeria-roma",
      status: "open",
    })
  })
})
