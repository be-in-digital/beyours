import { describe, it, expect } from "vitest"
import {
  add,
  update,
  remove,
  setDefault,
  listByUser,
  importFromLocal,
} from "../customerAddresses"

/**
 * A tiny in-memory Convex db, enough to exercise the default invariant and the
 * import idempotency — the two places where this module can genuinely go wrong.
 */
function makeCtx(seed: Record<string, any>[] = []) {
  const docs: Record<string, any> = {}
  let counter = 0
  for (const doc of seed) {
    const id = `customerAddresses:${++counter}`
    docs[id] = { _id: id, ...doc }
  }

  const ctx = {
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}:${++counter}`
        docs[id] = { _id: id, ...doc }
        return id
      },
      get: async (id: string) => docs[id] ?? null,
      patch: async (id: string, updates: Record<string, unknown>) => {
        Object.assign(docs[id] ?? {}, updates)
      },
      delete: async (id: string) => {
        delete docs[id]
      },
      query: (table: string) => ({
        withIndex: (_name: string, fn: any) => {
          let userId: string | undefined
          fn({ eq: (_f: string, v: string) => { userId = v; return { eq: () => ({}) } } })
          return {
            collect: async () =>
              Object.values(docs).filter(
                (d: any) => d._id.startsWith(table) && d.userId === userId
              ),
          }
        },
      }),
    },
  }
  return { ctx, docs }
}

const base = {
  street: "12 rue de Rivoli",
  city: "Paris",
  postalCode: "75004",
  country: "France",
}

const USER = "user_1"

function seedAddress(overrides: Record<string, any> = {}) {
  return {
    userId: USER,
    ...base,
    isDefault: false,
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  }
}

describe("exactly one default", () => {
  it("makes the first address the default", async () => {
    const { ctx, docs } = makeCtx()
    await add.handler(ctx, { userId: USER, ...base })
    const all = Object.values(docs)
    expect(all).toHaveLength(1)
    expect((all[0] as any).isDefault).toBe(true)
  })

  it("does not steal the default from an existing address", async () => {
    const { ctx, docs } = makeCtx([seedAddress({ isDefault: true })])
    await add.handler(ctx, { userId: USER, ...base, street: "5 rue B" })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
    expect((defaults[0] as any).street).toBe("12 rue de Rivoli")
  })

  it("moves the default to exactly one address", async () => {
    const { ctx, docs } = makeCtx([
      seedAddress({ isDefault: true }),
      seedAddress({ street: "5 rue B" }),
      seedAddress({ street: "7 rue C" }),
    ])
    await setDefault.handler(ctx, { userId: USER, addressId: "customerAddresses:3" })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
    expect((defaults[0] as any).street).toBe("7 rue C")
  })

  it("promotes a survivor when the default is deleted", async () => {
    // Leaving a customer with addresses but no default breaks the checkout,
    // which preselects the default.
    const { ctx, docs } = makeCtx([
      seedAddress({ isDefault: true }),
      seedAddress({ street: "5 rue B", createdAt: 2_000 }),
    ])
    await remove.handler(ctx, { userId: USER, addressId: "customerAddresses:1" })
    const remaining = Object.values(docs)
    expect(remaining).toHaveLength(1)
    expect((remaining[0] as any).isDefault).toBe(true)
  })

  it("does not promote anything when a non-default is deleted", async () => {
    const { ctx, docs } = makeCtx([
      seedAddress({ isDefault: true }),
      seedAddress({ street: "5 rue B" }),
    ])
    await remove.handler(ctx, { userId: USER, addressId: "customerAddresses:2" })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
  })
})

describe("ownership", () => {
  it("refuses to edit another customer's address", async () => {
    const { ctx } = makeCtx([seedAddress({ userId: "someone_else" })])
    await expect(
      update.handler(ctx, {
        userId: USER,
        addressId: "customerAddresses:1",
        ...base,
      })
    ).rejects.toThrow("FORBIDDEN")
  })

  it("refuses to delete another customer's address", async () => {
    const { ctx, docs } = makeCtx([seedAddress({ userId: "someone_else" })])
    await expect(
      remove.handler(ctx, { userId: USER, addressId: "customerAddresses:1" })
    ).rejects.toThrow("FORBIDDEN")
    expect(Object.values(docs)).toHaveLength(1)
  })

  it("refuses to hand another customer's address the default flag", async () => {
    const { ctx } = makeCtx([seedAddress({ userId: "someone_else" })])
    await expect(
      setDefault.handler(ctx, { userId: USER, addressId: "customerAddresses:1" })
    ).rejects.toThrow("FORBIDDEN")
  })
})

describe("importing what the browser was holding", () => {
  const local = [
    { localId: "local-a", isDefault: true, ...base },
    { localId: "local-b", ...base, street: "5 rue B" },
  ]

  it("imports every address once", async () => {
    const { ctx, docs } = makeCtx()
    const result = await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    expect(result.imported).toBe(2)
    expect(Object.values(docs)).toHaveLength(2)
  })

  it("does not duplicate on a second device", async () => {
    // The same customer signing in elsewhere replays the same local ids.
    const { ctx, docs } = makeCtx()
    await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    const second = await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    expect(second.imported).toBe(0)
    expect(Object.values(docs)).toHaveLength(2)
  })

  it("refreshes coordinates on re-import without duplicating", async () => {
    const { ctx, docs } = makeCtx()
    await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    await importFromLocal.handler(ctx, {
      userId: USER,
      addresses: [{ ...local[0]!, latitude: 48.8566, longitude: 2.3522 }],
    })
    const a = Object.values(docs).find(
      (d: any) => d.importedFromLocalId === "local-a"
    ) as any
    expect(a.latitude).toBe(48.8566)
    expect(Object.values(docs)).toHaveLength(2)
  })

  it("carries the local default over to an empty account", async () => {
    const { ctx, docs } = makeCtx()
    await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
    expect((defaults[0] as any).importedFromLocalId).toBe("local-a")
  })

  it("lets an existing server default outrank a device's opinion", async () => {
    // The address the customer chose on their account wins over whatever a
    // second browser happens to think.
    const { ctx, docs } = makeCtx([
      seedAddress({ isDefault: true, street: "server choice" }),
    ])
    await importFromLocal.handler(ctx, { userId: USER, addresses: local })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
    expect((defaults[0] as any).street).toBe("server choice")
  })

  it("never leaves an account with addresses and no default", async () => {
    const { ctx, docs } = makeCtx()
    await importFromLocal.handler(ctx, {
      userId: USER,
      // Nothing claims the default — a legitimate state in old local storage.
      addresses: [{ localId: "local-c", ...base }],
    })
    const defaults = Object.values(docs).filter((d: any) => d.isDefault)
    expect(defaults).toHaveLength(1)
  })

  it("imports nothing from an empty browser", async () => {
    const { ctx, docs } = makeCtx()
    const result = await importFromLocal.handler(ctx, { userId: USER, addresses: [] })
    expect(result.imported).toBe(0)
    expect(Object.values(docs)).toHaveLength(0)
  })
})

describe("listByUser", () => {
  it("puts the default first, then the most recent", async () => {
    const { ctx } = makeCtx([
      seedAddress({ street: "old", createdAt: 1_000 }),
      seedAddress({ street: "default", createdAt: 2_000, isDefault: true }),
      seedAddress({ street: "recent", createdAt: 3_000 }),
    ])
    const list = await listByUser.handler(ctx, { userId: USER })
    expect(list.map((a: any) => a.street)).toEqual(["default", "recent", "old"])
  })

  it("returns nothing for a customer with no addresses", async () => {
    const { ctx } = makeCtx([seedAddress({ userId: "someone_else" })])
    expect(await listByUser.handler(ctx, { userId: USER })).toEqual([])
  })
})
