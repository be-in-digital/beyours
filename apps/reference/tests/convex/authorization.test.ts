// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Authorisation tests — the negative half.
 *
 * The audit's central finding was that the store-scoped seam existed and simply
 * was not applied: functions guarded only by "are you logged in", public reads
 * of admin data, a privilege escalation through `userProfiles.upsert`. Sprint 2
 * closed those one by one, but a migration is only as good as the test that
 * proves it happened.
 *
 * These tests run the real Convex functions against a real schema, in memory.
 * They assert what must be REFUSED — the assertions that fail loudly if a guard
 * is ever weakened or a wrapper quietly reverts to `query(defs.x)`.
 */

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api, internal } from "../../convex/_generated/api"
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

const NOW = 1_700_000_000_000

function newHarness() {
  return convexTest(schema, modules)
}

/** A store record with only the fields the schema demands. */
async function seedStore(t: ReturnType<typeof convexTest>, name: string) {
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
      status: "open" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

/** A user whose profile grants `role` over `storeIds`. */
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

async function seedPrize(t: ReturnType<typeof convexTest>, storeId: Id<"stores">) {
  return t.run((ctx) =>
    ctx.db.insert("prizes", {
      storeId,
      name: "Café offert",
      type: "custom" as const,
      validityDays: 30,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

// ============================================================================
// The seam refuses anonymous callers
// ============================================================================

describe("no session", () => {
  test("a store-scoped read is refused", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")

    await expect(t.query(api.prizes.list, { storeId })).rejects.toThrow(
      /Not authenticated/
    )
  })

  test("a store-scoped write is refused", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")

    await expect(
      t.mutation(api.gameQRCodes.create, {
        storeId,
        code: "TABLE1",
        tableNumber: "1",
        isActive: true,
      })
    ).rejects.toThrow(/Not authenticated/)
  })
})

// ============================================================================
// The tenant boundary
// ============================================================================

describe("cross-store access", () => {
  test("a user of store A cannot read store B", async () => {
    // `prizes.list` was a bare public query: a storeId — visible in the
    // /display/[storeId] URL — was enough to read a competitor's prize stock.
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const storeB = await seedStore(t, "Pizza B")
    const asOwnerOfA = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(asOwnerOfA.query(api.prizes.list, { storeId: storeB })).rejects.toThrow(
      /Access denied/
    )
  })

  test("a user of store A cannot write to store B", async () => {
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const storeB = await seedStore(t, "Pizza B")
    const asOwnerOfA = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(
      asOwnerOfA.mutation(api.gameQRCodes.create, {
        storeId: storeB,
        code: "TABLE1",
        tableNumber: "1",
        isActive: true,
      })
    ).rejects.toThrow(/Access denied/)
  })

  test("a user of store A cannot delete store B's data", async () => {
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const storeB = await seedStore(t, "Pizza B")
    const prizeInB = await seedPrize(t, storeB)
    const asOwnerOfA = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(asOwnerOfA.mutation(api.prizes.remove, { id: prizeInB })).rejects.toThrow(
      /Access denied/
    )
  })

  test("the owner of the store itself is allowed", async () => {
    // The mirror of the tests above: the guard must not lock out the person it
    // exists to serve.
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const asOwner = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(asOwner.query(api.prizes.list, { storeId: storeA })).resolves.toEqual([])
  })

  test("a super admin reaches every store", async () => {
    const t = newHarness()
    await seedStore(t, "Pizza A")
    const storeB = await seedStore(t, "Pizza B")
    const asRoot = await seedUser(t, "user:root", "super_admin", [])

    await expect(asRoot.query(api.prizes.list, { storeId: storeB })).resolves.toEqual([])
  })
})

// ============================================================================
// The role boundary — membership is not enough
// ============================================================================

describe("insufficient role", () => {
  test("kitchen staff cannot delete the store they work in", async () => {
    // Store-scoped without `permission:` only checks membership, which is how a
    // kitchen account could delete the restaurant.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asKitchen = await seedUser(t, "user:k", "kitchen", [storeId])

    await expect(asKitchen.mutation(api.stores.remove, { id: storeId })).rejects.toThrow(
      /lacks permission/
    )
  })

  test("kitchen staff cannot run email marketing", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asKitchen = await seedUser(t, "user:k", "kitchen", [storeId])

    await expect(
      asKitchen.query(api.emailCampaigns.list, { storeId })
    ).rejects.toThrow(/lacks permission/)
  })

  test("a waiter cannot change the game odds", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asWaiter = await seedUser(t, "user:w", "waiter", [storeId])

    await expect(asWaiter.query(api.games.list, { storeId })).rejects.toThrow(
      /lacks permission/
    )
  })

  test("kitchen staff CAN read their own kitchen display", async () => {
    // The risk of adding permissions everywhere is locking the kitchen out of
    // the one screen it needs.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asKitchen = await seedUser(t, "user:k", "kitchen", [storeId])

    await expect(
      asKitchen.query(api.kitchenTickets.getByStore, { storeId })
    ).resolves.toBeDefined()
  })
})

// ============================================================================
// Privilege escalation
// ============================================================================

describe("privilege escalation", () => {
  test("a customer cannot promote themselves to manager", async () => {
    // The audited three-call attack: sign up, list the public stores, grant
    // yourself `manager` on someone else's restaurant.
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asCustomer = await seedUser(t, "user:mallory", "customer", [])

    await expect(
      asCustomer.mutation(api.userProfiles.upsert, {
        userId: "user:mallory",
        role: "manager",
        storeIds: [storeId],
      })
    ).rejects.toThrow(/pas le droit/)
  })

  test("an owner cannot grant access to a store they do not administer", async () => {
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const storeB = await seedStore(t, "Pizza B")
    const asOwnerOfA = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(
      asOwnerOfA.mutation(api.userProfiles.upsert, {
        userId: "user:new",
        role: "manager",
        storeIds: [storeB],
      })
    ).rejects.toThrow(/vos propres établissements|administrez/)
  })

  test("an owner cannot mint another admin", async () => {
    const t = newHarness()
    const storeA = await seedStore(t, "Pizza A")
    const asOwnerOfA = await seedUser(t, "user:a", "client_admin", [storeA])

    await expect(
      asOwnerOfA.mutation(api.userProfiles.upsert, {
        userId: "user:new",
        role: "client_admin",
        storeIds: [storeA],
      })
    ).rejects.toThrow(/super administrateur/)
  })

  test("a customer cannot create a restaurant", async () => {
    const t = newHarness()
    const asCustomer = await seedUser(t, "user:mallory", "customer", [])

    await expect(
      asCustomer.mutation(api.stores.create, {
        name: "Faux resto",
        slug: "faux-resto",
        address: {
          street: "1 rue",
          city: "Paris",
          postalCode: "75002",
          country: "France",
        },
      })
    ).rejects.toThrow(/stores:write/)
  })
})

// ============================================================================
// Reading other people's data
// ============================================================================

describe("identity is never an argument", () => {
  test("a signed-in customer only sees their own orders", async () => {
    // `getByCustomer` took an arbitrary customerId and returned that person's
    // whole history. It is gone; `getMyOrders` derives the customer instead.
    const t = newHarness()
    const asCustomer = await seedUser(t, "user:c1", "customer", [])

    expect(api.orders).not.toHaveProperty("getByCustomer")
    await expect(asCustomer.query(api.orders.getMyOrders, {})).resolves.toEqual([])
  })

  test("a profile can only be read by its owner", async () => {
    // `getByUserId` performed no identity check at all.
    const t = newHarness()
    const asCustomer = await seedUser(t, "user:c1", "customer", [])

    expect(api.userProfiles).not.toHaveProperty("getByUserId")
    const mine = await asCustomer.query(api.userProfiles.getMyProfile, {})
    expect(mine?.userId).toBe("user:c1")
  })
})

/**
 * The guards the 56 actions rely on.
 *
 * The ESLint rule can tell you an action CLAIMS to be guarded — it reads the
 * `@guarded-inline` comment — but it cannot tell you the claim is true. Proving
 * that took neutralising a guard by hand and watching lint stay green. These
 * tests close the gap for the two helpers every guarded action routes through:
 * if either stops refusing, they go red.
 */
describe("action guards", () => {
  test("checkStorePermission refuses a customer on someone else's store", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const asCustomer = await seedUser(t, "user:mallory", "customer", [])

    await expect(
      asCustomer.query(internal.authHelpers.checkStorePermission, {
        storeId,
        permission: "kitchen:write",
      })
    ).rejects.toThrow()
  })

  test("checkStorePermission refuses a manager of ANOTHER store", async () => {
    const t = newHarness()
    const mine = await seedStore(t, "Chez Luigi")
    const theirs = await seedStore(t, "Chez Marco")
    const asManager = await seedUser(t, "user:m1", "manager", [mine])

    await expect(
      asManager.query(internal.authHelpers.checkStorePermission, {
        storeId: theirs,
        permission: "kitchen:write",
      })
    ).rejects.toThrow()
  })

  test("checkStorePermission lets the kitchen work its own kitchen", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const asKitchen = await seedUser(t, "user:k1", "kitchen", [storeId])

    await expect(
      asKitchen.query(internal.authHelpers.checkStorePermission, {
        storeId,
        permission: "kitchen:write",
      })
    ).resolves.toBe(true)
  })

  test("checkPermission refuses a customer a deployment-wide setting", async () => {
    const t = newHarness()
    const asCustomer = await seedUser(t, "user:mallory", "customer", [])

    await expect(
      asCustomer.query(internal.authHelpers.checkPermission, {
        permission: "settings:write",
      })
    ).rejects.toThrow()
  })

  test("checkPermission refuses the kitchen a deployment-wide setting", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const asKitchen = await seedUser(t, "user:k1", "kitchen", [storeId])

    await expect(
      asKitchen.query(internal.authHelpers.checkPermission, {
        permission: "settings:write",
      })
    ).rejects.toThrow()
  })

  test("checkPermission lets a client admin connect a payment provider", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const asAdmin = await seedUser(t, "user:a1", "client_admin", [storeId])

    await expect(
      asAdmin.query(internal.authHelpers.checkPermission, {
        permission: "settings:write",
      })
    ).resolves.toBe(true)
  })

  test("an unknown permission string denies rather than grants", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const asAdmin = await seedUser(t, "user:a1", "client_admin", [storeId])

    await expect(
      asAdmin.query(internal.authHelpers.checkPermission, {
        permission: "settings:wrtie",
      })
    ).rejects.toThrow()
  })
})

