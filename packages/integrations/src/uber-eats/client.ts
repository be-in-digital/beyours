/**
 * Uber Eats API client with OAuth2 client_credentials flow
 */

import type { UberEatsCredentials, UberEatsToken, UberEatsOrder, UberEatsReport, UberEatsDeliveryStatus } from "./types"
import { UBER_EATS_URLS } from "./types"
import { IntegrationError } from "../common/errors"

/**
 * Validate a path parameter to prevent path traversal and SSRF
 */
export function validatePathParam(value: string, paramName: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${paramName} must be a non-empty string`)
  }
  if (!/^[a-zA-Z0-9_\-:.]+$/.test(value)) {
    throw new Error(`${paramName} contains invalid characters`)
  }
  return encodeURIComponent(value)
}

// M-01: Per-credential token cache (supports multi-tenant)
const tokenCache = new Map<string, UberEatsToken>()
// M-02: Dedup concurrent token refresh requests (per-credential)
const pendingTokenRequests = new Map<string, Promise<UberEatsToken>>()

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
  const pending = pendingTokenRequests.get(key)
  if (pending) {
    return pending
  }

  const fetchToken = async (): Promise<UberEatsToken> => {
    const urls = getUrls(credentials.sandboxMode ?? false)
    // Trim credentials to prevent env var whitespace issues
    const clientId = credentials.clientId.trim()
    const clientSecret = credentials.clientSecret.trim()

    const response = await fetchWithTimeout(urls.auth, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        scope: "eats.order eats.report eats.store eats.store.orders.cancel eats.store.status.write eats.store.orders.restaurantdelivery.status eats.store.orders.read",
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new IntegrationError(
        "Uber Eats OAuth failed",
        response.status,
        "uberEats",
        errorText
      )
    }

    const data = await response.json() as {
      access_token: string
      token_type: string
      expires_in: number
      scope: string
    }

    // Validate the token is a non-empty string
    if (!data.access_token || typeof data.access_token !== "string") {
      throw new IntegrationError(
        "Uber Eats OAuth returned an invalid token",
        0,
        "uberEats",
        `access_token was ${JSON.stringify(data.access_token)}`
      )
    }

    const token: UberEatsToken = {
      accessToken: data.access_token.trim(),
      tokenType: data.token_type,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    }

    tokenCache.set(key, token)
    return token
  }

  const promise = fetchToken().finally(() => {
    pendingTokenRequests.delete(key)
  })
  pendingTokenRequests.set(key, promise)
  return promise
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
    `/v2/eats/order/${validatePathParam(orderId, "orderId")}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to fetch Uber Eats order ${orderId}`,
      response.status,
      "uberEats",
      errorText
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
    `/v1/eats/orders/${validatePathParam(orderId, "orderId")}/accept_pos_order`,
    { method: "POST", body: {} }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to accept Uber Eats order ${orderId}`,
      response.status,
      "uberEats",
      errorText
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
    `/v1/eats/orders/${validatePathParam(orderId, "orderId")}/deny_pos_order`,
    { method: "POST", body: { reason } }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to deny Uber Eats order ${orderId}`,
      response.status,
      "uberEats",
      errorText
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
    `/v1/eats/orders/${validatePathParam(orderId, "orderId")}/cancel`,
    { method: "POST", body: { reason } }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to cancel Uber Eats order ${orderId}`,
      response.status,
      "uberEats",
      errorText
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
    `/v1/eats/stores/${validatePathParam(storeId, "storeId")}/status`,
    { method: "POST", body }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to update Uber Eats store status",
      response.status,
      "uberEats",
      errorText
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
    `/v1/eats/stores/${validatePathParam(storeId, "storeId")}/status`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to get Uber Eats store status",
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<{ status: string }>
}

// === Reporting (eats.report) ===

/**
 * Get order-level financial report for a store
 */
export async function getOrdersReport(
  credentials: UberEatsCredentials,
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<UberEatsReport> {
  const safeStoreId = validatePathParam(storeId, "storeId")
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${safeStoreId}/payments/order_level_transactions?${params.toString()}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to fetch Uber Eats orders report",
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<UberEatsReport>
}

/**
 * Get financial summary for a store
 */
export async function getFinancialSummary(
  credentials: UberEatsCredentials,
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<UberEatsReport> {
  const safeStoreId = validatePathParam(storeId, "storeId")
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${safeStoreId}/payments/transactions_summary?${params.toString()}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to fetch Uber Eats financial summary",
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<UberEatsReport>
}

// === Restaurant Delivery Status (eats.store.orders.restaurantdelivery.status) ===

/**
 * Update delivery status for restaurant-managed deliveries.
 * Used when the restaurant handles its own delivery instead of Uber couriers.
 */
export async function updateDeliveryStatus(
  credentials: UberEatsCredentials,
  orderId: string,
  status: UberEatsDeliveryStatus,
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/orders/${validatePathParam(orderId, "orderId")}/restaurantdelivery/status`,
    { method: "POST", body: { status } }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to update delivery status for order ${orderId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}
