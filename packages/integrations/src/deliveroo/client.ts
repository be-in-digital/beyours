/**
 * Deliveroo API client with OAuth2 client_credentials flow (Basic auth)
 */

import type { DeliverooCredentials, DeliverooToken, DeliverooApiType } from "./types"
import { DELIVEROO_URLS } from "./types"

// M-01: Per-credential token cache (supports multi-tenant)
const tokenCache = new Map<string, DeliverooToken>()
// M-02: Dedup concurrent token refresh requests
let pendingTokenRequest: Promise<DeliverooToken> | null = null
let pendingTokenKey: string | null = null

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
  if (pendingTokenRequest && pendingTokenKey === key) {
    return pendingTokenRequest
  }

  const fetchToken = async (): Promise<DeliverooToken> => {
    const urls = getUrls(credentials.sandboxMode ?? false)
    // M-07: RFC 6749 Section 2.3.1 — URL-encode before Base64
    const encodedId = encodeURIComponent(credentials.clientId)
    const encodedSecret = encodeURIComponent(credentials.clientSecret)
    const basicAuth = Buffer.from(`${encodedId}:${encodedSecret}`).toString("base64")

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
      throw new Error(
        `Deliveroo OAuth failed (${response.status}): ${errorText}`
      )
    }

    const data = (await response.json()) as {
      access_token: string
      token_type: string
      expires_in: number
    }

    const token: DeliverooToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
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
