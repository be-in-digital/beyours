import { describe, expect, test } from "vitest"
import { Role, getRolePermissions, hasPermission } from "@be-in-digital/core/auth/rbac"
import { ORDER_READ_PERMISSION, mayReadStoreOrders } from "../orders"

/**
 * Who, other than the person who ordered, may read one order.
 *
 * `orders.getById` used to answer two questions — "do you hold this order's
 * view token" and "did you place this order" — and no third one. A guest order
 * carries no `customerId`, so both answered no for every member of staff and
 * the admin's order-detail screen said "Commande introuvable" to the owner of
 * the restaurant. `mayReadStoreOrders` is the missing third question, and these
 * tests pin its two halves: it says yes to the people who work at THIS
 * restaurant and hold `orders:read`, and no to everybody else — a member of
 * another restaurant included.
 */

const STORE_A = "stores:a"
const STORE_B = "stores:b"

interface ProfileRow {
  userId: string
  role: string
  storeIds: string[]
  permissions?: string[]
}

/**
 * Enough of a Convex context for the real `requireStorePermission` chain.
 *
 * The chain reads exactly two things: the identity, and the caller's row in
 * `userProfiles` looked up by `by_userId`. Faking those rather than the answer
 * is the point — the test then exercises the membership check, the RBAC table
 * and the module narrowing as they actually are.
 */
function ctxWith(
  identity: { subject: string } | null,
  profiles: ProfileRow[] = []
) {
  return {
    auth: { getUserIdentity: async () => identity },
    db: {
      get: async () => null,
      query: (table: string) => ({
        withIndex: (_index: string, constrain?: (q: unknown) => unknown) => {
          const equalities: Record<string, unknown> = {}
          const q = {
            eq: (field: string, value: unknown) => {
              equalities[field] = value
              return q
            },
          }
          constrain?.(q)
          const rows = table === "userProfiles" ? profiles : []
          const matched = rows.filter((row) =>
            Object.entries(equalities).every(
              ([field, value]) => (row as unknown as Record<string, unknown>)[field] === value
            )
          )
          return {
            unique: async () => matched[0] ?? null,
            first: async () => matched[0] ?? null,
            collect: async () => matched,
          }
        },
      }),
    },
  }
}

function profile(
  role: string,
  storeIds: string[],
  permissions: string[] = []
): ProfileRow {
  return { userId: "user:1", role, storeIds, permissions }
}

const caller = { subject: "user:1" }

/* ------------------------------------------------------------------ */
/* The permission, and who holds it                                    */
/* ------------------------------------------------------------------ */

describe("the permission the staff branch relies on", () => {
  test("is the one the store-scoped order reads already require", () => {
    // `orders.list` and `orders.getByStatus` are wrapped in
    // `storeQuery({ permission: "orders:read" })`. Reusing the same string is
    // what keeps `getById` from answering for anyone `list` would refuse.
    expect(ORDER_READ_PERMISSION).toBe("orders:read")
  })

  test("is held by every role that works at a restaurant, and by no customer", () => {
    // The whole table, asserted at once: a role gaining or losing
    // `orders:read` silently changes who can open an order detail page.
    const holders = Object.values(Role).filter((role) =>
      hasPermission(role, ORDER_READ_PERMISSION)
    )
    expect(holders.sort()).toEqual(
      [
        Role.CLIENT_ADMIN,
        Role.DELIVERY,
        Role.KITCHEN,
        Role.MANAGER,
        Role.SUPER_ADMIN,
        Role.WAITER,
      ].sort()
    )
    expect(holders).not.toContain(Role.CUSTOMER)
  })

  test("a customer holds `orders:view_own` instead, which is not it", () => {
    expect(getRolePermissions(Role.CUSTOMER)).toContain("orders:view_own")
    expect(getRolePermissions(Role.CUSTOMER)).not.toContain(ORDER_READ_PERMISSION)
  })
})

/* ------------------------------------------------------------------ */
/* Store scoping                                                       */
/* ------------------------------------------------------------------ */

describe("mayReadStoreOrders is scoped to one restaurant", () => {
  test("the owner of the restaurant may read its orders", async () => {
    const ctx = ctxWith(caller, [profile("client_admin", [STORE_A])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
  })

  test("the owner of ANOTHER restaurant may not", async () => {
    // The assertion this helper exists for. `client_admin` holds
    // `orders:read`; what refuses them here is the store they are granted.
    const ctx = ctxWith(caller, [profile("client_admin", [STORE_B])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })

  test("a member of both may read either", async () => {
    const ctx = ctxWith(caller, [profile("manager", [STORE_A, STORE_B])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
    await expect(mayReadStoreOrders(ctx, STORE_B)).resolves.toBe(true)
  })

  test("a super admin's remit is the whole chain", async () => {
    // Inherited from `requireStoreAccess`, deliberately: this helper adds no
    // rule of its own, it asks the chain every other admin function asks.
    const ctx = ctxWith(caller, [profile("super_admin", [])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

describe("mayReadStoreOrders follows the role table", () => {
  test.each(["client_admin", "manager", "kitchen", "waiter", "delivery"])(
    "%s works at the restaurant and may read its orders",
    async (role) => {
      const ctx = ctxWith(caller, [profile(role, [STORE_A])])
      await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
    }
  )

  test("a customer account attached to the store may not", async () => {
    // Being listed on a store is not the same as working there. A customer
    // reads their own order through the `customerId` branch, never this one.
    const ctx = ctxWith(caller, [profile("customer", [STORE_A])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })

  test("an unknown role is treated as a customer, and refused", async () => {
    const ctx = ctxWith(caller, [profile("intern", [STORE_A])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* The module narrowing an owner sets on the invite dialog             */
/* ------------------------------------------------------------------ */

describe("mayReadStoreOrders honours the modules granted", () => {
  test("a manager granted the orders module may read", async () => {
    const ctx = ctxWith(caller, [profile("manager", [STORE_A], ["orders"])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
  })

  test("a manager granted only the kitchen module may not", async () => {
    const ctx = ctxWith(caller, [profile("manager", [STORE_A], ["kitchen"])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })

  test("an empty module list means unrestricted, as everywhere else", async () => {
    const ctx = ctxWith(caller, [profile("waiter", [STORE_A], [])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Nobody                                                              */
/* ------------------------------------------------------------------ */

describe("mayReadStoreOrders fails closed", () => {
  test("an anonymous caller gains nothing", async () => {
    const ctx = ctxWith(null, [profile("client_admin", [STORE_A])])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })

  test("a signed-in account with no profile gains nothing", async () => {
    const ctx = ctxWith(caller, [])
    await expect(mayReadStoreOrders(ctx, STORE_A)).resolves.toBe(false)
  })

  test("a context that cannot answer at all refuses rather than throws", async () => {
    // A refusal must never escape as an exception: `getById` is shared with the
    // storefront, where a guest reading their own order is not an error.
    const broken = {
      auth: {
        getUserIdentity: async () => {
          throw new Error("backend unavailable")
        },
      },
      db: { get: async () => null, query: () => ({}) },
    }
    await expect(mayReadStoreOrders(broken, STORE_A)).resolves.toBe(false)
  })
})
