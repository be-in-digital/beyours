/**
 * The retry policy the two platform clients share.
 *
 * Neither client had one. `fetchUberEats` and `fetchDeliveroo` retried exactly
 * one thing — an expired token — and handed every other status straight back,
 * so a single 429 from Uber's menu endpoint (about one call a minute per store)
 * failed the whole push and wrote an error on the establishment.
 *
 * These tests pin the shape of the policy. The two client suites pin that the
 * clients actually apply it.
 */

import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_BASE_DELAY_MS,
  backoffDelayMs,
  isRetryable,
  readWaitHintMs,
  sendWithRetry,
  type BackoffPolicy,
} from "../backoff"

const POLICY: BackoffPolicy = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  totalBudgetMs: 60_000,
  waitHintHeaders: ["retry-after"],
}

/** A response shaped like the plain objects this package's fetch mocks return. */
function response(status: number, headers?: Record<string, string>) {
  return {
    status,
    headers: headers
      ? { get: (name: string) => headers[name.toLowerCase()] ?? null }
      : undefined,
  }
}

describe("backoffDelayMs", () => {
  it("doubles each attempt", () => {
    // `random: () => 0` takes the floor of the jitter window, so the growth is
    // visible rather than hidden behind a coin flip.
    const floor = (attempt: number) => backoffDelayMs(attempt, POLICY, () => 0)

    expect(floor(1)).toBe(250)
    expect(floor(2)).toBe(500)
    expect(floor(3)).toBe(1000)
    expect(floor(4)).toBe(2000)
  })

  it("stays inside its own window whatever the jitter", () => {
    for (let attempt = 1; attempt <= 6; attempt++) {
      const low = backoffDelayMs(attempt, POLICY, () => 0)
      const high = backoffDelayMs(attempt, POLICY, () => 1)
      const middle = backoffDelayMs(attempt, POLICY, () => 0.5)

      expect(high).toBe(low * 2)
      expect(middle).toBeGreaterThanOrEqual(low)
      expect(middle).toBeLessThanOrEqual(high)
    }
  })

  it("caps the exponential so a long sequence cannot run away", () => {
    // 500ms doubled twenty times is over a century of milliseconds.
    expect(backoffDelayMs(20, POLICY, () => 1)).toBe(POLICY.maxDelayMs)
  })

  it("varies between calls, so a fleet of stores does not retry in lockstep", () => {
    const delays = new Set(
      Array.from({ length: 50 }, () => backoffDelayMs(3, POLICY))
    )
    expect(delays.size).toBeGreaterThan(1)
  })
})

describe("readWaitHintMs", () => {
  it("reads Retry-After in seconds", () => {
    expect(readWaitHintMs(response(429, { "retry-after": "12" }), ["retry-after"])).toBe(12_000)
  })

  it("reads Retry-After as an HTTP date", () => {
    const now = Date.UTC(2026, 8, 4, 12, 0, 0)
    const later = new Date(now + 30_000).toUTCString()
    expect(readWaitHintMs(response(429, { "retry-after": later }), ["retry-after"], now)).toBe(30_000)
  })

  it("never returns a negative wait for a date already past", () => {
    const now = Date.UTC(2026, 8, 4, 12, 0, 0)
    const earlier = new Date(now - 30_000).toUTCString()
    expect(readWaitHintMs(response(429, { "retry-after": earlier }), ["retry-after"], now)).toBe(0)
  })

  it("takes the first header it recognises, in the order given", () => {
    const headers = { "x-deliveroo-ratelimit-wait-time-seconds": "5", "retry-after": "60" }
    expect(
      readWaitHintMs(response(429, headers), ["x-deliveroo-ratelimit-wait-time-seconds", "retry-after"])
    ).toBe(5_000)
  })

  it("falls back to null when the header is absent, empty or unreadable", () => {
    expect(readWaitHintMs(response(429), ["retry-after"])).toBeNull()
    expect(readWaitHintMs(response(429, { "retry-after": "  " }), ["retry-after"])).toBeNull()
    expect(readWaitHintMs(response(429, { "retry-after": "soon" }), ["retry-after"])).toBeNull()
  })

  it("survives a response with no headers at all", () => {
    // Every existing fetch mock in this package returns a bare object literal.
    expect(readWaitHintMs({ status: 429 }, ["retry-after"])).toBeNull()
  })
})

