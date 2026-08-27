// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Draft establishments must not be storefronts.
 *
 * `stores.create` opens every new establishment in `draft`, and `stores.list` —
 * the query behind the selector page, the header dropdown, the automatic
 * selection and the sitemap — returned it alongside the published ones. A
 * restaurant whose owner had not finished setting it up was offered to
 * visitors with an active "Commander ici" button, and could take a real order
 * into a kitchen that was not waiting for it.
 *
 * These tests run the real Convex functions against the real schema, in memory.
 * They pin both halves of the rule: what the public list must not return, and
 * what the order mutation must refuse — because a list is only a list, and a
 * stale tab or a persisted selection reaches the mutation without it.
 *
 * The mirror assertions matter as much: the admin still sees its drafts, and
 * the kitchen role still reads the list `StoreGuard` renders the KDS behind.
 */

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

type Role =
  | "super_admin"
  | "client_admin"
  | "manager"
  | "kitchen"
  | "waiter"
  | "delivery"
  | "customer"

type StoreStatus = "draft" | "open" | "closed" | "temporarily_unavailable"

const NOW = 1_700_000_000_000

function newHarness() {
  return convexTest(schema, modules)
}

async function seedStore(
  t: ReturnType<typeof convexTest>,
  name: string,
  status: StoreStatus,
  extra: Record<string, unknown> = {}
) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      address: {
        street: "1 rue de la Paix",
        city: "Paris",
        postalCode: "75002",
        country: "France",
      },
      hours: [],
      status,
      createdAt: NOW,
      updatedAt: NOW,
      ...extra,
    })
  )
}

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  role: Role,
  storeIds: Id<"stores">[]
) {
  await t.run((ctx) =>
    ctx.db.insert("userProfiles", {
      userId: subject,
      role,
      storeIds,
      permissions: [],
      language: "fr",
      twoFactorEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
  return t.withIdentity({ subject })
}

/** A sellable product in `storeId`, priced in cents. */
async function seedProduct(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  price = 1200
) {
  return t.run(async (ctx) => {
    const categoryId = await ctx.db.insert("categories", {
      storeId,
      name: "Pizzas",
      slug: "pizzas",
      sortOrder: 0,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    })
    return ctx.db.insert("products", {
      storeId,
      categoryId,
      name: "Margherita",
      slug: "margherita",
      price,
      taxRate: 10,
      images: [],
      options: [],
      allergens: [],
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: "manual",
      createdAt: NOW,
      updatedAt: NOW,
    })
  })
}

function orderArgs(storeId: Id<"stores">, productId: Id<"products">) {
  return {
    storeId,
    customerInfo: { name: "Camille", email: "camille@example.com" },
    items: [
      {
        productId,
        productName: "Margherita",
        quantity: 1,
        unitPrice: 1200,
        selectedOptions: [],
        subtotal: 1200,
      },
    ],
    type: "pickup" as const,
  }
}

// ============================================================================
// The public list
// ============================================================================

describe("stores.list", () => {
  test("omits a draft establishment", async () => {
    const t = newHarness()
    await seedStore(t, "Pizza Draft", "draft")
    await seedStore(t, "Pizza Open", "open")

    const stores = await t.query(api.stores.list, {})

    expect(stores.map((s) => s.name)).toEqual(["Pizza Open"])
  })

  test("keeps every published status", async () => {
    // `closed` and `temporarily_unavailable` are states of a published
    // restaurant — outside its hours, or paused for the evening. Hiding those
    // would be a different bug: a visitor could no longer find the place at
    // all, nor read its menu before it reopens.
    const t = newHarness()
    await seedStore(t, "Open", "open")
    await seedStore(t, "Closed", "closed")
    await seedStore(t, "Paused", "temporarily_unavailable")
    await seedStore(t, "Draft", "draft")

    const stores = await t.query(api.stores.list, {})

    expect(stores.map((s) => s.name).sort()).toEqual(["Closed", "Open", "Paused"])
  })

  test("stays readable without a session", async () => {
    // It is the storefront's list: a visitor who has never signed in has to be
    // able to choose a restaurant.
    const t = newHarness()
    await seedStore(t, "Pizza Open", "open")

    await expect(t.query(api.stores.list, {})).resolves.toHaveLength(1)
  })

  test("returns nothing at all when every establishment is a draft", async () => {
    // The storefront shows "Aucun restaurant disponible" rather than an
    // orderable half-built one. This is the case a brand-new account is in.
    const t = newHarness()
    await seedStore(t, "Pizza Draft", "draft")

    await expect(t.query(api.stores.list, {})).resolves.toEqual([])
  })
})

// ============================================================================
// The administration list
// ============================================================================

describe("stores.listAll", () => {
  test("refuses an anonymous caller", async () => {
    const t = newHarness()
    await seedStore(t, "Pizza Draft", "draft")

    await expect(t.query(api.stores.listAll, {})).rejects.toThrow(
      /Not authenticated/
    )
  })

  test("refuses a customer", async () => {
    // Signing up on the storefront must not become a way to enumerate the
    // establishments their owner has not published.
    const t = newHarness()
    await seedStore(t, "Pizza Draft", "draft")
    const asCustomer = await seedUser(t, "user:c", "customer", [])

    await expect(asCustomer.query(api.stores.listAll, {})).rejects.toThrow(
      /Access denied/
    )
  })

  test("returns the drafts to the owner who has to publish them", async () => {
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")
    await seedStore(t, "Pizza Open", "open")
    const asOwner = await seedUser(t, "user:a", "client_admin", [draft])

    const stores = await asOwner.query(api.stores.listAll, {})

    expect(stores.map((s) => s.name).sort()).toEqual(["Pizza Draft", "Pizza Open"])
  })

  test("is readable by a kitchen role", async () => {
    // The whole admin renders behind `StoreGuard`, which is built from this
    // list — the KDS included. Gating it on `stores:read`, which kitchen and
    // delivery do not hold, would lock the kitchen out of its own screen.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Open", "open")
    const asKitchen = await seedUser(t, "user:k", "kitchen", [storeId])

    await expect(asKitchen.query(api.stores.listAll, {})).resolves.toHaveLength(1)
  })

  test("does not hand out the printer API key", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Open", "open", {
      printConfig: {
        provider: "star_cloud",
        apiKey: "sk-printer-secret",
        triggers: ["confirmed"],
        paperSize: "80mm",
        enabled: true,
      },
    })
    const asKitchen = await seedUser(t, "user:k", "kitchen", [storeId])

    const [store] = await asKitchen.query(api.stores.listAll, {})

    expect(store?.printConfig).toBeDefined()
    expect(store?.printConfig).not.toHaveProperty("apiKey")
  })
})

