import { describe, it, expect, vi } from "vitest"
import { schema } from "@be-in-digital/convex-schema"
import {
  STORE_SCOPED_TABLES,
  CASCADE_BATCH_SIZE,
  deleteStoreDependents,
  detachStoreFromProfiles,
  STORE_SCOPED_TABLES_NEVER_CASCADED,
  detachStoreFromBlogAutoConfigs,
} from "../storeCascade"

/**
 * The cascade's coverage, against the schema itself (#169).
 *
 * `stores.remove` deleted the store row alone, leaving every column that points
 * at `stores` aimed at a document that no longer existed. `v.id("stores")`
 * validates how an id is encoded, not that it resolves, so nothing complained.
 *
 * A hand-written list of tables rots the moment someone adds a table. This
 * reads the schema and compares, so the next store-scoped table fails here
 * rather than leaving orphans in production.
 *
 * It used to read the schema by the field *name* `storeId`, which is not the
 * same question. Three references were invisible to it — `userProfiles.storeIds`,
 * `blogAutoConfig.targetStoreIds` and `systemAuditLog.targetStoreId` — and, more
 * to the point, so was the next column somebody would call `restaurantId` or
 * `targetStoreId`. The walk below goes by TYPE: it descends the serialised
 * validator and reports every path that reaches `v.id("stores")`, however it is
 * nested and whatever it is called.
 */

/** One path in the schema that holds a reference to `stores`. */
interface StoreReference {
  table: string
  /** Dotted path to the reference; `[]` marks an array hop. */
  path: string
}

/**
 * Every path in the schema that reaches `v.id("stores")`.
 *
 * Walks `validator.json` rather than the live validator objects: the two use
 * different keys for the same thing (`type` vs `kind`), and reading `.type` off
 * a live node silently yields `undefined` for every field — a walk that finds
 * nothing and a test that passes.
 */
function storeReferencesInSchema(): StoreReference[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tables = (schema as any).tables as Record<string, any>
  const found: StoreReference[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (node: any, table: string, path: string): void => {
    if (!node || typeof node !== "object") return

    switch (node.type) {
      case "id":
        if (node.tableName === "stores") found.push({ table, path })
        return
      case "object":
        // `value` maps a field name to `{ fieldType, optional }`.
        for (const [name, field] of Object.entries(node.value ?? {})) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          walk((field as any)?.fieldType, table, path ? `${path}.${name}` : name)
        }
        return
      case "array":
        // `value` is the element node, unwrapped.
        walk(node.value, table, `${path}[]`)
        return
      case "union":
        // `value` is an array of unwrapped member nodes.
        for (const member of node.value ?? []) walk(member, table, path)
        return
      case "record":
        // `keys` is unwrapped; `values` is wrapped like an object field.
        walk(node.keys, table, `${path}{key}`)
        walk(node.values?.fieldType, table, `${path}{}`)
        return
      default:
        return
    }
  }

  for (const [table, definition] of Object.entries(tables)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    walk((definition as any).validator?.json, table, "")
  }

  return found
}

/**
 * References that are deliberately NOT resolved by deleting the row.
 *
 * Every entry names the thing that handles it, so an id cannot be parked here
 * to quiet the test. A reference that is neither swept by `STORE_SCOPED_TABLES`
 * nor listed here fails, which is the whole point: the next `restaurantId`
 * column has to be a decision somebody made, not an omission nobody saw.
 */
const DETACHED_STORE_REFERENCES: ReadonlyArray<
  StoreReference & { handledBy: string }
> = [
  {
    table: "userProfiles",
    path: "storeIds[]",
    // Deleting the profile would delete the person. The id is taken out of the
    // list instead, or an owner loses access to the locations they still have.
    handledBy: "detachStoreFromProfiles",
  },
  {
    table: "blogAutoConfig",
    path: "targetStoreIds[]",
    // The config belongs to one establishment and fans articles out to others.
    // Its own row goes with its own store; the fan-out ids have to be detached
    // one by one, from configs that belong to establishments still standing.
    handledBy: "detachStoreFromBlogAutoConfigs",
  },
  {
    table: "systemAuditLog",
    path: "targetStoreId",
    // Dangling on purpose. The `store_deleted` entry is written by `remove`
    // itself and points at the store that was just deleted; resolving it would
    // erase the record of the deletion.
    handledBy: "nothing — the audit trail outlives its subject by design",
  },
]

