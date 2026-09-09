// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * A dish the owner has not put on sale must not reach a diner.
 *
 * `isActive: false` is how a draft, a discontinued item and a seasonal one out
 * of season all look. The three public catalogue reads returned all of them:
 *
 *     products.list   => [{"name":"LIVE"},{"name":"SECRET-DRAFT","isActive":false}]
 *     products.getById(draftId) => {"name":"SECRET-DRAFT","price":9999}
 *
 * #440 closed the same hole in `getManyByIds`, and its commit body said the fix
 * made that query behave "like every other public read of that table". Measured
 * afterwards, the other public reads did not filter — which is the reason these
 * tests exist as behaviour rather than as a claim in a commit message.
 *
 * The consequence was not only disclosure. `list` is what the public carte, the
 * sitemap and the JSON-LD all call, and `orderLine.ts` refuses an inactive
 * product at order creation — so a draft rendered live at full price, got
 * indexed, and the diner who added it was refused at payment.
 *
 * These run the real queries against the real schema, unauthenticated, which is
 * how the storefront calls them.
 */

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

const NOW = 1_700_000_000_000

const harnesses: ReturnType<typeof convexTest>[] = []

function newHarness() {
  const t = convexTest(schema, modules)
  harnesses.push(t)
  return t
}

// Catalogue writes queue a menu sync at a 5s delay; left pending they surface
// as unhandled rejections that redden an unrelated file. Same cleanup as
// catalogue-scope.test.ts, which documents the reasoning at length.
afterEach(async () => {
  for (const t of harnesses) {
    await t.finishInProgressScheduledFunctions()
    await t.run(async (ctx) => {
      const pending = await ctx.db.system.query("_scheduled_functions").collect()
      for (const job of pending) {
        if (job.state.kind === "pending" || job.state.kind === "inProgress") {
          await ctx.scheduler.cancel(job._id)
        }
      }
    })
  }
  harnesses.length = 0
})

async function seedStore(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name: "Chez Luigi",
      slug: "chez-luigi",
      address: { street: "1 rue de la Paix", city: "Paris", postalCode: "75002", country: "France" },
      hours: [],
      status: "open" as const,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  )
}

async function seedCategory(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  name: string,
  isActive: boolean,
) {
  return t.run((ctx) =>
    ctx.db.insert("categories", {
      storeId,
      name,
      slug: name.toLowerCase(),
      sortOrder: 0,
      isActive,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  )
}

async function seedProduct(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  categoryId: Id<"categories">,
  name: string,
  isActive: boolean,
) {
  return t.run((ctx) =>
    ctx.db.insert("products", {
      storeId,
      categoryId,
      name,
      slug: name.toLowerCase(),
      price: isActive ? 1200 : 9999,
      taxRate: 10,
      images: [],
      options: [],
      allergens: [],
      tags: [],
      isActive,
      isFeatured: false,
      sortOrder: 0,
      source: "manual" as const,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  )
}

async function seedMenu(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  name: string,
  isActive: boolean,
) {
  return t.run((ctx) =>
    ctx.db.insert("menus", {
      storeId,
      name,
      price: 2500,
      sections: [],
      isActive,
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  )
}

describe("the public carte", () => {
  test("products.list serves what is on sale and nothing else", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    const categoryId = await seedCategory(t, storeId, "Pizzas", true)
    await seedProduct(t, storeId, categoryId, "LIVE", true)
    await seedProduct(t, storeId, categoryId, "SECRET-DRAFT", false)

    // Unauthenticated, exactly as the storefront calls it.
    const listed = await t.query(api.products.list, { storeId })

    expect(listed.map((p) => p.name)).toEqual(["LIVE"])
    expect(listed.some((p) => p.isActive === false)).toBe(false)
  })

  test("products.getById refuses a draft even to someone holding its id", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    const categoryId = await seedCategory(t, storeId, "Pizzas", true)
    const liveId = await seedProduct(t, storeId, categoryId, "LIVE", true)
    const draftId = await seedProduct(t, storeId, categoryId, "SECRET-DRAFT", false)

    // Ids are not secret: they appear in order lines, in favourites and in the
    // DOM. So the filter has to be here, not in the caller.
    expect(await t.query(api.products.getById, { id: draftId })).toBeNull()
    expect(await t.query(api.products.getById, { id: liveId })).not.toBeNull()
  })

  test("categories.list hides a switched-off category", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    await seedCategory(t, storeId, "Pizzas", true)
    await seedCategory(t, storeId, "Hiver", false)

    const listed = await t.query(api.categories.list, { storeId })
    expect(listed.map((c) => c.name)).toEqual(["Pizzas"])
  })

  test("menus.list hides a switched-off menu", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    await seedMenu(t, storeId, "Midi", true)
    await seedMenu(t, storeId, "Menu de Noël", false)

    const listed = await t.query(api.menus.list, { storeId })
    expect(listed.map((m) => m.name)).toEqual(["Midi"])
  })
})

describe("the admin catalogue", () => {
  test("products.listAll is refused to an anonymous caller", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)

    // The drafts did not become unreachable — they became authorised. If this
    // ever resolves, the leak has simply moved to a new name.
    await expect(t.query(api.products.listAll, { storeId })).rejects.toThrow()
  })

  test("products.listAll is refused to a signed-in diner", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    await t.run((ctx) =>
      ctx.db.insert("userProfiles", {
        userId: "diner",
        role: "customer" as const,
        storeIds: [],
        permissions: [],
        language: "fr",
        twoFactorEnabled: false,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    )

    await expect(
      t.withIdentity({ subject: "diner" }).query(api.products.listAll, { storeId }),
    ).rejects.toThrow()
  })

  test("products.listAll shows the drafts to the catalogue manager", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    const categoryId = await seedCategory(t, storeId, "Pizzas", true)
    await seedProduct(t, storeId, categoryId, "LIVE", true)
    await seedProduct(t, storeId, categoryId, "SECRET-DRAFT", false)

    await t.run((ctx) =>
      ctx.db.insert("userProfiles", {
        userId: "patron",
        role: "client_admin" as const,
        storeIds: [storeId],
        permissions: [],
        language: "fr",
        twoFactorEnabled: false,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    )

    const listed = await t
      .withIdentity({ subject: "patron" })
      .query(api.products.listAll, { storeId })

    expect(listed.map((p) => p.name).sort()).toEqual(["LIVE", "SECRET-DRAFT"])
  })
})
