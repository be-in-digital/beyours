import { describe, it, expect, vi } from "vitest"
import { schema } from "@be-in-digital/convex-schema"
import {
  STORE_SCOPED_TABLES,
  CASCADE_BATCH_SIZE,
  deleteStoreDependents,
  detachStoreFromProfiles,
  STORE_SCOPED_TABLES_NEVER_CASCADED,
} from "../storeCascade"

/**
 * The cascade's table list, against the schema itself (#169).
 *
 * `stores.remove` deleted the store row alone, leaving forty-two `storeId`
 * columns pointing at a document that no longer existed. `v.id("stores")`
 * validates how an id is encoded, not that it resolves, so nothing complained.
 *
 * A hand-written list of tables rots the moment someone adds a table. This
 * reads the schema and compares, so the next store-scoped table fails here
 * rather than leaving orphans in production.
 */

/**
 * Every table in the schema that carries a `storeId` column.
 *
 * Read off the validator rather than listed here, so the check cannot agree
 * with itself. Forty-two tables at the time of writing, `teamMembers`'
 * optional column included.
 */
function storeScopedTablesInSchema(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables = (schema as any).tables as Record<string, any>
  return Object.entries(tables)
    .filter(([, table]) => {
      const storeId = table.validator?.fields?.storeId
      // `v.id("stores")`, optional or not — the target table name is in the
      // serialised form either way.
      return !!storeId && JSON.stringify(storeId.json ?? {}).includes("stores")
    })
    .map(([name]) => name)
}

describe("STORE_SCOPED_TABLES", () => {
  it("covers every table in the schema that carries a storeId", () => {
    const inSchema = storeScopedTablesInSchema()
    // A silent zero here would make this test pass by finding nothing.
    expect(inSchema.length).toBeGreaterThan(20)

    // A table is covered either by being cascaded or by being deliberately
    // exempted with a reason. A NEW store-scoped table appears in neither and
    // still fails here, which is what makes this check worth having.
    const declared = new Set([
      ...STORE_SCOPED_TABLES.map((entry) => entry.table),
      ...STORE_SCOPED_TABLES_NEVER_CASCADED,
    ])
    const missing = inSchema.filter((name) => !declared.has(name))

    expect(missing).toEqual([])
  })

  it("keeps invoices out of the cascade, on purpose", () => {
    // An invoice is a fiscal archive: never edited, never deleted. Deleting one
    // would put a hole in a series the law requires to be unbroken.
    expect(STORE_SCOPED_TABLES_NEVER_CASCADED).toContain("invoices")
    expect(STORE_SCOPED_TABLES.map((e) => e.table)).not.toContain("invoices")
  })

  it("names only tables that exist", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tables = Object.keys((schema as any).tables)
    const unknown = STORE_SCOPED_TABLES.filter((entry) => !tables.includes(entry.table))

    expect(unknown).toEqual([])
  })

  it("sweeps each table through an index that starts with storeId", () => {
    // A full scan of `orders` to delete one establishment's is the difference
    // between a cascade and an outage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tables = (schema as any).tables as Record<string, any>

    for (const { table, index } of STORE_SCOPED_TABLES) {
      const indexes = tables[table]?.indexes ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = indexes.find((i: any) => i.indexDescriptor === index)
      expect(found, `${table} has no index ${index}`).toBeDefined()
      expect(found.fields[0], `${index} on ${table} must start with storeId`).toBe(
        "storeId"
      )
    }
  })

  it("lists each table once", () => {
    const names = STORE_SCOPED_TABLES.map((entry) => entry.table)
    expect(new Set(names).size).toBe(names.length)
  })
})

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/**
 * A database of `{ table: rows[] }` that honours `withIndex(...).take(n)` the
 * way Convex does — the equalities the index constrains, and the limit.
 */
function createMockDb(seed: Record<string, Array<Record<string, unknown>>>) {
  const tables: Record<string, Array<Record<string, unknown>>> = {}
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = rows.map((row, i) => ({ _id: `${name}:${i}`, ...row }))
  }

  const db = {
    query: (table: string) => {
      const rows = tables[table] ?? []
      return {
        withIndex: (_index: string, constrain?: (q: unknown) => unknown) => {
          const equalities: Record<string, unknown> = {}
          const q = {
            eq: (field: string, value: unknown) => {
              equalities[field] = value
              return q
            },
          }
          constrain?.(q)
          const matched = rows.filter((row) =>
            Object.entries(equalities).every(([field, value]) => row[field] === value)
          )
          return {
            take: async (limit: number) => matched.slice(0, limit),
            collect: async () => matched,
          }
        },
        collect: async () => rows,
      }
    },
    delete: vi.fn(async (id: string) => {
      const table = id.split(":")[0] as string
      tables[table] = (tables[table] ?? []).filter((row) => row._id !== id)
    }),
    patch: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const table = id.split(":")[0] as string
      const row = (tables[table] ?? []).find((r) => r._id === id)
      if (row) Object.assign(row, updates)
    }),
  }

  return { ctx: { db }, tables }
}

