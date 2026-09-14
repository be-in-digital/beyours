import { describe, expect, it } from "vitest"

import { ignore, listPending, match } from "../orphanProducts"

/**
 * The imported items that matched nothing in the catalogue (#274).
 *
 * WHY THESE HANDLERS WERE NEVER TESTED. Only `match` had a Convex wrapper, and
 * nothing called it — no screen listed the rows, so no test had anything to
 * assert against. The rows piled up on every platform import and the owner had
 * no way to see one.
 *
 * What is worth pinning is what a reader cannot check by looking: the seek in
 * `listPending` uses BOTH halves of its index, so another establishment's
 * unmatched dish never appears on this one's screen; and `match` refuses a
 * product from another store, which is the difference between an Uber Eats
 * order arriving priced and arriving priced from somebody else's menu.
 */

const NOW = 1_700_000_000_000

type Row = Record<string, unknown>

/**
 * A `ctx.db` over plain rows.
 *
 * `withIndex` records the seek the handler builds and filters on it, rather
 * than returning every row — a handler that forgot `status` would otherwise
 * pass by returning the whole table.
 */
function dbWith(rows: Row[]) {
  const patched: Array<{ id: unknown; fields: Row }> = []
  return {
    patched,
    ctx: {
      db: {
        query: (table: string) => ({
          withIndex: (_name: string, build: (q: unknown) => unknown) => {
            const seek: Record<string, unknown> = {}
            const q = {
              eq: (field: string, value: unknown) => {
                seek[field] = value
                return q
              },
            }
            build(q as never)
            return {
              collect: async () =>
                rows.filter(
                  (row) =>
                    row.__table === table &&
                    Object.entries(seek).every(([field, value]) => row[field] === value)
                ),
            }
          },
        }),
        get: async (id: unknown) => rows.find((row) => row._id === id) ?? null,
        patch: async (id: unknown, fields: Row) => {
          patched.push({ id, fields })
          const row = rows.find((candidate) => candidate._id === id)
          if (row) Object.assign(row, fields)
        },
      },
    },
  }
}

function orphan(over: Row = {}): Row {
  return {
    __table: "orphanProducts",
    _id: "orphan_1",
    storeId: "store_a",
    platform: "uberEats",
    externalId: "ue-991",
    name: "Pizza Reine",
    price: 1_250,
    rawData: "{}",
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

function product(over: Row = {}): Row {
  return {
    __table: "products",
    _id: "product_1",
    storeId: "store_a",
    name: "Pizza Reine",
    ...over,
  }
}

describe("listing what an import could not place", () => {
  it("returns this establishment's pending rows, and nothing else", async () => {
    const { ctx } = dbWith([
      orphan({ _id: "mine_pending" }),
      orphan({ _id: "mine_ignored", status: "ignored" }),
      orphan({ _id: "mine_matched", status: "matched" }),
      orphan({ _id: "theirs_pending", storeId: "store_b" }),
    ])

    const found = await listPending.handler(ctx, { storeId: "store_a" })

    expect(found.map((row: Row) => row._id)).toEqual(["mine_pending"])
  })

  it("has something to find, so an empty answer means empty and not broken", async () => {
    // Anti-vacuity: the filter above would also pass on a seek that matched
    // nothing at all.
    const { ctx } = dbWith([orphan({ _id: "a" }), orphan({ _id: "b" })])

    const found = await listPending.handler(ctx, { storeId: "store_a" })

    expect(found).toHaveLength(2)
  })
})

describe("setting an unmatched item aside", () => {
  it("drops it from the screen without deleting it", async () => {
    const rows = [orphan({ _id: "combo" })]
    const { ctx } = dbWith(rows)

    await ignore.handler(ctx, { id: "combo" })

    // The row survives — the next import must not present it again as new.
    expect(rows[0].status).toBe("ignored")
    expect(await listPending.handler(ctx, { storeId: "store_a" })).toEqual([])
  })
})

describe("matching an imported item to a dish on the menu", () => {
  it("records the product it was matched to", async () => {
    const rows = [orphan(), product()]
    const { ctx } = dbWith(rows)

    await match.handler(ctx, { id: "orphan_1", matchedProductId: "product_1" })

    expect(rows[0].status).toBe("matched")
    expect(rows[0].matchedProductId).toBe("product_1")
  })

  it("refuses a product belonging to another establishment", async () => {
    // The wrapper's guard scopes to the orphan's store; the product id arrives
    // from the browser and is scoped by nothing else.
    const rows = [orphan(), product({ _id: "product_elsewhere", storeId: "store_b" })]
    const { ctx } = dbWith(rows)

    await expect(
      match.handler(ctx, { id: "orphan_1", matchedProductId: "product_elsewhere" })
    ).rejects.toThrow("Product belongs to another store")

    expect(rows[0].status).toBe("pending")
  })

  it("refuses a product that does not exist", async () => {
    const rows = [orphan()]
    const { ctx } = dbWith(rows)

    await expect(
      match.handler(ctx, { id: "orphan_1", matchedProductId: "product_gone" })
    ).rejects.toThrow("Product not found")
  })
})
