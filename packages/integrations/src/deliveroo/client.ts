/**
 * Deliveroo API client with OAuth2 client_credentials flow (Basic auth)
 */

import type { DeliverooCredentials, DeliverooToken, DeliverooApiType } from "./types"
import { DELIVEROO_URLS } from "./types"

// Token cache (in-memory, per-process)
let cachedToken: DeliverooToken | null = null

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
    default:
      return urls.menuApi
  }
}

/**
 * Obtain an OAuth2 access token using client_credentials grant with Basic auth
 */
export async function getAccessToken(
  credentials: DeliverooCredentials
): Promise<DeliverooToken> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken
  }

  const urls = getUrls(credentials.sandboxMode ?? false)
  const basicAuth = btoa(`${credentials.clientId}:${credentials.clientSecret}`)

  const response = await fetch(`${urls.auth}/oauth2/token`, {
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

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return cachedToken
}

/**
 * Clear the cached token (useful after 401 errors)
 */
export function clearTokenCache(): void {
  cachedToken = null
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

  const response = await fetch(url, fetchOptions)

  // If token expired, retry once with fresh token
  if (response.status === 401) {
    clearTokenCache()
    const newToken = await getAccessToken(credentials)
    headers.Authorization = `Bearer ${newToken.accessToken}`

    return fetch(url, {
      ...fetchOptions,
      headers,
    })
  }

  return response
}
