import { describe, it, expect } from "vitest"
import { UBER_EATS_STATUS_MAP } from "../types"

/**
 * The Uber status vocabulary, pinned.
 *
 * `UBER_EATS_STATUS_MAP` maps `DENIED` to `"denied"`, which is a legitimate
 * member of `UnifiedOrderStatus` — the platform's vocabulary, not ours. Our
 * `orders` table has eight statuses and `denied` is not among them.
 *
 * That gap cost a retry loop. The Uber webhook took `unifiedOrder.status`,
 * cast it to our union to silence the compiler, and handed it to
 * `updateFromWebhook`; the validator rejected it at runtime, the handler
 * returned 500, and Uber retried seven times. The cast is gone and no Uber path
 * applies a mapped status any more, so the value can no longer reach a
 * validator — but the landmine is still in the map, and the next person to
 * write `status: unified.status` would step on it.
 *
 * So the map is pinned here: every value is either one of our eight, or listed
 * below as knowingly foreign. Adding a third category fails this test, which is
 * the only warning anyone is going to get.
 */

const OUR_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
] as const

/** Values Uber produces that our `orders` table cannot store. */
const KNOWINGLY_FOREIGN = ["denied"] as const

describe("UBER_EATS_STATUS_MAP", () => {
  it("produces only values that are ours, or knowingly foreign", () => {
    const allowed = new Set<string>([...OUR_STATUSES, ...KNOWINGLY_FOREIGN])
    const unexpected = Object.entries(UBER_EATS_STATUS_MAP).filter(
      ([, value]) => !allowed.has(value)
    )
    expect(unexpected).toEqual([])
  })

  it("still carries the one foreign value, so nobody assumes it is safe", () => {
    // If this ever fails because `denied` was mapped to `cancelled` at source,
    // delete `KNOWINGLY_FOREIGN` and this test with it — that would be the
    // better fix, not a regression.
    expect(UBER_EATS_STATUS_MAP.DENIED).toBe("denied")
    expect(OUR_STATUSES).not.toContain(UBER_EATS_STATUS_MAP.DENIED)
  })

  it("maps every Uber lifecycle state we know about", () => {
    for (const state of [
      "CREATED", "ACCEPTED", "DENIED", "IN_PROGRESS",
      "READY_FOR_PICKUP", "PICKED_UP", "DELIVERED", "CANCELLED", "FINISHED",
    ]) {
      expect(UBER_EATS_STATUS_MAP[state]).toBeTruthy()
    }
  })
})
