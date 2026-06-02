/**
 * Uber Eats API client with OAuth2 client_credentials flow
 */

import type { UberEatsCredentials, UberEatsToken, UberEatsOrder } from "./types"
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
        // Scopes granted to the BeInDigital test client by Uber (verified against sandbox 2026-06-01).
        // NOT yet granted by Uber (the token request 400s if requested):
        //   - eats.pos_provisioning (needed for POST /v1/eats/stores/{id}/pos_data — Activate Integration)
        //   - any menu/promotions write scope
        // Ask Uber to grant these on the test client BN3BbPRSpD7-TNs5DqC6fyq20n3rVLCF before re-testing.
        scope: [
          "eats.store",
          "eats.store.orders.read",
          "eats.store.orders.cancel",
          "eats.store.status.write",
          "eats.order",
          "eats.report",
        ].join(" "),
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
    /**
     * Pre-obtained access token to use instead of minting a client_credentials
     * one. Pass this for user-scoped (Authorization Code) calls such as
     * eats.pos_provisioning endpoints. When set, the 401 auto-refresh is
     * skipped (the caller owns refreshing the user token).
     */
    accessToken?: string
  } = {}
): Promise<Response> {
  const usingUserToken = typeof options.accessToken === "string" && options.accessToken.length > 0
  const token = usingUserToken
    ? { accessToken: options.accessToken as string }
    : await getAccessToken(credentials)
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

  // If a client_credentials token expired, retry once with a fresh token.
  // User-scoped tokens are not refreshed here — the caller owns that.
  if (response.status === 401 && !usingUserToken) {
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
 * Fetch order details — legacy Order API (Previous Version).
 * GET /v2/eats/order/{order_id}
 * Still used by the webhook handler + mapUberEatsOrderToUnified (that mapper
 * parses this v2 shape). Do not change the path without updating the mapper.
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
 * Get order details — Order API Suite (uAPI).
 * GET /v1/delivery/order/{order_id}
 * Returns the new uAPI order shape (different from fetchOrder's v2 shape).
 */
export async function fetchOrderUAPI(
  credentials: UberEatsCredentials,
  orderId: string
): Promise<Record<string, unknown>> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to get Uber Eats order ${orderId} (uAPI)`,
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<Record<string, unknown>>
}

/**
 * Accept an order (Order API Suite / uAPI).
 * POST /v1/delivery/order/{orderId}/accept
 */
export async function acceptOrder(
  credentials: UberEatsCredentials,
  orderId: string
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}/accept`,
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
 * Deny an order (Order API Suite / uAPI).
 * POST /v1/delivery/order/{orderId}/deny
 * Body shape to be confirmed against a live order during validation.
 */
export async function denyOrder(
  credentials: UberEatsCredentials,
  orderId: string,
  reason: { explanation: string; code: string }
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}/deny`,
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
 * Cancel an order (Order API Suite / uAPI).
 * POST /v1/delivery/order/{orderId}/cancel
 */
export async function cancelOrder(
  credentials: UberEatsCredentials,
  orderId: string,
  reason: { explanation: string; code: string }
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}/cancel`,
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
 * Mark an order as ready for pickup (Order API Suite / uAPI).
 * POST /v1/delivery/order/{orderId}/ready
 *
 * Path verified against test-api.uber.com 2026-06-01: route exists (returns
 * "order not found" for a dummy id). The earlier /v1/eats/orders/.../
 * mark_order_as_ready_for_pickup path does NOT exist — Uber moved order
 * actions to the /v1/delivery/order/ suite.
 */
export async function markOrderAsReady(
  credentials: UberEatsCredentials,
  orderId: string
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}/ready`,
    { method: "POST", body: {} }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to mark Uber Eats order ${orderId} as ready`,
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

  // NOTE: store status uses the SINGULAR "store" path segment, unlike most
  // other store endpoints which use "stores". Verified 200 against sandbox
  // 2026-06-01; the plural form returns "404 page not found".
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/store/${validatePathParam(storeId, "storeId")}/status`,
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
  // Singular "store" path segment — see updateStoreStatus note.
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/store/${validatePathParam(storeId, "storeId")}/status`
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

// ============================================================
// Integration Config — required by Uber for production validation
// ============================================================

export interface ActivateIntegrationPayload {
  integration_enabled: boolean
  integrator_store_id: string
  integrator_brand_id?: string
  merchant_store_id?: string
  store_configuration_data?: string
}

export interface IntegrationDetails {
  integration_enabled: boolean
  integrator_store_id?: string
  integrator_brand_id?: string
  merchant_store_id?: string
  store_configuration_data?: string
  [key: string]: unknown
}

export interface UberStoreSummary {
  store_id: string
  name: string
  location?: {
    address?: string
    city?: string
    country?: string
    postal_code?: string
  }
  contact_emails?: string[]
  [key: string]: unknown
}

export interface StoresListResponse {
  stores: UberStoreSummary[]
  next_page_token?: string
}

/**
 * Activate (or update) the POS integration on a store.
 * POST /v1/eats/stores/{store_id}/pos_data
 *
 * Requires a user-scoped token (eats.pos_provisioning, Authorization Code flow).
 * Pass it via `accessToken`; a client_credentials token will get a 401.
 */
export async function activateIntegration(
  credentials: UberEatsCredentials,
  storeId: string,
  payload: ActivateIntegrationPayload,
  accessToken?: string
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${validatePathParam(storeId, "storeId")}/pos_data`,
    { method: "POST", body: payload, accessToken }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to activate Uber Eats integration on store ${storeId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}

/**
 * Get integration details for a store.
 * GET /v1/eats/stores/{store_id}/pos_data
 */
export async function getIntegrationDetails(
  credentials: UberEatsCredentials,
  storeId: string
): Promise<IntegrationDetails> {
  const response = await fetchUberEats(
    credentials,
    `/v1/eats/stores/${validatePathParam(storeId, "storeId")}/pos_data`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to get Uber Eats integration details for store ${storeId}`,
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<IntegrationDetails>
}

/**
 * List the stores the OAuth-authorized user/app has access to.
 * GET /v1/eats/stores
 *
 * With a client_credentials token this returns stores authorized to the app.
 * With a user-scoped token (eats.pos_provisioning), pass it via `accessToken`
 * to return the stores that specific merchant user granted ("stores to user").
 */
export async function getStoresForUser(
  credentials: UberEatsCredentials,
  options: { limit?: number; pageToken?: string; accessToken?: string } = {}
): Promise<StoresListResponse> {
  const params = new URLSearchParams()
  if (options.limit) params.set("limit", String(options.limit))
  if (options.pageToken) params.set("page_token", options.pageToken)
  const qs = params.toString()
  const path = qs ? `/v1/eats/stores?${qs}` : "/v1/eats/stores"

  const response = await fetchUberEats(credentials, path, { accessToken: options.accessToken })

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to list Uber Eats stores for user",
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<StoresListResponse>
}

// ============================================================
// Menu — granular item/modifier update
// ============================================================

/**
 * Update a single menu item (price, suspension, etc.) without re-pushing the whole menu.
 * POST /v2/eats/stores/{store_id}/menus/items/{item_id}
 */
export async function updateMenuItem(
  credentials: UberEatsCredentials,
  storeId: string,
  itemId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v2/eats/stores/${validatePathParam(storeId, "storeId")}/menus/items/${validatePathParam(itemId, "itemId")}`,
    { method: "POST", body: payload }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to update Uber Eats menu item ${itemId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}

/**
 * Update a modifier group on a store menu.
 * POST /v2/eats/stores/{store_id}/menus/modifier_groups/{modifier_group_id}
 */
export async function updateModifierGroup(
  credentials: UberEatsCredentials,
  storeId: string,
  modifierGroupId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v2/eats/stores/${validatePathParam(storeId, "storeId")}/menus/modifier_groups/${validatePathParam(modifierGroupId, "modifierGroupId")}`,
    { method: "POST", body: payload }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to update Uber Eats modifier group ${modifierGroupId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}

// ============================================================
// Promotions — create
// ============================================================

/**
 * Create a promotion on a store (Promotions API Suite).
 * POST /v1/delivery/stores/{store_id}/promotion
 *
 * Path verified 2026-06-01: route exists but requires the
 * `eats.store.promotion.write` scope, which is NOT yet granted to the test
 * client (token request 400s on any promotion scope). Uber must grant it.
 */
export async function createPromotion(
  credentials: UberEatsCredentials,
  storeId: string,
  payload: Record<string, unknown>,
  accessToken?: string
): Promise<unknown> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/stores/${validatePathParam(storeId, "storeId")}/promotion`,
    { method: "POST", body: payload, accessToken }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to create Uber Eats promotion on store ${storeId}`,
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json().catch(() => ({}))
}

// ============================================================
// Reporting — request report file
// ============================================================

export interface ReportRequest {
  report_type: string
  start_date: string
  end_date: string
  store_uuids?: string[]
  [key: string]: unknown
}

/**
 * Request a report. Uber generates the file asynchronously and sends an
 * "eats.report.success" webhook with the download URL when ready.
 * POST /v1/eats/report
 */
export async function requestReport(
  credentials: UberEatsCredentials,
  payload: ReportRequest
): Promise<{ workflow_id?: string; [key: string]: unknown }> {
  const response = await fetchUberEats(
    credentials,
    "/v1/eats/report",
    { method: "POST", body: payload }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to request Uber Eats report",
      response.status,
      "uberEats",
      errorText
    )
  }

  return response.json() as Promise<{ workflow_id?: string }>
}

// ============================================================
// Order — Resolve Fulfillment Issues (recommended)
// ============================================================

export interface FulfillmentIssueResolution {
  fulfillment_issues: Array<{
    issue_type: "OUT_OF_ITEM" | "PARTIAL_AVAILABILITY" | "FOUND_ITEM" | string
    item_id?: string
    action_type?: string
    available_quantity?: number
    [key: string]: unknown
  }>
}

/**
 * Resolve fulfillment issues on an active order (Order API Suite / uAPI).
 * POST /v1/delivery/order/{order_id}/resolve-fulfillment-issues
 * Customer is notified in the Uber Eats app and can cancel or accept changes.
 *
 * Path verified 2026-06-01: route exists (returns 400 for an empty body,
 * i.e. it validates the payload). Body shape to confirm against a live order.
 */
export async function resolveFulfillmentIssues(
  credentials: UberEatsCredentials,
  orderId: string,
  payload: FulfillmentIssueResolution
): Promise<void> {
  const response = await fetchUberEats(
    credentials,
    `/v1/delivery/order/${validatePathParam(orderId, "orderId")}/resolve-fulfillment-issues`,
    { method: "POST", body: payload }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to resolve fulfillment issues for order ${orderId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}