describe("store references in the schema", () => {
  it("is a walk that actually finds things", () => {
    // A silent zero here would make every assertion below pass by finding
    // nothing — which is exactly how the name-matching version stayed green
    // while three references went unseen.
    const references = storeReferencesInSchema()
    expect(references.length).toBeGreaterThan(20)
    expect(references.some((r) => r.table === "products" && r.path === "storeId")).toBe(true)
  })

  it("sees references the old name filter could not", () => {
    // The regression this rewrite exists to prevent. Each of these is a
    // `v.id("stores")` that is not spelled `storeId`.
    const references = storeReferencesInSchema()
    const has = (table: string, path: string) =>
      references.some((r) => r.table === table && r.path === path)

    expect(has("userProfiles", "storeIds[]")).toBe(true)
    expect(has("blogAutoConfig", "targetStoreIds[]")).toBe(true)
    expect(has("systemAuditLog", "targetStoreId")).toBe(true)
  })

  it("resolves every reference by deleting the row or by detaching it", () => {
    const swept = new Set(STORE_SCOPED_TABLES.map((entry) => entry.table))
    const detached = new Set(
      DETACHED_STORE_REFERENCES.map((entry) => `${entry.table}.${entry.path}`)
    )

    // A third resolution, alongside deleting the row and detaching the
    // reference: keeping the row on purpose. An invoice outlives the
    // establishment that issued it — it is a fiscal archive, never deleted —
    // and `assertStoreHasNoInvoices` is what stops the establishment going
    // while one exists, so the reference cannot dangle. See
    // `STORE_SCOPED_TABLES_NEVER_CASCADED`.
    const exempt = new Set(STORE_SCOPED_TABLES_NEVER_CASCADED)

    const unhandled = storeReferencesInSchema().filter((reference) => {
      // The table's own `storeId` column: the row goes with the store.
      if (reference.path === "storeId" && swept.has(reference.table)) return false
      if (reference.path === "storeId" && exempt.has(reference.table)) return false
      return !detached.has(`${reference.table}.${reference.path}`)
    })

    expect(unhandled).toEqual([])
  })

  it("does not carry a detach entry for a reference the schema no longer has", () => {
    // The mirror of the check above: an entry left behind after a column is
    // renamed or dropped would blind the guard to whatever replaced it.
    const references = new Set(
      storeReferencesInSchema().map((r) => `${r.table}.${r.path}`)
    )
    const stale = DETACHED_STORE_REFERENCES.filter(
      (entry) => !references.has(`${entry.table}.${entry.path}`)
    )

    expect(stale).toEqual([])
  })
})

describe("STORE_SCOPED_TABLES", () => {
  it("covers every table whose own storeId column makes it store-scoped", () => {
    const owned = storeReferencesInSchema()
      .filter((reference) => reference.path === "storeId")
      .map((reference) => reference.table)
    expect(owned.length).toBeGreaterThan(20)

    // Three ways a store-scoped table can be covered: it is cascaded, its
    // reference is detached rather than deleted, or it is deliberately exempt
    // with a reason recorded beside it. A NEW one is none of the three and
    // still fails here, which is what makes this check worth having.
    const declared = new Set(STORE_SCOPED_TABLES.map((entry) => entry.table))
    const detachedTables = new Set(DETACHED_STORE_REFERENCES.map((entry) => entry.table))
    const exempt = new Set(STORE_SCOPED_TABLES_NEVER_CASCADED)
    const missing = owned.filter(
      (name) => !declared.has(name) && !detachedTables.has(name) && !exempt.has(name)
    )

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

describe("detachStoreFromBlogAutoConfigs", () => {
  it("takes the id out of every config that fans out to it", async () => {
    // The config's OWN store is swept by `by_storeId` like any other row. This
    // is the other reference: the establishments it publishes into. Left
    // behind, the next generation run writes an article against a restaurant
    // that is not there.
    const { ctx, tables } = createMockDb({
      blogAutoConfig: [
        { storeId: "s9", targetStoreIds: ["s1", "s2"] },
        { storeId: "s8", targetStoreIds: ["s1"] },
        { storeId: "s7", targetStoreIds: ["s3"] },
      ],
    })

    const touched = await detachStoreFromBlogAutoConfigs(ctx, "s1")

    expect(touched).toBe(2)
    expect(tables.blogAutoConfig[0]?.targetStoreIds).toEqual(["s2"])
    expect(tables.blogAutoConfig[1]?.targetStoreIds).toEqual([])
    expect(tables.blogAutoConfig[2]?.targetStoreIds).toEqual(["s3"])
  })

  it("does not rewrite a config that never targeted the store", async () => {
    const { ctx } = createMockDb({
      blogAutoConfig: [{ storeId: "s7", targetStoreIds: ["s3"] }],
    })

    expect(await detachStoreFromBlogAutoConfigs(ctx, "s1")).toBe(0)
    expect(ctx.db.patch).not.toHaveBeenCalled()
  })

  it("survives a config with no targetStoreIds at all", async () => {
    // The column is optional, and most configs publish only to their own
    // establishment.
    const { ctx } = createMockDb({ blogAutoConfig: [{ storeId: "s7" }] })

    await expect(detachStoreFromBlogAutoConfigs(ctx, "s1")).resolves.toBe(0)
  })
})
