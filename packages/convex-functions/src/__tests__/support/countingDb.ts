/**
 * A `ctx.db` double that counts the documents a handler reads.
 *
 * WHY THIS EXISTS. Convex refuses a transaction that reads more than 16,384
 * documents, so "does this query work" and "does this query still work at
 * 5,000 orders" are different questions, and only the second one is the defect
 * the admin screens died of. A test that asserts a query returns the right
 * answer cannot see an unbounded `.collect()` at all — the answer is right,
 * once, on a fixture of ten rows.
 *
 * So this double reports one number: how many documents the handler made the
 * database materialise. A permanent test then grows the table and asserts the
 * number does not follow it. That is the only assertion that fails when
 * somebody puts the `.collect()` back.
 *
 * It is also index-faithful, deliberately. The hand-rolled doubles elsewhere in
 * this suite accept `withIndex("by_anything")` and silently apply the equality
 * filters, which means a query can name an index that does not exist and pass.
 * This one reads the real declared indexes out of `@be-in-digital/convex-schema`
 * and enforces Convex's own rule: equalities must cover a prefix of the index
 * fields, in order, and a range bound may only be placed on the field directly
 * after that prefix. Fixing a query by filtering in JavaScript on a field the
 * index does not carry therefore fails here, which is the mistake that produced
 * three of the five defects this file was written for.
 */

import * as schemaTables from "@be-in-digital/convex-schema/tables"

/** Any document, as the double stores it. */
export interface MockDoc {
  _id: string
  _creationTime?: number
  [key: string]: unknown
}

interface IndexDefinition {
  indexDescriptor: string
  fields: string[]
}

/** table name -> its declared indexes, read from the real schema package. */
const DECLARED_INDEXES: Record<string, IndexDefinition[]> = (() => {
  const map: Record<string, IndexDefinition[]> = {}
  for (const [exportName, value] of Object.entries(schemaTables)) {
    if (!exportName.endsWith("Table")) continue
    const indexes = (value as { indexes?: IndexDefinition[] } | undefined)?.indexes
    if (!Array.isArray(indexes)) continue
    map[exportName.slice(0, -"Table".length)] = indexes
  }
  return map
})()

type Comparator = "eq" | "gt" | "gte" | "lt" | "lte"

interface Bound {
  op: Comparator
  field: string
  value: unknown
}

/** Convex's index ordering: undefined sorts before everything, then by value. */
function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined) return -1
  if (b === undefined) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a) < String(b) ? -1 : 1
}

function satisfies(doc: MockDoc, bound: Bound): boolean {
  const cmp = compareValues(doc[bound.field], bound.value)
  switch (bound.op) {
    case "eq":
      return doc[bound.field] === bound.value
    case "gt":
      return cmp > 0
    case "gte":
      return cmp >= 0
    case "lt":
      return cmp < 0
    case "lte":
      return cmp <= 0
  }
}

/**
 * Convex's rule, enforced rather than assumed: equalities cover a prefix of the
 * index fields in declaration order, and at most one field after that prefix
 * may carry range bounds.
 */
function assertBoundsFitIndex(
  table: string,
  index: IndexDefinition,
  bounds: Bound[]
): void {
  const equalities = bounds.filter((b) => b.op === "eq")
  const ranges = bounds.filter((b) => b.op !== "eq")

  equalities.forEach((bound, position) => {
    const expected = index.fields[position]
    if (bound.field !== expected) {
      throw new Error(
        `${table}.${index.indexDescriptor}: eq("${bound.field}") is not index field ` +
          `#${position} ("${expected ?? "<past the end of the index>"}"). ` +
          `Equalities must cover a prefix of [${index.fields.join(", ")}].`
      )
    }
  })

  const rangeField = index.fields[equalities.length]
  for (const bound of ranges) {
    if (bound.field !== rangeField) {
      throw new Error(
        `${table}.${index.indexDescriptor}: ${bound.op}("${bound.field}") may only be ` +
          `placed on "${rangeField ?? "<past the end of the index>"}", the field after the ` +
          `equality prefix of [${index.fields.join(", ")}].`
      )
    }
  }
}

export interface CountingCtx {
  // The handlers under test are typed against Convex's own ctx; the double
  // implements only the surface they touch.
  db: any
  /** Documents the handlers have made the database materialise so far. */
  reads(): number
  resetReads(): void
  store: Record<string, MockDoc[]>
}

/**
 * Build a `ctx` whose `db` counts reads and validates index usage.
 *
 * @param tables Seed rows per table. Documents are given a `_creationTime` from
 *   their position unless they carry one, so index order is deterministic.
 */
