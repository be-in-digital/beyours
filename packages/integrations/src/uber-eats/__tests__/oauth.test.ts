/**
 * Tests for the Uber Eats OAuth Authorization Code flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildAuthorizeUrl, exchangeCodeForToken, refreshUserToken } from '../oauth'
import type { UberEatsCredentials } from '../types'

const sandboxCreds: UberEatsCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  sandboxMode: true,
}

describe('Uber Eats OAuth', () => {
  describe('buildAuthorizeUrl', () => {
    it('builds a sandbox authorize URL with pos_provisioning scope by default', () => {
      const url = buildAuthorizeUrl({
        clientId: 'test-client-id',
        redirectUri: 'https://example.convex.site/connect/uber-eats/callback',
        state: 'abc123',
        sandboxMode: true,
      })
      expect(url.startsWith('https://sandbox-login.uber.com/oauth/v2/authorize?')).toBe(true)
      const parsed = new URL(url)
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
      expect(parsed.searchParams.get('scope')).toBe('eats.pos_provisioning')
      expect(parsed.searchParams.get('state')).toBe('abc123')
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://example.convex.site/connect/uber-eats/callback'
      )
    })

    it('uses the production authorize host when not sandbox', () => {
      const url = buildAuthorizeUrl({
        clientId: 'c',
        redirectUri: 'https://x/cb',
        state: 's',
        sandboxMode: false,
      })
      expect(url.startsWith('https://login.uber.com/oauth/v2/authorize?')).toBe(true)
    })
  })

  describe('exchangeCodeForToken / refreshUserToken', () => {
    let mockFetch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('exchanges an authorization code for a user token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'user-access',
          refresh_token: 'user-refresh',
          token_type: 'Bearer',
          expires_in: 2592000,
          scope: 'eats.pos_provisioning',
        }),
      })

      const token = await exchangeCodeForToken(sandboxCreds, 'auth-code', 'https://x/cb')

      expect(token.accessToken).toBe('user-access')
      expect(token.refreshToken).toBe('user-refresh')
      expect(token.expiresAt).toBeGreaterThan(Date.now())

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://sandbox-login.uber.com/oauth/v2/token')
      expect(options.body).toContain('grant_type=authorization_code')
      expect(options.body).toContain('code=auth-code')
    })

    it('throws on a failed code exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      })
      await expect(
        exchangeCodeForToken(sandboxCreds, 'bad-code', 'https://x/cb')
      ).rejects.toThrow('Uber Eats authorization code exchange failed')
    })

    it('refreshes a user token and preserves the refresh token if omitted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          token_type: 'Bearer',
          expires_in: 2592000,
          scope: 'eats.pos_provisioning',
        }),
      })

      const token = await refreshUserToken(sandboxCreds, 'old-refresh')

      expect(token.accessToken).toBe('new-access')
      expect(token.refreshToken).toBe('old-refresh') // preserved
      const [, options] = mockFetch.mock.calls[0]
      expect(options.body).toContain('grant_type=refresh_token')
      expect(options.body).toContain('refresh_token=old-refresh')
    })
  })
})
