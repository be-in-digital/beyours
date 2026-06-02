/**
 * Uber Eats OAuth 2.0 Authorization Code flow.
 *
 * Used for the eats.pos_provisioning scope, which (unlike all other Eats
 * scopes) requires merchant user consent and cannot be obtained via
 * client_credentials. Flow:
 *   1. Redirect the merchant to buildAuthorizeUrl(...).
 *   2. Uber redirects back to redirect_uri with ?code=...&state=...
 *   3. Call exchangeCodeForToken(...) to get a user-scoped token + refresh token.
 *   4. Use the token for POST /pos_data (activate) and GET /stores (stores-to-user).
 *   5. refreshUserToken(...) when the access token nears expiry.
 */

import type { UberEatsCredentials, UberEatsUserToken } from "./types"
import { UBER_EATS_URLS } from "./types"
import { IntegrationError } from "../common/errors"

const POS_PROVISIONING_SCOPE = "eats.pos_provisioning"
const FETCH_TIMEOUT_MS = 15_000

function getUrls(sandbox: boolean) {
  return sandbox ? UBER_EATS_URLS.sandbox : UBER_EATS_URLS.production
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope: string
}

function toUserToken(data: TokenResponse): UberEatsUserToken {
  if (!data.access_token || typeof data.access_token !== "string") {
    throw new IntegrationError(
      "Uber Eats OAuth returned an invalid token",
      0,
      "uberEats",
      `access_token was ${JSON.stringify(data.access_token)}`
    )
  }
  return {
    accessToken: data.access_token.trim(),
    refreshToken: data.refresh_token?.trim(),
    tokenType: data.token_type,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

/**
 * Build the merchant-facing authorization URL. Redirect the merchant's browser
 * here; after consent Uber redirects to `redirectUri` with `code` and `state`.
 */
export function buildAuthorizeUrl(opts: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
  sandboxMode?: boolean
}): string {
  const urls = getUrls(opts.sandboxMode ?? false)
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId.trim(),
    redirect_uri: opts.redirectUri,
    scope: opts.scope ?? POS_PROVISIONING_SCOPE,
    state: opts.state,
  })
  return `${urls.authorize}?${params.toString()}`
}

/**
 * Exchange an authorization code for a user-scoped token.
 * The redirectUri MUST match the one used in buildAuthorizeUrl.
 */
export async function exchangeCodeForToken(
  credentials: UberEatsCredentials,
  code: string,
  redirectUri: string
): Promise<UberEatsUserToken> {
  const urls = getUrls(credentials.sandboxMode ?? false)
  const response = await fetchWithTimeout(urls.auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: credentials.clientId.trim(),
      client_secret: credentials.clientSecret.trim(),
      redirect_uri: redirectUri,
      code,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Uber Eats authorization code exchange failed",
      response.status,
      "uberEats",
      errorText
    )
  }

  return toUserToken((await response.json()) as TokenResponse)
}

/**
 * Mint a fresh user-scoped token from a refresh token (no user re-consent).
 */
export async function refreshUserToken(
  credentials: UberEatsCredentials,
  refreshToken: string
): Promise<UberEatsUserToken> {
  const urls = getUrls(credentials.sandboxMode ?? false)
  const response = await fetchWithTimeout(urls.auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId.trim(),
      client_secret: credentials.clientSecret.trim(),
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Uber Eats token refresh failed",
      response.status,
      "uberEats",
      errorText
    )
  }

  const token = toUserToken((await response.json()) as TokenResponse)
  // Uber may omit refresh_token on refresh responses; keep the existing one.
  if (!token.refreshToken) token.refreshToken = refreshToken
  return token
}
