/**
 * `fetchUberEats` applies the shared retry policy.
 *
 * Before this it did not. A `429` came straight back to the caller, which threw
 * an `IntegrationError`, which failed the menu push and stamped
 * `menuSyncStatus: "error"` on the establishment. Uber's own limit on
 * `PUT /v2/eats/stores/{id}/menu` is around one call a minute per store, so the
 * status the restaurant saw was routinely "error" for a call that just needed
 * to wait.
 *
 * Fake timers throughout: a backoff test that really sleeps times CI out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearTokenCache, fetchUberEats } from "../client"
import type { UberEatsCredentials } from "../types"

const credentials: UberEatsCredentials = {
  clientId: "retry-client",
  clientSecret: "retry-secret",
  sandboxMode: false,
}

function tokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      access_token: "retry-token",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "eats.store",
    }),
  }
}

function apiResponse(status: number, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => "",
    json: async () => ({}),
  }
}

/** API calls only — the token endpoint is not what these tests are counting. */
function apiCalls(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls.filter(
    (call) => !String(call[0]).includes("oauth/v2/token")
  )
}

describe("fetchUberEats retry", () => {
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

    const promise = fetchUberEats(credentials, "/v1/eats/stores")
    await vi.runAllTimersAsync()
    const response = await promise

    expect(response.status).toBe(200)
    expect(apiCalls(mockFetch)).toHaveLength(2)
  })

  it("gives up after a bounded number of attempts", async () => {
    mockFetch.mockResolvedValue(apiResponse(429))
    mockFetch.mockResolvedValueOnce(tokenResponse())

    const promise = fetchUberEats(credentials, "/v2/eats/stores/s1/menu", {
      method: "PUT",
      body: { menus: [] },
    })
    await vi.runAllTimersAsync()
    const response = await promise

    // Three attempts, then the 429 is handed back so the caller can raise an
    // IntegrationError carrying Uber's own body. Never an unbounded loop.
    expect(apiCalls(mockFetch)).toHaveLength(3)
    expect(response.status).toBe(429)
  })

  it("waits the time Retry-After asked for, and not less", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(429, { "retry-after": "30" }))
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchUberEats(credentials, "/v1/eats/stores")

    // Almost there — the retry must not have fired yet.
    await vi.advanceTimersByTimeAsync(29_000)
    expect(apiCalls(mockFetch)).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiCalls(mockFetch)).toHaveLength(2)

    await vi.runAllTimersAsync()
    expect((await promise).status).toBe(200)
  })

  it("retries a 5xx on an idempotent menu upload", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(503))
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchUberEats(credentials, "/v2/eats/stores/s1/menu", {
      method: "PUT",
      body: { menus: [] },
    })
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(200)
    expect(apiCalls(mockFetch)).toHaveLength(2)
  })

  it("does not replay a POST that may already have been applied", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(502))

    const promise = fetchUberEats(credentials, "/v1/delivery/order/o1/accept", {
      method: "POST",
      body: {},
    })
    await vi.runAllTimersAsync()

    // A 502 on accept may mean the order WAS accepted and the reply was lost.
    expect((await promise).status).toBe(502)
    expect(apiCalls(mockFetch)).toHaveLength(1)
  })

  it("leaves a 4xx that a retry cannot fix alone", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(400))

    const promise = fetchUberEats(credentials, "/v1/eats/stores")
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(400)
    expect(apiCalls(mockFetch)).toHaveLength(1)
  })

  it("still refreshes the token once on a 401", async () => {
    mockFetch
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(401))
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(apiResponse(200))

    const promise = fetchUberEats(credentials, "/v1/eats/stores")
    await vi.runAllTimersAsync()

    expect((await promise).status).toBe(200)
    expect(apiCalls(mockFetch)).toHaveLength(2)
  })
})