export function createCountingDb(
  tables: Record<string, Array<Record<string, unknown>>> = {}
): CountingCtx {
  let reads = 0
  let inserted = 0

  const store: Record<string, MockDoc[]> = {}
  for (const [name, docs] of Object.entries(tables)) {
    store[name] = docs.map((doc, position) => ({
      _creationTime: position,
      ...doc,
    })) as MockDoc[]
    inserted = Math.max(inserted, store[name].length)
  }

  const findById = (id: string): MockDoc | null => {
    for (const docs of Object.values(store)) {
      const found = docs.find((d) => d._id === id)
      if (found) return found
    }
    return null
  }

  const indexesFor = (table: string): IndexDefinition[] => {
    const indexes = DECLARED_INDEXES[table]
    if (!indexes) {
      throw new Error(
        `countingDb: table "${table}" is not declared in @be-in-digital/convex-schema/tables`
      )
    }
    return indexes
  }

  function query(table: string) {
    // A query on a table the schema does not declare is always a bug, index or
    // no index — so it is refused here rather than at `withIndex`.
    indexesFor(table)
    let docs = [...(store[table] ?? [])]
    let sortFields: string[] = []
    let descending = false

    const chain = {
      withIndex: (
        indexName: string,
        rangeFn?: (q: Record<Comparator, (f: string, v: unknown) => unknown>) => unknown
      ) => {
        const index = indexesFor(table).find((i) => i.indexDescriptor === indexName)
        if (!index) {
          throw new Error(
            `countingDb: table "${table}" has no index "${indexName}". ` +
              `Declared: ${indexesFor(table)
                .map((i) => i.indexDescriptor)
                .join(", ")}`
          )
        }
        sortFields = index.fields

        if (rangeFn) {
          const bounds: Bound[] = []
          const recorder = {} as Record<Comparator, (f: string, v: unknown) => unknown>
          for (const op of ["eq", "gt", "gte", "lt", "lte"] as Comparator[]) {
            recorder[op] = (field: string, value: unknown) => {
              bounds.push({ op, field, value })
              return recorder
            }
          }
          rangeFn(recorder)
          assertBoundsFitIndex(table, index, bounds)
          docs = docs.filter((doc) => bounds.every((bound) => satisfies(doc, bound)))
        }
        return chain
      },

      order: (direction: "asc" | "desc") => {
        descending = direction === "desc"
        return chain
      },

      /** Post-index predicate. Convex still reads every row it scans. */
      filter: (predicate: (doc: MockDoc) => boolean) => {
        docs = docs.filter(predicate)
        return chain
      },

      collect: async () => {
        const rows = materialise()
        reads += rows.length
        return rows
      },

      take: async (n: number) => {
        const rows = materialise().slice(0, n)
        reads += rows.length
        return rows
      },

      first: async () => {
        const rows = materialise().slice(0, 1)
        reads += rows.length
        return rows[0] ?? null
      },

      unique: async () => {
        const rows = materialise().slice(0, 2)
        reads += rows.length
        if (rows.length > 1) throw new Error("countingDb: unique() matched more than one document")
        return rows[0] ?? null
      },

      paginate: async (opts: { numItems: number; cursor: string | null }) => {
        const rows = materialise()
        const start = opts.cursor ? Number(opts.cursor) : 0
        const page = rows.slice(start, start + opts.numItems)
        reads += page.length
        const end = start + page.length
        return {
          page,
          isDone: end >= rows.length,
          continueCursor: String(end),
        }
      },
    }

    function materialise(): MockDoc[] {
      const ordered = [...docs].sort((a, b) => {
        for (const field of [...sortFields, "_creationTime"]) {
          const cmp = compareValues(a[field], b[field])
          if (cmp !== 0) return cmp
        }
        return 0
      })
      return descending ? ordered.reverse() : ordered
    }

    return chain
  }

  const db = {
    get: async (id: string) => {
      reads += 1
      return findById(id)
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      const id = `${table}:${++inserted}`
      store[table] = store[table] ?? []
      store[table].push({ _id: id, _creationTime: inserted, ...doc })
      return id
    },
    patch: async (id: string, updates: Record<string, unknown>) => {
      const doc = findById(id)
      if (doc) Object.assign(doc, updates)
    },
    replace: async (id: string, doc: Record<string, unknown>) => {
      const existing = findById(id)
      if (existing) {
        for (const key of Object.keys(existing)) {
          if (key !== "_id" && key !== "_creationTime") delete existing[key]
        }
        Object.assign(existing, doc)
      }
    },
    delete: async (id: string) => {
      for (const [name, docs] of Object.entries(store)) {
        store[name] = docs.filter((d) => d._id !== id)
      }
    },
    query,
  }

  return {
    db,
    reads: () => reads,
    resetReads: () => {
      reads = 0
    },
    store,
  }
}
