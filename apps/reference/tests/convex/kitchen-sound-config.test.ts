// @vitest-environment edge-runtime
/// <reference types="vite/client" />

/**
 * `soundConfig` is the kitchen setting that is actually read (#224).
 *
 * The audit listed it beside `orderConfirmation` and `displayConfig` as a dead
 * setting — "mutations and audit entries wired, with no reader or writer".
 * That is true of the other two, and it was removed for them. It is not true
 * here: `KitchenContent` hands `soundConfig` to `KitchenSoundManager`, in both
 * apps, on the routed `/dashboard/orders/kitchen` screen, and it decides which
 * alerts sound and how loudly.
 *
 * This test exists so that claim is checked rather than remembered. It writes
 * through the real mutation and reads back through `stores.getById` — the query
 * the KDS uses — so the write and the read are the same seam the kitchen runs
 * on.
 */

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

const NOW = 1_700_000_000_000

/** The shape `KitchenSoundManager` destructures. */
const SOUND_CONFIG = {
  newTicket: { enabled: true, volume: 80 },
  overdue: { enabled: false, volume: 100 },
  printerOffline: { enabled: true, volume: 60 },
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
    for (const t of harnesses) await t.finishAllScheduledFunctions(vi.runAllTimers)
  } finally {
    vi.useRealTimers()
    harnesses.length = 0
  }
})


async function seedStore(t: ReturnType<typeof convexTest>) {
  return t.run((ctx) =>
    ctx.db.insert("stores", {
      name: "Pizzeria Napoli",
      slug: "pizzeria-napoli",
      address: {
        street: "12 rue Oberkampf",
        city: "Paris",
        postalCode: "75011",
        country: "France",
      },
      hours: [],
      status: "open" as const,
      createdAt: NOW,
      updatedAt: NOW,
    })
  )
}

async function seedStaff(
  t: ReturnType<typeof convexTest>,
  role: "client_admin" | "kitchen",
  storeIds: Id<"stores">[]
) {
  const subject = `user:${role}`
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

describe("stores.updateSoundConfig", () => {
  test("reaches the query the kitchen display reads", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    const asOwner = await seedStaff(t, "client_admin", [storeId])

    await asOwner.mutation(api.stores.updateSoundConfig, {
      id: storeId,
      soundConfig: SOUND_CONFIG,
    })

    // `KitchenContent` reads its establishment through `getById`, under the
    // `kitchen` role — which does not hold `stores:read`.
    const asKitchen = await seedStaff(t, "kitchen", [storeId])
    const store = await asKitchen.query(api.stores.getById, { id: storeId })

    expect(store?.soundConfig).toEqual(SOUND_CONFIG)
  })

  test("carries a muted alert through, rather than losing it to a default", async () => {
    // `KitchenSoundManager` falls back to `{ enabled: true, ... }` for every
    // alert, so an `enabled: false` that does not survive the round trip is
    // indistinguishable from no configuration at all — the overdue alarm would
    // keep sounding in a kitchen that switched it off.
    const t = newHarness()
    const storeId = await seedStore(t)
    const asOwner = await seedStaff(t, "client_admin", [storeId])

    await asOwner.mutation(api.stores.updateSoundConfig, {
      id: storeId,
      soundConfig: SOUND_CONFIG,
    })

    const store = await t.run((ctx) => ctx.db.get(storeId))
    expect(store?.soundConfig?.overdue).toEqual({ enabled: false, volume: 100 })
  })

  test("leaves the audit trail an entry", async () => {
    const t = newHarness()
    const storeId = await seedStore(t)
    const asOwner = await seedStaff(t, "client_admin", [storeId])

    await asOwner.mutation(api.stores.updateSoundConfig, {
      id: storeId,
      soundConfig: SOUND_CONFIG,
    })

    const entries = await t.run((ctx) => ctx.db.query("systemAuditLog").collect())
    expect(entries.some((e) => e.details?.includes("updateSoundConfig"))).toBe(true)
  })
})
