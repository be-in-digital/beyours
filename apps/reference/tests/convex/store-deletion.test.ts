// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Deleting an establishment leaves no orphans (#169).
 *
 * `stores.remove` deleted the store row and nothing else. Forty-two `storeId`
 * columns across twenty tables were left pointing at a document that no longer
 * existed — products, orders, kitchen tickets, CMS pages, email subscribers,
 * team members — and the id stayed in `userProfiles.storeIds`. Nothing ever
 * complained: `v.id("stores")` validates how an id is encoded, not that it
 * resolves. The bulk delete did it to N establishments at once.
 *
 * These run the real mutation against the real schema, and then go and look at
 * every table, because "no orphans" is a statement about what is *not* there.
 */

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

const NOW = 1_700_000_000_000

const AN_ADDRESS = {
  street: "1 rue de la Paix",
  city: "Paris",
  postalCode: "75002",
  country: "France",
}

function newHarness() {
  const t = convexTest(schema, modules)
  harnesses.push(t)
  return t
}

const harnesses: ReturnType<typeof convexTest>[] = []

/**
 * End each test with an empty scheduler queue.
 *
 * Product, menu and store mutations queue work with `ctx.scheduler.runAfter`
 * — the Uber Eats and Deliveroo menu syncs sit at a 5s delay. A test finishes
 * in milliseconds and leaves them pending; whatever fires them next writes
 * against a transaction that closed, and vitest surfaces that as an unhandled
 * rejection. The run then reports every test green and still exits 1, with
 * nothing naming the file that queued the work — it is attributed to whichever
 * file happened to be running. Draining here is what makes the suite's exit
 * code mean what it says.
 */
afterEach(async () => {
  vi.useFakeTimers()
  try {
    for (const t of harnesses) {
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      // The loop above empties the queue; this waits for anything still in
      // flight to settle. Restoring real timers with a job mid-execution puts
      // its write back on the far side of a closed transaction, which is the
      // failure this hook exists to prevent.
      await t.finishInProgressScheduledFunctions()
    }
  } finally {
    vi.useRealTimers()
    harnesses.length = 0
  }
})


async function seedStore(t: ReturnType<typeof convexTest>, name: string) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      address: AN_ADDRESS,
      hours: [],
      status: "open" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

/**
 * Someone who may delete an establishment.
 *
 * `stores:delete` is held by SUPER_ADMIN alone — a `client_admin` can create
 * and edit their locations, not remove one.
 */
