import { describe, it, expect, vi, afterEach } from "vitest"
import {
  generateDoubleOptInToken,
  isDoubleOptInValid,
  processDoubleOptIn,
  type SubscriberForOptIn,
} from "../double-opt-in"

describe("generateDoubleOptInToken", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("generates a UUID token", () => {
    const result = generateDoubleOptInToken()
    expect(result.token).toBeDefined()
    expect(result.token.length).toBeGreaterThan(0)
    // UUID v4 format
    expect(result.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it("sets the expiry 48h in the future", () => {
    const before = Date.now()
    const result = generateDoubleOptInToken()
    const after = Date.now()
    const ttl48h = 48 * 60 * 60 * 1000

    expect(result.expiresAt).toBeGreaterThanOrEqual(before + ttl48h)
    expect(result.expiresAt).toBeLessThanOrEqual(after + ttl48h)
  })

  it("generates unique tokens", () => {
    const t1 = generateDoubleOptInToken()
    const t2 = generateDoubleOptInToken()
    expect(t1.token).not.toBe(t2.token)
  })
})

describe("isDoubleOptInValid", () => {
  const future = Date.now() + 60_000
  const past = Date.now() - 60_000

  it("returns true for a pending subscriber with a valid token", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(true)
  })

  it("returns false when the status is not pending", () => {
    const subscriber: SubscriberForOptIn = {
      status: "active",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("returns false when the token is missing", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("returns false when expiresAt is missing", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("returns false when the token has expired", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: past,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })
})

describe("processDoubleOptIn", () => {
  it("returns the confirmation data", () => {
    const now = 1700000000000
    const result = processDoubleOptIn(now)
    expect(result).toEqual({
      status: "active",
      doubleOptInAt: now,
      doubleOptInToken: undefined,
      doubleOptInExpiresAt: undefined,
    })
  })

  it("defaults to Date.now()", () => {
    const before = Date.now()
    const result = processDoubleOptIn()
    const after = Date.now()
    expect(result.status).toBe("active")
    expect(result.doubleOptInAt as number).toBeGreaterThanOrEqual(before)
    expect(result.doubleOptInAt as number).toBeLessThanOrEqual(after)
  })

  it("clears the token and the expiry", () => {
    const result = processDoubleOptIn()
    expect(result.doubleOptInToken).toBeUndefined()
    expect(result.doubleOptInExpiresAt).toBeUndefined()
  })
})
