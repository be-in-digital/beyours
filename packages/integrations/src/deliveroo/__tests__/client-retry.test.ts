/**
 * `fetchDeliveroo` applies the shared retry policy, inside one token's life.
 *
 * Two defects met here. There was no retry at all — a 429 or a 502 failed the
 * menu push outright — and the token cache never hit: a Deliveroo token lives
 * 300 seconds and the cache demanded 300 seconds of remaining life, so every
 * single API call minted a fresh one. Both matter to a backoff loop: the
 * sequence has to stay inside the token it started with, and it has to be able
 * to reuse that token rather than spending the OAuth endpoint on every attempt.
 *
 * Fake timers throughout: a backoff test that really sleeps times CI out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearTokenCache, fetchDeliveroo, getAccessToken } from "../client"
import type { DeliverooCredentials } from "../types"

const credentials: DeliverooCredentials = {
  clientId: "retry-client",
  clientSecret: "retry-secret",
  sandboxMode: false,
}

/** Deliveroo's real token lifetime. */
const TOKEN_LIFETIME_SECONDS = 300

function tokenResponse(expiresIn = TOKEN_LIFETIME_SECONDS) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "retry-token",
      token_type: "Bearer",
      expires_in: expiresIn,
    }),
  }
}

function apiResponse(status: number, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => "",
    json: async () => ({}),
  }
}

function apiCalls(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.filter((call) => !String(call[0]).includes("oauth2/token"))
}

function tokenCalls(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.filter((call) => String(call[0]).includes("oauth2/token"))
}

describe("fetchDeliveroo retry", () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearTokenCache()
    vi.useFakeTimers()
    mockFetch = vi.fn()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("retries a 429 and returns the eventual success", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(429))
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1", {
      method: "PUT",
      body: { menu: {} },
    })
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(200)
    expect(apiCalls(mockFetch)).toHaveLength(2)
  })

  it("gives up after a bounded number of attempts", async () => {
    mockFetch.mockResolvedValue(apiResponse(429))
    mockFetch.mockResolvedValueOnce(tokenResponse())

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1", {
      method: "PUT",
      body: { menu: {} },
    })
    await vi.runAllTimersAsync()

    expect(apiCalls(mockFetch)).toHaveLength(3)
    expect((await promise).status).toBe(429)
  })

  it("honours X-Deliveroo-RateLimit-Wait-Time-Seconds", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        apiResponse(429, { "x-deliveroo-ratelimit-wait-time-seconds": "20" })
      )
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1")

    await vi.advanceTimersByTimeAsync(19_000)
    expect(apiCalls(mockFetch)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiCalls(mockFetch)).toHaveLength(2)

    await vi.runAllTimersAsync()
    expect((await promise).status).toBe(200)
  })

  it("prefers the platform's own wait header over Retry-After", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        apiResponse(429, {
          "x-deliveroo-ratelimit-wait-time-seconds": "5",
          "retry-after": "40",
        })
      )
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1")

    await vi.advanceTimersByTimeAsync(5_000)
    expect(apiCalls(mockFetch)).toHaveLength(2)

    await vi.runAllTimersAsync()
    expect((await promise).status).toBe(200)
  })

  it("refuses to sleep past the 300-second token it started with", async () => {
    // Ten minutes is longer than the token lives. Waiting it out would mean the
    // last attempt goes out with credentials that expired while it waited, so
    // the sequence ends instead and the caller reschedules.
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(429, { "retry-after": "600" }))

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1")
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(429)
    expect(apiCalls(mockFetch)).toHaveLength(1)
  })

  it("does not replay a POST that may already have been applied", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(502))

    const promise = fetchDeliveroo(
      credentials,
      "/v1/orders/o1",
      { method: "POST", body: {} },
      "order"
    )
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(502)
    expect(apiCalls(mockFetch)).toHaveLength(1)
  })

  it("still refreshes the token on the 403 the gateway sends for a stale one", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(403))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchDeliveroo(credentials, "/v1/brands/b1/menus/m1")
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(200)
    expect(apiCalls(mockFetch)).toHaveLength(2)
  })
})

describe("Deliveroo token cache", () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearTokenCache()
    mockFetch = vi.fn()
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("reuses a real 300-second token instead of minting one per call", async () => {
    // The margin used to be five minutes — a token's entire life — so
    // `expiresAt > now + 300_000` was false the instant the token was minted
    // and the cache returned nothing, ever. Every API call opened with an OAuth
    // round trip, on an endpoint that is itself rate-limited.
    mockFetch.mockResolvedValue(tokenResponse())

    await getAccessToken(credentials)
    await getAccessToken(credentials)
    await getAccessToken(credentials)

    expect(tokenCalls(mockFetch)).toHaveLength(1)
  })

  it("mints a new one once the old is inside the refresh margin", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"))
    mockFetch.mockResolvedValue(tokenResponse())

    await getAccessToken(credentials)
    // 250s in: 50s of life left, inside the one-minute margin.
    vi.setSystemTime(new Date("2026-09-04T12:04:10Z"))
    await getAccessToken(credentials)

    expect(tokenCalls(mockFetch)).toHaveLength(2)
  })
})