async function seedOwner(
  t: ReturnType<typeof convexTest>,
  subject: string,
  storeIds: Id<"stores">[],
  role: "super_admin" | "client_admin" = "super_admin"
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

/**
 * A furnished establishment: one row in each of the tables an owner would
 * actually miss, spread across the catalogue, the selling, the people, the
 * platforms, the games, the translations, the mailing list and the content.
 */
async function furnish(t: ReturnType<typeof convexTest>, storeId: Id<"stores">) {
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
    const productId = await ctx.db.insert("products", {
      storeId,
      categoryId,
      name: "Margherita",
      slug: "margherita",
      price: 1200,
      taxRate: 10,
      images: [],
      options: [],
      allergens: [],
      tags: [],
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      source: "manual" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const orderId = await ctx.db.insert("orders", {
      storeId,
      orderNumber: "A-001",
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
      status: "pending" as const,
      subtotal: 1200,
      taxAmount: 120,
      total: 1320,
      paymentStatus: "pending" as const,
      source: "website" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.insert("kitchenTickets", {
      storeId,
      orderId,
      orderNumber: "A-001",
      orderType: "pickup" as const,
      trackingToken: "trk-000000000000000001",
      printStatus: "not_required" as const,
      printAttempts: 0,
      source: "website" as const,
      items: [{ productName: "Margherita", quantity: 1, options: [] }],
      status: "pending" as const,
      priority: "normal" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.insert("cmsPages", {
      storeId,
      pageSlug: "home",
      hasPublished: true,
      hasUnpublishedChanges: false,
      updatedAt: NOW,
      updatedBy: "marie",
    })
    await ctx.db.insert("emailSubscribers", {
      storeId,
      email: "camille@example.com",
      status: "active" as const,
      source: "order" as const,
      tags: [],
      consentAt: NOW,
      consentSource: "checkout",
      bounceCount: 0,
      metadata: {
        totalOrders: 1,
        totalSpent: 1320,
        averageOrderValue: 1320,
        favoriteProducts: [],
        orderTypes: ["pickup"],
      },
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.insert("favorites", {
      storeId,
      productId,
      userId: "camille",
      createdAt: NOW,
    })
    await ctx.db.insert("teamMembers", {
      storeId,
      allStores: false,
      email: "luc@example.com",
      name: "Luc",
      role: "manager" as const,
      permissions: [],
      invitationStatus: "accepted" as const,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.insert("languages", {
      storeId,
      code: "fr",
      name: "Français",
      nativeName: "Français",
      isDefault: true,
      isActive: true,
      isRtl: false,
      sortOrder: 0,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.insert("promotions", {
      storeId,
      name: "Bienvenue",
      discountType: "percentage" as const,
      discountValue: 10,
      triggerMode: "coupon" as const,
      couponCode: "BIENVENUE",
      scope: "order" as const,
      isActive: true,
      usageCount: 0,
      startDate: NOW,
      endDate: NOW + 86_400_000,
      createdAt: NOW,
      updatedAt: NOW,
    })
    return { categoryId, productId, orderId }
  })
}

/** Every row left in the tables an establishment writes to. */
const FURNISHED_TABLES = [
  "categories",
  "products",
  "orders",
  "kitchenTickets",
  "cmsPages",
  "emailSubscribers",
  "favorites",
  "teamMembers",
  "languages",
  "promotions",
] as const

async function survivors(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const counts: Record<string, number> = {}
    for (const table of FURNISHED_TABLES) {
      counts[table] = (await ctx.db.query(table).collect()).length
    }
    return counts
  })
}

// ============================================================================

describe("stores.remove", () => {
  test("takes the establishment's data with it", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizzeria Napoli")
    await furnish(t, storeId)
    const marie = await seedOwner(t, "marie", [storeId])

    await marie.mutation(api.stores.remove, { id: storeId })

    expect(await t.run((ctx) => ctx.db.get(storeId))).toBeNull()
    expect(await survivors(t)).toEqual({
      categories: 0,
      products: 0,
      orders: 0,
      kitchenTickets: 0,
      cmsPages: 0,
      emailSubscribers: 0,
      favorites: 0,
      teamMembers: 0,
      languages: 0,
      promotions: 0,
    })
  })

  test("takes the id out of the owner's profile", async () => {
    // Left behind, `storeIds` points at nothing, and the store-scoped seam
    // matches membership against ids that no longer resolve.
    const t = newHarness()
    const napoli = await seedStore(t, "Pizzeria Napoli")
    const roma = await seedStore(t, "Pizzeria Roma")
    const marie = await seedOwner(t, "marie", [napoli, roma])

    await marie.mutation(api.stores.remove, { id: napoli })

    const profile = await t.run((ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", "marie"))
        .unique()
    )
    expect(profile?.storeIds).toEqual([roma])
  })

  test("leaves the other establishment untouched", async () => {
    // The mirror, and the more dangerous mistake of the two. The owner is
    // still selling from the location they kept.
    const t = newHarness()
    const napoli = await seedStore(t, "Pizzeria Napoli")
    const roma = await seedStore(t, "Pizzeria Roma")
    await furnish(t, napoli)
    await furnish(t, roma)
    const marie = await seedOwner(t, "marie", [napoli, roma])

    await marie.mutation(api.stores.remove, { id: napoli })

    expect(await t.run((ctx) => ctx.db.get(roma))).not.toBeNull()
    const counts = await survivors(t)
    for (const [table, count] of Object.entries(counts)) {
      expect(count, `${table} lost the surviving establishment's row`).toBe(1)
    }
  })

  test("still writes the audit entry", async () => {
    // The deletion is the one event the log cannot reconstruct afterwards.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizzeria Napoli")
    await furnish(t, storeId)
    const marie = await seedOwner(t, "marie", [storeId])

    await marie.mutation(api.stores.remove, { id: storeId })

    const entries = await t.run((ctx) => ctx.db.query("systemAuditLog").collect())
    const deletion = entries.find((entry) => entry.action === "store_deleted")

    expect(deletion).toBeDefined()
    expect(deletion?.targetStoreId).toBe(storeId)
    // The name is in `details`, read off the document before it was deleted —
    // afterwards the log could only say that *an* establishment went.
    expect(deletion?.details).toContain("Pizzeria Napoli")
  })

  test("finishes an establishment too big for one transaction", async () => {
    // A mutation is one transaction with a bounded budget. `remove` clears one
    // batch and schedules the rest; this is that loop, run to the end.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizzeria Napoli")
    await t.run(async (ctx) => {
      const categoryId = await ctx.db.insert("categories", {
        storeId,
        name: "Pizzas",
        slug: "pizzas",
        sortOrder: 0,
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
      })
      // Past CASCADE_BATCH_SIZE (512), so the first pass cannot finish.
      for (let i = 0; i < 600; i++) {
        await ctx.db.insert("products", {
          storeId,
          categoryId,
          name: `Pizza ${i}`,
          slug: `pizza-${i}`,
          price: 1200,
          taxRate: 10,
          images: [],
          options: [],
          allergens: [],
          tags: [],
          isActive: true,
          isFeatured: false,
          sortOrder: i,
          source: "manual" as const,
          createdAt: NOW,
          updatedAt: NOW,
        })
      }
    })
    const marie = await seedOwner(t, "marie", [storeId])

    // `purgeStoreData` reschedules itself, so draining once is not enough:
    // `finishAllScheduledFunctions` keeps going until the queue is empty.
    vi.useFakeTimers()
    try {
      await marie.mutation(api.stores.remove, { id: storeId })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
    } finally {
      vi.useRealTimers()
    }

    const left = await t.run(async (ctx) => ({
      stores: (await ctx.db.query("stores").collect()).length,
      products: (await ctx.db.query("products").collect()).length,
      categories: (await ctx.db.query("categories").collect()).length,
    }))
    expect(left).toEqual({ stores: 0, products: 0, categories: 0 })
  })

  test("refuses a caller without stores:delete", async () => {
    // The cascade makes this gate matter more, not less: what used to leak one
    // row now takes a restaurant's whole history.
    const t = newHarness()
    const napoli = await seedStore(t, "Pizzeria Napoli")
    await furnish(t, napoli)
    const other = await seedOwner(t, "luc", [], "client_admin")

    await expect(
      other.mutation(api.stores.remove, { id: napoli })
    ).rejects.toThrow()

    expect(await t.run((ctx) => ctx.db.get(napoli))).not.toBeNull()
    const counts = await survivors(t)
    expect(counts.products).toBe(1)
  })
})
