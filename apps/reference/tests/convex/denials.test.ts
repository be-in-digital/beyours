// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * Refusals the UI can act on.
 *
 * `ConvexError` appeared nowhere in this repository. Every guard threw a plain
 * `Error`, Convex redacts those in production, and the UI rendered
 * `error.message` — so a kitchen account opening the settings screen, an owner
 * whose profile was never provisioned, and a genuine backend fault all produced
 * "Server Error". Every authorisation answer looked like a bug in the product.
 *
 * These tests pin the codes. They are a contract between the guards and the
 * screens that switch on them, and prose in a `message` is not one.
 */

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"
import { convexErrorCode } from "../../lib/convex-error"

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

async function seedUser(
  t: ReturnType<typeof convexTest>,
  subject: string,
  role: Role,
  storeIds: Id<"stores">[],
  permissions: string[] = []
) {
  await t.run((ctx) =>
    ctx.db.insert("userProfiles", {
      userId: subject,
      role,
      storeIds,
      permissions,
      language: "fr",
      twoFactorEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
  return t.withIdentity({ subject })
}

/** The refusal code, read exactly the way a screen reads it. */
async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    return convexErrorCode(error)
  }
}

describe("denial codes", () => {
  test("no session", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")

    expect(await codeOf(t.query(api.prizes.list, { storeId }))).toBe(
      "not_authenticated"
    )
  })

  test("signed in with no profile — the unfinished-setup case, not a crash", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")

    // This is every account on a deployment whose first administrator was
    // never appointed. `/setup` is the way out, and the UI can only say so if
    // it can tell this apart from a fault.
    expect(
      await codeOf(
        t.withIdentity({ subject: "ghost" }).query(api.prizes.list, { storeId })
      )
    ).toBe("no_profile")
  })

  test("a store the account was never granted", async () => {
    const t = newHarness()
    const mine = await seedStore(t, "Pizza A")
    const theirs = await seedStore(t, "Pizza B")
    const asOwner = await seedUser(t, "owner", "client_admin", [mine])

    expect(
      await codeOf(asOwner.query(api.prizes.list, { storeId: theirs }))
    ).toBe("store_not_granted")
  })

  test("a permission the role does not carry", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asKitchen = await seedUser(t, "cook", "kitchen", [storeId])

    expect(
      await codeOf(asKitchen.mutation(api.stores.remove, { id: storeId }))
    ).toBe("permission_denied")
  })

  test("a module the invitation did not grant", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    // A manager's role carries products:write; the owner unticked the module.
    const asManager = await seedUser(t, "boss", "manager", [storeId], [
      "orders",
      "kitchen",
    ])

    expect(
      await codeOf(
        asManager.mutation(api.categories.create, {
          storeId,
          name: "Entrées",
          slug: "entrees",
          sortOrder: 1,
          isActive: true,
        })
      )
    ).toBe("module_denied")
  })

  test("a customer on a staff-only read", async () => {
    const t = newHarness()
    await seedStore(t, "Pizza A")
    const asCustomer = await seedUser(t, "client", "customer", [])

    // The one that crashed `/dashboard`: `StoreGuard` fires this query and
    // `useQuery` rethrows the refusal during render.
    expect(await codeOf(asCustomer.query(api.stores.listAll, {}))).toBe(
      "staff_only"
    )
  })

  test("every code carries a sentence a screen can show unchanged", async () => {
    const t = newHarness()
    const storeId = await seedStore(t, "Pizza A")
    const asCustomer = await seedUser(t, "client", "customer", [])

    try {
      await asCustomer.query(api.prizes.list, { storeId })
      throw new Error("expected a refusal")
    } catch (error) {
      const data = (error as { data?: unknown }).data
      const parsed = typeof data === "string" ? JSON.parse(data) : data
      expect(parsed).toMatchObject({ code: expect.any(String) })
      expect(String(parsed.message).length).toBeGreaterThan(10)
    }
  })
})