describe("isRetryable", () => {
  it("retries a 429 whatever the method — a rate-limited request never ran", () => {
    expect(isRetryable(response(429), "POST")).toBe(true)
    expect(isRetryable(response(429), "GET")).toBe(true)
  })

  it("retries a 5xx only when the request can safely be replayed", () => {
    expect(isRetryable(response(502), "PUT")).toBe(true)
    expect(isRetryable(response(503), "GET")).toBe(true)
    // A 502 on `POST /accept` may mean the order WAS accepted and the reply was
    // lost. Accepting it twice is worse than failing once.
    expect(isRetryable(response(502), "POST")).toBe(false)
  })

  it("leaves the statuses a retry cannot fix alone", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 200]) {
      expect(isRetryable(response(status), "GET"), `status ${status}`).toBe(false)
    }
  })

  it("does not retry a response with no status", () => {
    expect(isRetryable({}, "GET")).toBe(false)
  })
})

describe("sendWithRetry", () => {
  it("bounds the attempts", async () => {
    const send = vi.fn(async () => response(429))
    const sleep = vi.fn(async () => {})

    const result = await sendWithRetry(send, "PUT", POLICY, { sleep, random: () => 0 })

    expect(send).toHaveBeenCalledTimes(POLICY.maxAttempts)
    expect(sleep).toHaveBeenCalledTimes(POLICY.maxAttempts - 1)
    // The last response is returned, not thrown: the callers turn it into an
    // IntegrationError carrying the platform's own body.
    expect(result.status).toBe(429)
  })

  it("waits longer before each successive retry", async () => {
    const send = vi.fn(async () => response(429))
    const waits: number[] = []

    await sendWithRetry(send, "PUT", POLICY, {
      sleep: async (ms) => { waits.push(ms) },
      random: () => 0,
    })

    expect(waits).toEqual([250, 500])
  })

  it("honours Retry-After instead of its own schedule", async () => {
    const send = vi.fn(async () => response(429, { "retry-after": "7" }))
    const waits: number[] = []

    await sendWithRetry(send, "PUT", POLICY, {
      sleep: async (ms) => { waits.push(ms) },
      random: () => 0,
    })

    expect(waits).toEqual([7_000, 7_000])
  })

  it("stops rather than sleeping past its budget", async () => {
    // The bound that matters for Deliveroo: a token lives 300 seconds, and a
    // loop that waits longer than that retries with credentials that are gone.
    const send = vi.fn(async () => response(429, { "retry-after": "600" }))
    const sleep = vi.fn(async () => {})

    const result = await sendWithRetry(send, "PUT", { ...POLICY, totalBudgetMs: 45_000 }, { sleep })

    expect(sleep).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(429)
  })

  it("returns as soon as a retry succeeds", async () => {
    const send = vi
      .fn<() => Promise<{ status: number }>>()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200))

    const result = await sendWithRetry(send, "PUT", POLICY, { sleep: async () => {} })

    expect(send).toHaveBeenCalledTimes(2)
    expect(result.status).toBe(200)
  })

  it("does not retry what is not retryable", async () => {
    const send = vi.fn(async () => response(400))
    await sendWithRetry(send, "PUT", POLICY, { sleep: async () => {} })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("uses the documented default for the first delay", () => {
    expect(backoffDelayMs(1, { baseDelayMs: DEFAULT_BASE_DELAY_MS, maxDelayMs: 30_000 }, () => 1))
      .toBe(DEFAULT_BASE_DELAY_MS)
  })
})
