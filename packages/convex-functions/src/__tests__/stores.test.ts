import { describe, it, expect, vi } from "vitest"
import {
  BRANDING_FIELDS,
  MAX_BRANDING_VALUE_LENGTH,
  assertBrandingValues,
  create,
  mergeBranding,
  remove,
  update,
  updateAddress,
  updateBranding,
  updateHours,
  updatePrintConfig,
  updateSoundConfig,
  updateDisplayConfig,
  MIN_AUTO_DISMISS_MINUTES,
  MAX_AUTO_DISMISS_MINUTES,
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
            // `remove` sweeps the store's dependants through indexed `take`
            // calls before deleting the row (#169).
            take: async (limit: number) => matched.slice(0, limit),
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
// updateDisplayConfig
// ---------------------------------------------------------------------------

/**
 * The range guard, at the door it is enforced in.
 *
 * `v.number()` accepts `0`, negatives, `NaN` and `Infinity`, and every one of
 * them makes `getForDisplay` drop every ready ticket from the customer-facing
 * dining-room screen. The end-to-end proof — that the order stays on the wall
 * after a refusal — is in `apps/*\/tests/convex/kitchen-display-config.test.ts`,
 * through the real mutation and the real query. These are the contract: what is
 * refused, and that a refusal writes nothing.
 */
describe("updateDisplayConfig", () => {
  const valid = { autoDismissEnabled: true, autoDismissMinutes: 30 }

  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateDisplayConfig.handler(createCtx(db), {
        id: "stores:missing",
        displayConfig: valid,
      })
    ).rejects.toThrow("Store not found")
  })

  it("patches a window inside the range", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateDisplayConfig.handler(createCtx(db), {
      id: "stores:1",
      displayConfig: valid,
    })

    expect(db.patch).toHaveBeenCalledWith(
      "stores:1",
      expect.objectContaining({ displayConfig: valid })
    )
  })

  it("accepts its own boundaries", async () => {
    for (const autoDismissMinutes of [
      MIN_AUTO_DISMISS_MINUTES,
      MAX_AUTO_DISMISS_MINUTES,
    ]) {
      const db = createMockDb({ "stores:1": { _id: "stores:1" } })
      await updateDisplayConfig.handler(createCtx(db), {
        id: "stores:1",
        displayConfig: { autoDismissEnabled: true, autoDismissMinutes },
      })
      expect(db.patch).toHaveBeenCalled()
    }
  })

  it.each([
    ["zero", 0],
    ["a negative", -30],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["below the minimum", MIN_AUTO_DISMISS_MINUTES - 1],
    ["above the maximum", MAX_AUTO_DISMISS_MINUTES + 1],
  ])("refuses %s, and writes nothing", async (_label, autoDismissMinutes) => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await expect(
      updateDisplayConfig.handler(createCtx(db), {
        id: "stores:1",
        displayConfig: { autoDismissEnabled: true, autoDismissMinutes },
      })
    ).rejects.toThrow(/invalid_display_config/)

    // Refused, not clamped: nothing reaches the document, so the screen keeps
    // running on whatever it was already running on.
    expect(db.patch).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("still allows the setting to be cleared", async () => {
    // Clearing is how an owner returns the screen to the query's own default,
    // and an absent window is not an out-of-range one.
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateDisplayConfig.handler(createCtx(db), {
      id: "stores:1",
      displayConfig: undefined,
    })

    expect(db.patch).toHaveBeenCalledWith(
      "stores:1",
      expect.objectContaining({ displayConfig: undefined })
    )
  })
})

// ---------------------------------------------------------------------------
// updateBranding
// ---------------------------------------------------------------------------

/**
 * The Design screen saves in three pieces and `branding` is one blob, so the
 * question these tests ask is never "did the write land" but "did it land
 * without taking the other two pieces with it".
 */
describe("mergeBranding", () => {
  it("keeps the fields a partial write does not name", () => {
    const merged = mergeBranding(
      { primaryColor: "#FF6B00", accentColor: "#FF9800" },
      { fontHeading: "Playfair" }
    )
    expect(merged).toEqual({
      primaryColor: "#FF6B00",
      accentColor: "#FF9800",
      fontHeading: "Playfair",
    })
  })

  it("overwrites the field it does name", () => {
    expect(mergeBranding({ primaryColor: "#000" }, { primaryColor: "#FFF" }))
      .toEqual({ primaryColor: "#FFF" })
  })

  it("reads an empty string as a clear, not as a value", () => {
    // `<input>` returns `""` for a box the owner emptied. Storing it would
    // leave `<img src="">` on the page; ignoring it would make the clear
    // button do nothing.
    expect(mergeBranding({ logoUrl: "https://x.test/a.png" }, { logoUrl: "" }))
      .toEqual({})
  })

  it("ignores an absent field rather than deleting it", () => {
    expect(mergeBranding({ logoUrl: "https://x.test/a.png" }, { logoUrl: undefined }))
      .toEqual({ logoUrl: "https://x.test/a.png" })
  })

  it("carries through a key it does not know about", () => {
    // `branding` is a legacy `v.any()` blob; a deployment may hold a key this
    // validator never named, and dropping it would be silent data loss.
    expect(mergeBranding({ legacyTheme: "pizzeria" }, { primaryColor: "#FFF" }))
      .toEqual({ legacyTheme: "pizzeria", primaryColor: "#FFF" })
  })

  it("starts from nothing when the store has no branding", () => {
    expect(mergeBranding(undefined, { primaryColor: "#FFF" })).toEqual({ primaryColor: "#FFF" })
    expect(mergeBranding(null, { primaryColor: "#FFF" })).toEqual({ primaryColor: "#FFF" })
  })

  it("refuses to merge into something that is not an object", () => {
    // A string or an array where an object was expected would otherwise spread
    // into numbered keys.
    expect(mergeBranding("#FF6B00", { primaryColor: "#FFF" })).toEqual({ primaryColor: "#FFF" })
    expect(mergeBranding(["#FF6B00"], { primaryColor: "#FFF" })).toEqual({ primaryColor: "#FFF" })
  })

  it("does not mutate the stored object it merges into", () => {
    const existing = { primaryColor: "#000" }
    mergeBranding(existing, { primaryColor: "#FFF" })
    expect(existing).toEqual({ primaryColor: "#000" })
  })
})