/** An order with only the fields the schema demands. */
async function seedOrder(
  t: ReturnType<typeof convexTest>,
  storeId: Id<"stores">,
  status: "confirmed" | "ready" = "confirmed"
) {
  return t.run((ctx) =>
    ctx.db.insert("orders", {
      storeId,
      orderNumber: "ORD-2026-0001",
      customerInfo: { name: "Camille" },
      type: "delivery" as const,
      status,
      items: [
        {
          productName: "Margherita",
          quantity: 1,
          unitPrice: 1000,
          selectedOptions: [],
          subtotal: 1000,
        },
      ],
      subtotal: 1000,
      taxAmount: 100,
      total: 1100,
      paymentStatus: "paid" as const,
      source: "website" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

/**
 * Permissions that named the wrong verb.
 *
 * These call the real mutations, not the permission helper. An earlier version
 * asserted on permission STRINGS, which proved the role table and nothing about
 * the call site: putting `orders:write` back on `orders.updateStatus` left them
 * all green. A test that cannot fail on the change it describes is worse than
 * no test, because it reads as coverage.
 */
describe("permission verbs", () => {
  test("the kitchen can advance an order it is cooking", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const orderId = await seedOrder(t, storeId)
    const asKitchen = await seedUser(t, "user:k1", "kitchen", [storeId])

    await expect(
      asKitchen.mutation(api.orders.updateStatus, {
        id: orderId,
        status: "preparing",
      })
    ).resolves.not.toThrow()
  })

  test("the delivery role can advance an order — its entire job", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    // `confirmed -> out_for_delivery` is not a legal transition; the courier
    // picks up an order that is ready.
    const orderId = await seedOrder(t, storeId, "ready")
    const asDelivery = await seedUser(t, "user:d1", "delivery", [storeId])

    await expect(
      asDelivery.mutation(api.orders.updateStatus, {
        id: orderId,
        status: "out_for_delivery",
      })
    ).resolves.not.toThrow()
  })

  test("a customer still cannot advance anyone's order", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const orderId = await seedOrder(t, storeId)
    const asCustomer = await seedUser(t, "user:mallory", "customer", [])

    await expect(
      asCustomer.mutation(api.orders.updateStatus, {
        id: orderId,
        status: "completed",
      })
    ).rejects.toThrow()
  })

  test("the kitchen of ANOTHER restaurant cannot advance this order", async () => {
    const t = newHarness()
    const mine = await seedStore(t, "Chez Luigi")
    const theirs = await seedStore(t, "Chez Marco")
    const orderId = await seedOrder(t, mine)
    const asKitchen = await seedUser(t, "user:k2", "kitchen", [theirs])

    await expect(
      asKitchen.mutation(api.orders.updateStatus, {
        id: orderId,
        status: "preparing",
      })
    ).rejects.toThrow()
  })

  test("an owner can delete an order in their own restaurant", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const orderId = await seedOrder(t, storeId)
    const asAdmin = await seedUser(t, "user:a1", "client_admin", [storeId])

    await expect(
      asAdmin.mutation(api.orders.remove, { id: orderId })
    ).resolves.not.toThrow()
  })

  test("the kitchen cannot delete an order", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Chez Luigi")
    const orderId = await seedOrder(t, storeId)
    const asKitchen = await seedUser(t, "user:k1", "kitchen", [storeId])

    await expect(
      asKitchen.mutation(api.orders.remove, { id: orderId })
    ).rejects.toThrow()
  })
})

