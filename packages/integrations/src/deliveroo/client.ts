/**
 * Deliveroo API client with OAuth2 client_credentials flow (Basic auth)
 */

import type { DeliverooCredentials, DeliverooToken, DeliverooApiType } from "./types"
import { DELIVEROO_URLS } from "./types"
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
const tokenCache = new Map<string, DeliverooToken>()
// M-02: Dedup concurrent token refresh requests (per-credential)
const pendingTokenRequests = new Map<string, Promise<DeliverooToken>>()

const FETCH_TIMEOUT_MS = 15_000

function getCacheKey(credentials: DeliverooCredentials): string {
  return `${credentials.clientId}:${credentials.sandboxMode ? "sandbox" : "prod"}`
}

/**
 * Get API URLs based on sandbox mode
 */
function getUrls(sandbox: boolean) {
  return sandbox ? DELIVEROO_URLS.sandbox : DELIVEROO_URLS.production
}

/**
 * Get base URL for a specific API type
 */
function getBaseUrl(sandbox: boolean, apiType: DeliverooApiType): string {
  const urls = getUrls(sandbox)
  switch (apiType) {
    case "order":
      return urls.orderApi
    case "menu":
      return urls.menuApi
    case "site":
      return urls.siteApi
  }
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
 * Obtain an OAuth2 access token using client_credentials grant with Basic auth
 */
export async function getAccessToken(
  credentials: DeliverooCredentials
): Promise<DeliverooToken> {
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

  const fetchToken = async (): Promise<DeliverooToken> => {
    const urls = getUrls(credentials.sandboxMode ?? false)
    // Trim credentials to prevent env var whitespace issues
    const clientId = credentials.clientId.trim()
    const clientSecret = credentials.clientSecret.trim()
    // Standard Basic auth: Base64(clientId:clientSecret)
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

    const response = await fetchWithTimeout(`${urls.auth}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new IntegrationError(
        "Deliveroo OAuth failed",
        response.status,
        "deliveroo",
        errorText
      )
    }

    const data = (await response.json()) as {
      access_token: string
      token_type: string
      expires_in: number
    }

    // Validate the token is a non-empty string
    if (!data.access_token || typeof data.access_token !== "string") {
      throw new IntegrationError(
        "Deliveroo OAuth returned an invalid token",
        0,
        "deliveroo",
        `access_token was ${JSON.stringify(data.access_token)}`
      )
    }

    const accessToken = data.access_token.trim()

    const token: DeliverooToken = {
      accessToken,
      expiresAt: Date.now() + data.expires_in * 1000,
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
export function clearTokenCache(credentials?: DeliverooCredentials): void {
  if (credentials) {
    tokenCache.delete(getCacheKey(credentials))
  } else {
    tokenCache.clear()
  }
}

/**
 * Fetch wrapper for Deliveroo API with automatic auth
 */
export async function fetchDeliveroo(
  credentials: DeliverooCredentials,
  path: string,
  options: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {},
  apiType: DeliverooApiType = "menu"
): Promise<Response> {
  const token = await getAccessToken(credentials)
  const sandbox = credentials.sandboxMode ?? false
  const baseUrl = getBaseUrl(sandbox, apiType)
  const url = `${baseUrl}${path}`

  // Strip any whitespace from token (defensive, matches base-theme pattern)
  const normalizedToken = token.accessToken.replace(/\s+/g, "")
  const method = options.method ?? "GET"

  const headers: Record<string, string> = {
    Authorization: `Bearer ${normalizedToken}`,
    Accept: "application/json",
    Connection: "close",
    ...options.headers,
  }

  // Only set Content-Type for requests with a body
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json"
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  console.log(`[DeliverooAPI] ${method} ${url} body=${fetchOptions.body ?? "none"} token_prefix=${normalizedToken.substring(0, 10)}...`)

  const response = await fetchWithTimeout(url, fetchOptions)

  console.log(`[DeliverooAPI] Response: ${response.status} ${response.statusText}`)

  // If token expired/rejected, retry once with fresh token.
  // Deliveroo gateway returns 403 (not 401) for invalid/expired tokens.
  if (response.status === 401 || response.status === 403) {
    // M-03: Consume the body to release the connection
    await response.text().catch(() => {})
    clearTokenCache(credentials)
    const newToken = await getAccessToken(credentials)
    headers.Authorization = `Bearer ${newToken.accessToken.replace(/\s+/g, "")}`

    return fetchWithTimeout(url, {
      ...fetchOptions,
      headers,
    })
  }

  return response
}