describe("assertBrandingValues", () => {
  it("accepts what the Design screen sends", () => {
    expect(() =>
      assertBrandingValues({
        primaryColor: "#FF6B00",
        fontHeading: "Playfair Display",
        logoUrl: "https://cdn.test/logo.png",
        faviconUrl: "/uploads/branding/favicon.png",
      })
    ).not.toThrow()
  })

  it("refuses a URL scheme an <img> should not be given", () => {
    // `v.string()` accepts `javascript:` and `data:` happily; these two fields
    // are rendered as a URL, so the scheme is not a matter of taste.
    expect(() => assertBrandingValues({ logoUrl: "javascript:alert(1)" }))
      .toThrow(/http\(s\) or root-relative URL/)
    expect(() => assertBrandingValues({ faviconUrl: "data:text/html;base64,PHN2Zz4=" }))
      .toThrow(/http\(s\) or root-relative URL/)
  })

  it("lets an emptied URL through, because that is a clear", () => {
    expect(() => assertBrandingValues({ logoUrl: "" })).not.toThrow()
  })

  it("bounds the length of every field", () => {
    expect(() =>
      assertBrandingValues({ fontHeading: "x".repeat(MAX_BRANDING_VALUE_LENGTH + 1) })
    ).toThrow(/exceeds/)
    expect(() =>
      assertBrandingValues({ fontHeading: "x".repeat(MAX_BRANDING_VALUE_LENGTH) })
    ).not.toThrow()
  })

  it("refuses a value that is not a string", () => {
    expect(() => assertBrandingValues({ primaryColor: 16711680 })).toThrow(/must be a string/)
  })
})

describe("updateBranding", () => {
  it("names every field the Design screen reads back, and no others", () => {
    // The page reads seven fields on mount (design-page.tsx). A field it reads
    // but the validator refuses is a save that throws; a field the validator
    // accepts but nothing reads is a key nobody will ever see again.
    expect(Object.keys(BRANDING_FIELDS).sort()).toEqual([
      "accentColor",
      "faviconUrl",
      "fontBody",
      "fontHeading",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
    ])
  })

  it("declares no `any` of its own", () => {
    // The schema stores `branding` as `v.any()`, which is how the missing
    // mutation went unnoticed. The writer does not inherit that.
    expect(updateBranding.args.branding).not.toEqual(expect.objectContaining({ kind: "any" }))
  })

  it("refuses a store that is not there", async () => {
    const db = createMockDb()
    await expect(
      updateBranding.handler(createCtx(db), {
        id: "stores:missing",
        branding: { primaryColor: "#FFF" },
      })
    ).rejects.toThrow("Store not found")
  })

  it("writes the merge, not the argument", async () => {
    const db = createMockDb({
      "stores:1": { ...A_STORE, branding: { primaryColor: "#FF6B00", accentColor: "#FF9800" } },
    })

    await updateBranding.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      branding: { fontHeading: "Playfair", fontBody: "Inter" },
    })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      branding: {
        primaryColor: "#FF6B00",
        accentColor: "#FF9800",
        fontHeading: "Playfair",
        fontBody: "Inter",
      },
      updatedAt: expect.any(Number),
    }))
  })

  it("validates before it touches the document", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE, branding: { logoUrl: "https://x.test/a.png" } } })

    await expect(
      updateBranding.handler(createCtx(db, "user_42"), {
        id: "stores:1",
        branding: { logoUrl: "javascript:alert(1)" },
      })
    ).rejects.toThrow(/http\(s\) or root-relative URL/)

    expect(db.patch).not.toHaveBeenCalled()
    expect(auditEntries(db)).toHaveLength(0)
  })

  it("journals the operation and what the branding became", async () => {
    const db = createMockDb({ "stores:1": { ...A_STORE, branding: { primaryColor: "#000" } } })

    await updateBranding.handler(createCtx(db, "user_42"), {
      id: "stores:1",
      branding: { fontHeading: "Playfair" },
    })

    const entry = soleAuditEntry(db)
    expect(entry.action).toBe("store_updated")
    expect(entry.performedBy).toBe("user_42")
    expect(entry.details.operation).toBe("updateBranding")
    // The merged result: the entry says what the branding IS, which is the
    // whole point of merging rather than replacing.
    expect(entry.details.changes.branding.after).toEqual({
      primaryColor: "#000",
      fontHeading: "Playfair",
    })
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
