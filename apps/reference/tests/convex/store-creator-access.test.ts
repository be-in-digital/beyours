// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Creating an establishment makes you its administrator (#117).
 *
 * `stores.create` is the one mutation the store-scoped seam cannot guard —
 * there is no store yet to check membership against — and nothing used to add
 * the new establishment to the creator's profile. An owner who opened a second
 * location was refused by every screen that showed it to them, and
 * `profileProvisioning` refused them their own profile too, so only a super
 * admin could let them back in.
 *
 * The first test walks exactly the five calls from the issue. The rest exist so
 * the narrow self-grant stays narrow.
 */

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

type Role = "super_admin" | "client_admin" | "manager" | "customer"

const NOW = 1_700_000_000_000

const AN_ADDRESS = {
  street: "1 rue de la Paix",
  city: "Paris",
  postalCode: "75002",
  country: "France",
}

function newHarness() {
  return convexTest(schema, modules)
}

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

/** The stores a profile currently lists. */
async function storeIdsOf(t: ReturnType<typeof convexTest>, subject: string) {
  const profile = await t.run((ctx) =>
    ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", subject))
      .unique()
  )
  return profile?.storeIds ?? []
}

// ============================================================================
// The reported scenario
// ============================================================================

describe("an owner opening a second location", () => {
  test("can then reach, edit and keep it — the five calls from the issue", async () => {
    const t = newHarness()
    const roma = await seedStore(t, "Pizzeria Roma")
    const marie = await seedUser(t, "marie", "client_admin", [roma])

    // 1. create
    const napoli = await marie.mutation(api.stores.create, {
      name: "Pizzeria Napoli",
      slug: "pizzeria-napoli",
      address: AN_ADDRESS,
    })

    // 2. the admin list carries the draft
    const listed = await marie.query(api.stores.listAll, {})
    expect(listed.map((s) => s.name).sort()).toEqual([
      "Pizzeria Napoli",
      "Pizzeria Roma",
    ])

    // 3. the detail page opens
    const detail = await marie.query(api.stores.getAdminById, { id: napoli })
    expect(detail?.name).toBe("Pizzeria Napoli")

    // 4. the edit goes through
    await marie.mutation(api.stores.updateHours, {
      id: napoli,
      hours: [{ day: 1, open: "11:30", close: "14:30", isClosed: false }],
    })

    // 5. and she needed nobody's help to get there
    expect(await storeIdsOf(t, "marie")).toEqual([roma, napoli])
  })

  test("reads the creation back from the journal through membership", async () => {
    const t = newHarness()
    const roma = await seedStore(t, "Pizzeria Roma")
    const marie = await seedUser(t, "marie", "client_admin", [roma])

    const napoli = await marie.mutation(api.stores.create, {
      name: "Pizzeria Napoli",
      slug: "pizzeria-napoli",
      address: AN_ADDRESS,
    })

    const journal = await marie.query(api.system.getAuditLog, {
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(journal.page).toHaveLength(1)
    expect(journal.page[0]!.targetStoreId).toBe(napoli)
  })
})

// ============================================================================
// The self-grant stays narrow
// ============================================================================

describe("the grant does not become an escalation", () => {
  test("it reaches only the store just created, not the neighbour's", async () => {
    const t = newHarness()
    const roma = await seedStore(t, "Pizzeria Roma")
    const theirs = await seedStore(t, "Pizzeria Napoli")
    const marie = await seedUser(t, "marie", "client_admin", [roma])

    const mine = await marie.mutation(api.stores.create, {
      name: "Roma Trastevere",
      slug: "roma-trastevere",
      address: AN_ADDRESS,
    })

    expect(await storeIdsOf(t, "marie")).toEqual([roma, mine])
    await expect(
      marie.query(api.stores.getAdminById, { id: theirs })
    ).rejects.toThrow(/do not have access/)
    await expect(
      marie.mutation(api.stores.update, { id: theirs, name: "Volée" })
    ).rejects.toThrow(/do not have access/)
  })

  test("it does not change the creator's role", async () => {
    const t = newHarness()
    const marie = await seedUser(t, "marie", "client_admin", [])

    await marie.mutation(api.stores.create, {
      name: "Pizzeria Roma",
      slug: "pizzeria-roma",
      address: AN_ADDRESS,
    })

    const profile = await t.run((ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", "marie"))
        .unique()
    )
    expect(profile?.role).toBe("client_admin")
    expect(profile?.permissions).toEqual([])
  })

  test("a super admin's profile is left alone", async () => {
    const t = newHarness()
    const admin = await seedUser(t, "root", "super_admin", [])

    const storeId = await admin.mutation(api.stores.create, {
      name: "Pizzeria Roma",
      slug: "pizzeria-roma",
      address: AN_ADDRESS,
    })

    expect(await storeIdsOf(t, "root")).toEqual([])
    // They reach it anyway — membership would have bought them nothing.
    const detail = await admin.query(api.stores.getAdminById, { id: storeId })
    expect(detail?.name).toBe("Pizzeria Roma")
  })

  test("a role without stores:write still cannot create, and so gains nothing", async () => {
    const t = newHarness()
    const roma = await seedStore(t, "Pizzeria Roma")
    const manager = await seedUser(t, "paul", "manager", [roma])

    await expect(
      manager.mutation(api.stores.create, {
        name: "Pizzeria Napoli",
        slug: "pizzeria-napoli",
        address: AN_ADDRESS,
      })
    ).rejects.toThrow(/stores:write/)

    expect(await storeIdsOf(t, "paul")).toEqual([roma])
  })

  test("provisioning still refuses a client admin their own profile", async () => {
    const t = newHarness()
    const roma = await seedStore(t, "Pizzeria Roma")
    const theirs = await seedStore(t, "Pizzeria Napoli")
    const marie = await seedUser(t, "marie", "client_admin", [roma])

    // The narrow grant inside `stores.create` is the exception; the general
    // rule it lives beside is untouched.
    await expect(
      marie.mutation(api.userProfiles.upsert, {
        userId: "marie",
        role: "client_admin",
        storeIds: [roma, theirs],
        permissions: [],
      })
    ).rejects.toThrow(/super administrateur/)
  })
})