describe("deleteStoreDependents", () => {
  it("deletes the establishment's rows across every table", async () => {
    const { ctx, tables } = createMockDb({
      products: [{ storeId: "s1" }, { storeId: "s1" }],
      orders: [{ storeId: "s1" }],
      cmsPages: [{ storeId: "s1" }],
      emailSubscribers: [{ storeId: "s1" }],
    })

    const result = await deleteStoreDependents(ctx, "s1")

    expect(result).toEqual({ deleted: 5, hasMore: false })
    expect(tables.products).toEqual([])
    expect(tables.orders).toEqual([])
    expect(tables.cmsPages).toEqual([])
    expect(tables.emailSubscribers).toEqual([])
  })

  it("leaves another establishment's rows alone", async () => {
    // The bug this whole change exists for is data outliving its store. The
    // opposite mistake — taking the neighbour's data with it — is worse.
    const { ctx, tables } = createMockDb({
      products: [{ storeId: "s1" }, { storeId: "s2" }],
      orders: [{ storeId: "s2" }],
    })

    await deleteStoreDependents(ctx, "s1")

    expect(tables.products).toHaveLength(1)
    expect(tables.products[0]?.storeId).toBe("s2")
    expect(tables.orders).toHaveLength(1)
  })

  it("stops at the budget and says there is more", async () => {
    // One mutation is one transaction. An established restaurant has more
    // orders than a transaction may touch, so the sweep has to be resumable.
    const { ctx, tables } = createMockDb({
      products: Array.from({ length: 5 }, () => ({ storeId: "s1" })),
    })

    const result = await deleteStoreDependents(ctx, "s1", 3)

    expect(result).toEqual({ deleted: 3, hasMore: true })
    expect(tables.products).toHaveLength(2)
  })

  it("finishes the job when run again", async () => {
    const { ctx, tables } = createMockDb({
      products: Array.from({ length: 5 }, () => ({ storeId: "s1" })),
      orders: [{ storeId: "s1" }],
    })

    let passes = 0
    let hasMore = true
    while (hasMore) {
      hasMore = (await deleteStoreDependents(ctx, "s1", 2)).hasMore
      passes++
      expect(passes).toBeLessThan(10) // a loop that does not converge is a bug
    }

    expect(tables.products).toEqual([])
    expect(tables.orders).toEqual([])
  })

  it("reports nothing to do for an establishment with no data", async () => {
    const { ctx } = createMockDb({ products: [] })

    expect(await deleteStoreDependents(ctx, "s1")).toEqual({
      deleted: 0,
      hasMore: false,
    })
  })

  it("uses a batch that fits in one transaction", () => {
    // Convex bounds what one mutation may read and write. This is the number
    // the scheduler loop is built around; raising it past the limit turns a
    // slow delete into a failing one.
    expect(CASCADE_BATCH_SIZE).toBeGreaterThan(0)
    expect(CASCADE_BATCH_SIZE).toBeLessThanOrEqual(1000)
  })
})

describe("detachStoreFromProfiles", () => {
  it("takes the id out of every profile that lists it", async () => {
    // Left behind, it makes `storeIds` point at nothing, and the store-scoped
    // seam matches membership against ids that no longer resolve — which is
    // how an owner loses access to the locations they still have.
    const { ctx, tables } = createMockDb({
      userProfiles: [
        { userId: "marie", storeIds: ["s1", "s2"] },
        { userId: "luc", storeIds: ["s1"] },
        { userId: "ana", storeIds: ["s3"] },
      ],
    })

    const touched = await detachStoreFromProfiles(ctx, "s1")

    expect(touched).toBe(2)
    expect(tables.userProfiles[0]?.storeIds).toEqual(["s2"])
    expect(tables.userProfiles[1]?.storeIds).toEqual([])
    expect(tables.userProfiles[2]?.storeIds).toEqual(["s3"])
  })

  it("does not rewrite a profile that never held the store", async () => {
    const { ctx } = createMockDb({
      userProfiles: [{ userId: "ana", storeIds: ["s3"] }],
    })

    expect(await detachStoreFromProfiles(ctx, "s1")).toBe(0)
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("survives a profile with no storeIds at all", async () => {
    const { ctx } = createMockDb({ userProfiles: [{ userId: "ana" }] })

    await expect(detachStoreFromProfiles(ctx, "s1")).resolves.toBe(0)
  })
})
