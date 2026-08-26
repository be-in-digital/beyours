import { describe, it, expect } from "vitest"
import {
  verifyUberDirectSignature,
  UBER_DIRECT_SIGNATURE_HEADER,
} from "../security"

const SECRET = "uber-direct-signing-secret"
const BODY = JSON.stringify({
  event_id: "evt_1",
  event_type: "dapi.status_changed",
  meta: { order_id: "del_1", status: "EN_ROUTE_TO_DROPOFF" },
})

async function sign(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const buf = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

describe("verifyUberDirectSignature", () => {
  it("accepts a correctly signed body", async () => {
    expect(await verifyUberDirectSignature(BODY, await sign(BODY, SECRET), SECRET)).toBe(true)
  })

  it("accepts an uppercase signature", async () => {
    const sig = (await sign(BODY, SECRET)).toUpperCase()
    expect(await verifyUberDirectSignature(BODY, sig, SECRET)).toBe(true)
  })

  it("rejects a body that was tampered with", async () => {
    const sig = await sign(BODY, SECRET)
    const forged = BODY.replace("EN_ROUTE_TO_DROPOFF", "COMPLETED")
    expect(await verifyUberDirectSignature(forged, sig, SECRET)).toBe(false)
  })

  it("rejects a signature made with another secret", async () => {
    expect(
      await verifyUberDirectSignature(BODY, await sign(BODY, "wrong"), SECRET)
    ).toBe(false)
  })

  it("rejects a missing signature", async () => {
    expect(await verifyUberDirectSignature(BODY, "", SECRET)).toBe(false)
  })

  it("rejects a missing secret rather than accepting everything", async () => {
    expect(await verifyUberDirectSignature(BODY, await sign(BODY, SECRET), "")).toBe(false)
  })

  it("rejects a non-hex signature", async () => {
    expect(await verifyUberDirectSignature(BODY, "not-a-hex-signature", SECRET)).toBe(false)
  })

  it("rejects a truncated signature", async () => {
    const sig = (await sign(BODY, SECRET)).slice(0, 32)
    expect(await verifyUberDirectSignature(BODY, sig, SECRET)).toBe(false)
  })

  it("names the header Uber actually sends", () => {
    expect(UBER_DIRECT_SIGNATURE_HEADER).toBe("x-uber-signature")
  })
})
