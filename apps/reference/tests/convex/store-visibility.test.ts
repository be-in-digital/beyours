// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * A draft establishment is not readable by the storefront (#224).
 *
 * `stores.list` drops drafts — that is what keeps an unpublished restaurant out
 * of the selector, the header dropdown and the sitemap. `stores.getById` walked
 * straight past it: anyone who knew or guessed an id got the address, the
 * contact details, the `orderMode` and the `overrides` of an establishment its
 * owner had never published.
 *
 * It cannot simply be closed. The query is public because the storefront needs
 * it before anyone signs in — checkout, the contact page, the open/closed banner
 * — and it is also what the administration reads: the store detail page exists
 * to publish drafts, and the KDS reads its own establishment. `kitchen` and
 * `delivery` do not hold `stores:read`, so `getAdminById` is not an option for
 * them. So the rule is by *caller*, not by query.
 */

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

const NOW = 1_700_000_000_000

type Role =
  | "super_admin"
  | "client_admin"
  | "manager"
  | "kitchen"
  | "waiter"
  | "delivery"
  | "customer"

function newHarness() {
  return convexTest(schema, modules)
}

async function seedStore(
  t: ReturnType<typeof convexTest>,
  name: string,
  status: "draft" | "open" | "closed" | "temporarily_unavailable"
) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      address: {
        street: "12 rue Oberkampf",
        city: "Paris",
        postalCode: "75011",
        country: "France",
      },
      phone: "+33145678901",
      email: "napoli@example.com",
      hours: [],
      status,
      orderMode: "manual" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  role: Role,
  storeIds: Id<"stores">[] = []
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

// ============================================================================

describe("stores.getById — a draft", () => {
  test("is not handed to an anonymous visitor", async () => {
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")

    expect(await t.query(api.stores.getById, { id: draft })).toBeNull()
  })

  test("is not handed to a signed-in customer", async () => {
    // Signing up on the storefront must not become a way to read an
    // establishment its owner has not published.
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")
    const asCustomer = await seedUser(t, "camille", "customer")

    expect(await asCustomer.query(api.stores.getById, { id: draft })).toBeNull()
  })

  test("leaks no address, contact or order mode with it", async () => {
    // The fields the audit named. Asserted individually so a partial answer —
    // a stripped object rather than nothing — cannot pass.
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")

    const store = await t.query(api.stores.getById, { id: draft })

    expect(store?.address).toBeUndefined()
    expect(store?.phone).toBeUndefined()
    expect(store?.email).toBeUndefined()
    expect(store?.orderMode).toBeUndefined()
  })

  test("is still handed to the owner who has to publish it", async () => {
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")
    const asOwner = await seedUser(t, "marie", "client_admin", [draft])

    const store = await asOwner.query(api.stores.getById, { id: draft })
    expect(store?.name).toBe("Pizza Draft")
  })

  test("is still handed to a kitchen role", async () => {
    // The KDS reads its own establishment through this query, and `kitchen`
    // does not hold `stores:read` — `getAdminById` is closed to it. Locking
    // drafts to `stores:read` would take the kitchen screen down.
    const t = newHarness()
    const draft = await seedStore(t, "Pizza Draft", "draft")
    const asKitchen = await seedUser(t, "pierre", "kitchen", [draft])

    const store = await asKitchen.query(api.stores.getById, { id: draft })
    expect(store?.name).toBe("Pizza Draft")
  })
})

describe("stores.getById — a published establishment", () => {
  test.each(["open", "closed", "temporarily_unavailable"] as const)(
    "stays readable by an anonymous visitor when %s",
    async (status) => {
      // The mirror, and the reason this is a caller rule rather than a closed
      // query: checkout, the contact page and the open/closed banner all read
      // it before anyone signs in. A `closed` restaurant still has a menu.
      const t = newHarness()
      const storeId = await seedStore(t, "Pizza Open", status)

      const store = await t.query(api.stores.getById, { id: storeId })
      expect(store?.name).toBe("Pizza Open")
      expect(store?.address.city).toBe("Paris")
    }
  )

  test("still hides the printer API key from an anonymous visitor", async () => {
    const t = newHarness()
    const storeId = await t.run((ctx) =>
      ctx.db.insert("stores", {
        name: "Pizza Open",
        slug: "pizza-open",
        address: {
          street: "12 rue Oberkampf",
          city: "Paris",
          postalCode: "75011",
          country: "France",
        },
        hours: [],
        status: "open" as const,
        printConfig: {
          provider: "star_cloud" as const,
          apiKey: "sk-printer-secret",
          triggers: ["confirmed" as const],
          paperSize: "80mm" as const,
          enabled: true,
        },
        createdAt: NOW,
        updatedAt: NOW,
      })
    )

    const store = await t.query(api.stores.getById, { id: storeId })
    expect(store?.printConfig).toBeDefined()
    expect(store?.printConfig).not.toHaveProperty("apiKey")
  })
})

describe("teamMembers.list — the id it is given", () => {
  test("refuses an id this deployment never issued", async () => {
    // Why `/dashboard/team` has to verify the persisted selection before
    // querying: `v.id("stores")` refuses a well-formed id from another
    // deployment, Convex raises that out of `useQuery` during render, and the
    // page goes down rather than degrading. Same shape as #119.
    const t = newHarness()
    const asOwner = await seedUser(t, "marie", "client_admin")

    await expect(
      asOwner.query(api.teamMembers.list, {
        storeId: "j91b7c3d5e7f9g1h3j5k7m9n1p3q5r7s" as Id<"stores">,
      })
    ).rejects.toThrow()
  })

  test("answers for an establishment that exists", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza Open", "open")
    const asOwner = await seedUser(t, "marie", "client_admin", [storeId])

    await expect(
      asOwner.query(api.teamMembers.list, { storeId })
    ).resolves.toEqual([])
  })
})
