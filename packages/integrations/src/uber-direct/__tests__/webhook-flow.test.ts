/**
 * The webhook path, exercised end to end on the pure functions it relies on.
 *
 * The Convex `httpAction` itself is a thin shell — verify, parse, dispatch —
 * so the value is in proving that a real Uber payload leads to the right order
 * decision, including the cases where the right decision is "do nothing".
 */

import { describe, it, expect } from "vitest"
import { verifyUberDirectSignature } from "../security"
import {
  isUberDirectStatus,
  orderStatusForDeliveryStatus,
  requiresManualIntervention,
} from "../status"
import type { UberDirectStatusWebhook } from "../types"

const SECRET = "signing-secret"

function payload(status: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    event_id: "evt_7f3",
    event_time: 1_800_000_000,
    event_type: "dapi.status_changed",
    resource_href: "https://api.uber.com/v1/eats/deliveries/orders/del_42",
    meta: {
      order_id: "del_42",
      external_order_id: "ORD-2026-0042",
      status,
      courier_trip_id: "trip_9",
      is_returning: false,
    },
    ...overrides,
  })
}

async function sign(body: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Mirrors the handler: verify, parse, decide. */
async function handle(body: string, signature: string) {
  if (!(await verifyUberDirectSignature(body, signature, SECRET))) {
    return { http: 401 as const }
  }
  const event = JSON.parse(body) as UberDirectStatusWebhook
  if (event.event_type !== "dapi.status_changed") {
    return { http: 200 as const, action: "ignored" as const }
  }
  const status = event.meta?.status
  if (!status || !isUberDirectStatus(status)) {
    return { http: 200 as const, action: "dropped" as const }
  }
  return {
    http: 200 as const,
    action: "applied" as const,
    orderStatus: orderStatusForDeliveryStatus(status),
    alert: requiresManualIntervention(status),
  }
}

describe("the full courier lifecycle", () => {
  it("walks an order from booking to delivered", async () => {
    const sequence = [
      { status: "SCHEDULED", expected: null },
      { status: "EN_ROUTE_TO_PICKUP", expected: null },
      { status: "ARRIVED_AT_PICKUP", expected: null },
      { status: "EN_ROUTE_TO_DROPOFF", expected: "out_for_delivery" },
      { status: "ARRIVED_AT_DROPOFF", expected: "out_for_delivery" },
      { status: "COMPLETED", expected: "delivered" },
    ] as const

    for (const step of sequence) {
      const body = payload(step.status)
      const result = await handle(body, await sign(body))
      expect(result.http, step.status).toBe(200)
      expect(result.action, step.status).toBe("applied")
      expect(result.orderStatus, step.status).toBe(step.expected)
      expect(result.alert, step.status).toBe(false)
    }
  })

  it("raises an alert on a failed delivery without touching the order", async () => {
    const body = payload("FAILED")
    const result = await handle(body, await sign(body))
    expect(result.action).toBe("applied")
    expect(result.orderStatus).toBeNull()
    expect(result.alert).toBe(true)
  })
})

describe("hostile and malformed input", () => {
  it("refuses an unsigned event", async () => {
    expect((await handle(payload("COMPLETED"), "")).http).toBe(401)
  })

  it("refuses an event signed for a different body", async () => {
    const signature = await sign(payload("SCHEDULED"))
    // An attacker replaying a valid signature over an upgraded status.
    expect((await handle(payload("COMPLETED"), signature)).http).toBe(401)
  })

  it("acknowledges an unrelated event type instead of retrying forever", async () => {
    const body = payload("COMPLETED", { event_type: "dapi.courier_update" })
    const result = await handle(body, await sign(body))
    expect(result.http).toBe(200)
    expect(result.action).toBe("ignored")
  })

  it("acknowledges an unknown status instead of guessing", async () => {
    const body = payload("TELEPORTED")
    const result = await handle(body, await sign(body))
    expect(result.http).toBe(200)
    expect(result.action).toBe("dropped")
  })

  it("acknowledges an event with no status at all", async () => {
    const body = JSON.stringify({
      event_id: "evt_1",
      event_type: "dapi.status_changed",
      meta: { order_id: "del_42" },
    })
    const result = await handle(body, await sign(body))
    expect(result.http).toBe(200)
    expect(result.action).toBe("dropped")
  })

  it("is idempotent: a replayed event yields the same decision", async () => {
    const body = payload("COMPLETED")
    const signature = await sign(body)
    const first = await handle(body, signature)
    const second = await handle(body, signature)
    expect(second).toEqual(first)
  })
})
