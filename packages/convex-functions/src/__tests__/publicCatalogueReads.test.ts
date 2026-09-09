import { describe, it, expect } from "vitest"
import { getManyByIds, MAX_PRODUCT_ID_LOOKUP } from "../products"

/**
 * What an anonymous caller gets back from the catalogue's batch read.
 *
 * `products.getManyByIds` is a public query — the favourites grid calls it
 * before any sign-in — and it took an array of ids and returned the documents
 * behind them with no filter of any kind. `isActive: false` is the owner saying
 * a dish is not on sale, and it is the same flag a draft, a discontinued item
 * and an out-of-season one all carry, so the query served every one of them:
 * name, description, price, cost, allergens, platform overrides. Every other
 * public read of this table already honours the flag; this one was the hole.
 *
 * Ids are not a secret. They appear in order lines, in the favourites a diner
 * stores, and in the storefront's own DOM — so "you would have to know the id"
 * is not a control, and the filter belongs in the query rather than in a caller.
 *
 * The cross-store answer is deliberate and is pinned here so nobody closes it
 * by mistake: a deployment is one client's, and the favourites grid asks across
 * the chain on purpose so it can split "here" from "your other establishments".
 */

type Product = {
  _id: string
  storeId: string
  name: string
  isActive: boolean
}

const product = (over: Partial<Product> & { _id: string }): Product => ({
  storeId: "store_a",
  name: `Product ${over._id}`,
  isActive: true,
  ...over,
})

/** A `ctx` with just the one method the handler touches. */
function ctxWith(rows: Product[]) {
  const reads: string[] = []
  const byId = new Map(rows.map((r) => [r._id, r]))
  return {
    reads,
    ctx: {
      db: {
        get: async (id: string) => {
          reads.push(id)
          return byId.get(id) ?? null
        },
      },
    },
  }
}

describe("products.getManyByIds", () => {
  it("does not serve an unpublished product to an anonymous caller", async () => {
    const { ctx } = ctxWith([
      product({ _id: "p_live" }),
      product({ _id: "p_draft", isActive: false }),
    ])

    const found = await getManyByIds.handler(ctx, { ids: ["p_live", "p_draft"] })

    expect(found.map((p: Product) => p._id)).toEqual(["p_live"])
  })

  it("does not serve another establishment's unpublished product either", async () => {
    // The shape actually reported: the id belongs to a sibling store, so the
    // caller is not even looking at the establishment they are standing in.
    const { ctx } = ctxWith([
      product({ _id: "p_other_draft", storeId: "store_b", isActive: false }),
    ])

    expect(await getManyByIds.handler(ctx, { ids: ["p_other_draft"] })).toEqual([])
  })

  it("still answers across the chain for a published product", async () => {
    // The favourites grid splits the answer into this store and the owner's
    // others. Scoping the query to one store would take that away.
    const { ctx } = ctxWith([
      product({ _id: "p_here", storeId: "store_a" }),
      product({ _id: "p_there", storeId: "store_b" }),
    ])

    const found = await getManyByIds.handler(ctx, { ids: ["p_here", "p_there"] })

    expect(found.map((p: Product) => p.storeId)).toEqual(["store_a", "store_b"])
  })

  it("drops an id that resolves to nothing rather than returning a null", async () => {
    const { ctx } = ctxWith([product({ _id: "p_live" })])

    expect(
      await getManyByIds.handler(ctx, { ids: ["p_live", "p_deleted"] })
    ).toHaveLength(1)
  })

  it("reads no more documents than the ceiling, whatever the caller sends", async () => {
    // A public endpoint's read count must not be the caller's to choose: past
    // Convex's 16,384-document limit the transaction fails outright.
    const ids = Array.from({ length: MAX_PRODUCT_ID_LOOKUP + 50 }, (_, i) => `p_${i}`)
    const { ctx, reads } = ctxWith(ids.map((id) => product({ _id: id })))

    const found = await getManyByIds.handler(ctx, { ids })

    expect(reads).toHaveLength(MAX_PRODUCT_ID_LOOKUP)
    expect(found).toHaveLength(MAX_PRODUCT_ID_LOOKUP)
  })
})