// ============================================================================
// The order itself
// ============================================================================

describe("orders.create", () => {
  test("refuses a draft establishment", async () => {
    // The list is what stops a draft being *reached*. This is what stops one
    // being *ordered from*: a tab opened before the owner unpublished the
    // place, a store id left in localStorage, or a direct call all arrive here
    // without ever reading the list.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Draft", "draft")
    const productId = await seedProduct(t, storeId)

    await expect(
      t.mutation(api.orders.create, orderArgs(storeId, productId))
    ).rejects.toThrow(/not open for orders/)
  })

  test("writes no order and no kitchen ticket when it refuses", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Draft", "draft")
    const productId = await seedProduct(t, storeId)

    await expect(
      t.mutation(api.orders.create, orderArgs(storeId, productId))
    ).rejects.toThrow()

    const written = await t.run(async (ctx) => ({
      orders: await ctx.db.query("orders").collect(),
      tickets: await ctx.db.query("kitchenTickets").collect(),
    }))

    expect(written.orders).toEqual([])
    expect(written.tickets).toEqual([])
  })

  test("still takes an order for a published establishment", async () => {
    // The mirror of the test above: the guard must not refuse the customers it
    // exists to protect.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Open", "open")
    const productId = await seedProduct(t, storeId)

    const orderId = await t.mutation(api.orders.create, orderArgs(storeId, productId))

    const order = await t.run((ctx) => ctx.db.get(orderId as Id<"orders">))
    expect(order?.storeId).toBe(storeId)
    expect(order?.status).toBe("pending")
  })

  test("still takes an order for a closed establishment", async () => {
    // A closed restaurant is published: it takes orders for later, and the
    // storefront is what decides whether to offer that. `draft` is the only
    // status this guard is about.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Closed", "closed")
    const productId = await seedProduct(t, storeId)

    await expect(
      t.mutation(api.orders.create, orderArgs(storeId, productId))
    ).resolves.toBeDefined()
  })
})
