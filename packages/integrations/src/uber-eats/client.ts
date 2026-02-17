/**
 * Uber Eats API client with OAuth2 client_credentials flow
 */

import type { UberEatsCredentials, UberEatsToken, UberEatsOrder } from "./types"
import { UBER_EATS_URLS } from "./types"

// M-01: Per-credential token cache (supports multi-tenant)
const tokenCache = new Map<string, UberEatsToken>()
// M-02: Dedup concurrent token refresh requests
let pendingTokenRequest: Promise<UberEatsToken> | null = null
let pendingTokenKey: string | null = null

const FETCH_TIMEOUT_MS = 15_000

function getCacheKey(credentials: UberEatsCredentials): string {
  return `${credentials.clientId}:${credentials.sandboxMode ? "sandbox" : "prod"}`
}

/**
 * Get API base URL based on sandbox mode
 */
function getUrls(sandbox: boolean) {
  return sandbox ? UBER_EATS_URLS.sandbox : UBER_EATS_URLS.production
}

/**
 * Create a fetch request with timeout (M-06)
 */
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId)
  })
}

/**
 * Obtain an OAuth2 access token using client_credentials grant
 */
export async function getAccessToken(
  credentials: UberEatsCredentials
): Promise<UberEatsToken> {
  const key = getCacheKey(credentials)

  // Return cached token if still valid (with 5 min buffer)
  const cached = tokenCache.get(key)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached
  }

  // M-02: If a token request is already in flight for this key, reuse it
  if (pendingTokenRequest && pendingTokenKey === key) {
    return pendingTokenRequest
  }

  const fetchToken = async (): Promise<UberEatsToken> => {
    const urls = getUrls(credentials.sandboxMode ?? false)

    const response = await fetchWithTimeout(urls.auth, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "client_credentials",
        scope: "eats.store eats.order eats.store.orders.read eats.store.orders.cancel eats.store.status.write",
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Uber Eats OAuth failed (${response.status}): ${errorText}`
      )
    }

    const data = await response.json() as {
      access_token: string
      token_type: string
      expires_in: number
      scope: string
    }

    const token: UberEatsToken = {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    }

    tokenCache.set(key, token)
    return token
  }

  pendingTokenKey = key
  pendingTokenRequest = fetchToken().finally(() => {
    pendingTokenRequest = null
    pendingTokenKey = null
  })

  return pendingTokenRequest
}

/**
 * Clear the cached token (useful after 401 errors)
 */
export function clearTokenCache(credentials?: UberEatsCredentials): void {
  if (credentials) {
    tokenCache.delete(getCacheKey(credentials))
  } else {
    tokenCache.clear()
  }
}

/**
 * Fetch wrapper for Uber Eats API with automatic auth
 */
export async function fetchUberEats(
  credentials: UberEatsCredentials,
  path: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
): Promise<Response> {
  const token = await getAccessToken(credentials)
  const urls = getUrls(credentials.sandboxMode ?? false)
  const url = `${urls.api}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.accessToken}`,
    "Content-Type": "application/json",
    ...options.headers,
  }

  const fetchOptions: RequestInit = {
    method: options.method ?? "GET",
    headers,
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetchWithTimeout(url, fetchOptions)

  // If token expired, retry once with fresh token
  if (response.status === 401) {
    // M-03: Consume the body to release the connection
    await response.text().catch(() => {})
    clearTokenCache(credentials)
    const newToken = await getAccessToken(credentials)
    headers.Authorization = `Bearer ${newToken.accessToken}`

    return fetchWithTimeout(url, {
      ...fetchOptions,
      headers,
    })
  }

  return response
}

/**
 * Fetch order details from Uber Eats API
 */
export async function fetchOrder(
  credentials: UberEatsCredentials,
  orderId: string
): Promise<UberEatsOrder> {
  const response = await fetchUberEats(
    credentials,
    `/v2/eats/order/${orderId}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to fetch order ${orderId} (${response.status}): ${errorText}`
    )
  }

  return response.json() as Promise<UberEatsOrder>
}

/**
 * Accept an order
 */
export async function acceptOrder(
  credentials: UberEatsCredentials,
  orderId: string
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/orders/${orderId}/accept`,
    { method: "POST", body: {} }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to accept order ${orderId} (${response.status}): ${errorText}`
    )
  }
}

/**
 * Deny an order
 */
export async function denyOrder(
  credentials: UberEatsCredentials,
  orderId: string,
  reason: { explanation: string; code: string }
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/orders/${orderId}/deny`,
    { method: "POST", body: { reason } }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to deny order ${orderId} (${response.status}): ${errorText}`
    )
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  credentials: UberEatsCredentials,
  orderId: string,
  reason: { explanation: string; code: string }
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/orders/${orderId}/cancel`,
    { method: "POST", body: { reason } }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to cancel order ${orderId} (${response.status}): ${errorText}`
    )
  }
}

/**
 * Update store status (ONLINE, PAUSED, OFFLINE)
 */
export async function updateStoreStatus(
  credentials: UberEatsCredentials,
  storeId: string,
  status: "ONLINE" | "PAUSED" | "OFFLINE",
  reason?: string
): Promise<void> {
  const body: Record<string, unknown> = { status }
  if (reason) body.reason = reason

  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${storeId}/status`,
    { method: "POST", body }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to update store status (${response.status}): ${errorText}`
    )
  }
}

/**
 * Get store status
 */
export async function getStoreStatus(
  credentials: UberEatsCredentials,
  storeId: string
): Promise<{ status: string }> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${storeId}/status`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Failed to get store status (${response.status}): ${errorText}`
    )
  }

  return response.json() as Promise<{ status: string }>
}
