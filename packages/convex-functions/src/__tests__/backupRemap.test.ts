import { describe, it, expect } from "vitest"
import { remapIds, splitExportedRow, type IdMap } from "../backupRemap"

/**
 * Rewriting the foreign keys of a restored backup (#224).
 *
 * `importTable` deletes a table and re-inserts its rows without their `_id` —
 * Convex will not let an insert choose one. So `stores` came back under new ids
 * while the products, menus and CMS pages restored after them came back
 * carrying the old `storeId`, and `v.id("stores")` waved it through: it
 * validates how an id is encoded, not that it resolves. The deployment came up
 * with every catalogue detached from its establishment, silently and
 * irreversibly.
 */

const MAP: IdMap = {
  "stores:old1": "stores:new1",
  "stores:old2": "stores:new2",
  "products:old1": "products:new1",
}

describe("remapIds", () => {
  it("rewrites a foreign key", () => {
    expect(remapIds({ storeId: "stores:old1", name: "Margherita" }, MAP)).toEqual({
      storeId: "stores:new1",
      name: "Margherita",
    })
  })

  it("leaves an id the map does not know", () => {
    // A reference to something the backup did not contain. Nothing can be done
    // about it here, and inventing a target would be worse than keeping it.
    expect(remapIds({ storeId: "stores:unknown" }, MAP)).toEqual({
      storeId: "stores:unknown",
    })
  })

  it("reaches into arrays", () => {
    // `promotions.targetProductIds` and friends.
    expect(remapIds({ targetProductIds: ["products:old1", "products:x"] }, MAP)).toEqual(
      { targetProductIds: ["products:new1", "products:x"] }
    )
  })

  it("reaches into nested objects", () => {
    // A CMS block's content embeds ids several levels down.
    expect(
      remapIds(
        { content: { blocks: [{ productId: "products:old1", label: "Plat" }] } },
        MAP
      )
    ).toEqual({ content: { blocks: [{ productId: "products:new1", label: "Plat" }] } })
  })

  it("leaves everything that is not an id alone", () => {
    const row = {
      name: "Pizzeria",
      price: 1200,
      isActive: true,
      tags: ["pizza", "italien"],
      description: undefined,
      deletedAt: null,
    }
    expect(remapIds(row, MAP)).toEqual(row)
  })

  it("does not mutate the row it was given", () => {
    // The caller counts the dangling references in the *original* rows after
    // the insert; rewriting in place would make that count nothing.
    const row = { storeId: "stores:old1" }
    remapIds(row, MAP)
    expect(row.storeId).toBe("stores:old1")
  })

  it("is a no-op with an empty map", () => {
    // The first table of a restore has nothing to rewrite against.
    expect(remapIds({ storeId: "stores:old1" }, {})).toEqual({
      storeId: "stores:old1",
    })
  })
})

describe("splitExportedRow", () => {
  it("separates the old id from what gets inserted", () => {
    const { oldId, data } = splitExportedRow({
      _id: "stores:old1",
      _creationTime: 1,
      name: "Pizzeria",
    })
    expect(oldId).toBe("stores:old1")
    expect(data).toEqual({ name: "Pizzeria" })
  })

  it("keeps the system fields out of the insert", () => {
    // `_creationTime` is not writable, and `_id` is chosen by Convex.
    const { data } = splitExportedRow({ _id: "a", _creationTime: 1, name: "x" })
    expect(data).not.toHaveProperty("_id")
    expect(data).not.toHaveProperty("_creationTime")
  })

  it("survives a row with no id at all", () => {
    // A hand-edited backup file. It should insert, just not join the map.
    expect(splitExportedRow({ name: "x" })).toEqual({
      oldId: undefined,
      data: { name: "x" },
    })
  })
})
