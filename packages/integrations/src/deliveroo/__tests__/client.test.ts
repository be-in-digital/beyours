/**
 * Tests for Deliveroo API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getAccessToken,
  clearTokenCache,
  fetchDeliveroo,
} from '../client'
import type { DeliverooCredentials } from '../types'

const BRAND_ID = '13eaa505-f059-479f-8ada-c24a1f9c56ec'
const SITE_ID = '101'

const mockCredentials: DeliverooCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  sandboxMode: false,
}

describe('Deliveroo API Client', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearTokenCache()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getAccessToken', () => {
    it('should obtain OAuth token with Basic auth', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })

      const token = await getAccessToken(mockCredentials)

      expect(token.accessToken).toBe('test-access-token')
      expect(token.expiresAt).toBeGreaterThan(Date.now())

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://auth.developers.deliveroo.com/oauth2/token')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

      // Verify Basic auth header: Base64(clientId:clientSecret)
      const expectedBasicAuth = Buffer.from('test-client-id:test-client-secret').toString('base64')
      expect(options.headers.Authorization).toBe(`Basic ${expectedBasicAuth}`)

      expect(options.body).toContain('grant_type=client_credentials')
    })

    it('should cache token and reuse it', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'cached-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      const token1 = await getAccessToken(mockCredentials)
      const token2 = await getAccessToken(mockCredentials)

      expect(token1.accessToken).toBe(token2.accessToken)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should refresh token when cache expires', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'expired-token',
            token_type: 'Bearer',
            expires_in: -1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'fresh-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
        })

      await getAccessToken(mockCredentials)
      await new Promise((resolve) => setTimeout(resolve, 10))

      const token2 = await getAccessToken(mockCredentials)

      expect(token2.accessToken).toBe('fresh-token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error on failed OAuth request (400 invalid_client)', async () => {
      // Real Deliveroo returns 400 with {"error":"invalid_client"} for bad credentials
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_client"}',
      })

      await expect(getAccessToken(mockCredentials)).rejects.toThrow(
        'Deliveroo OAuth failed'
      )
    })

    it('should use sandbox auth URL when sandboxMode is true', async () => {
      const sandboxCredentials: DeliverooCredentials = {
        ...mockCredentials,
        sandboxMode: true,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'sandbox-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      await getAccessToken(sandboxCredentials)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://auth-sandbox.developers.deliveroo.com/oauth2/token')
    })

    it('should use production auth URL when sandboxMode is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'prod-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      await getAccessToken(mockCredentials)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://auth.developers.deliveroo.com/oauth2/token')
    })
  })

  describe('clearTokenCache', () => {
    it('should clear the cached token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      clearTokenCache()

      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetchDeliveroo', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })
    })

    it('should add authorization header with Bearer token', async () => {
      await fetchDeliveroo(mockCredentials, `/v1/brands/${BRAND_ID}/menus`)

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('api.developers.deliveroo.com')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.headers.Authorization).toBe('Bearer test-token')
      expect(options.headers.Accept).toBe('application/json')
    })

    it('should handle GET requests to menu API', async () => {
      await fetchDeliveroo(
        mockCredentials,
        `/v1/brands/${BRAND_ID}/menus`,
        {},
        'menu'
      )

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${BRAND_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [url, options] = apiCall!
      expect(url).toBe(
        `https://api.developers.deliveroo.com/menu/v1/brands/${BRAND_ID}/menus`
      )
      expect(options.method).toBe('GET')
    })

    it('should use sandbox URL when sandboxMode is true', async () => {
      const sandboxCredentials: DeliverooCredentials = {
        ...mockCredentials,
        sandboxMode: true,
      }

      clearTokenCache()

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'sandbox-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })

      await fetchDeliveroo(
        sandboxCredentials,
        `/v1/brands/${BRAND_ID}/menus`,
        {},
        'menu'
      )

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${BRAND_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [url] = apiCall!
      expect(url).toBe(
        `https://api-sandbox.developers.deliveroo.com/menu/v1/brands/${BRAND_ID}/menus`
      )
    })

    it('should handle POST requests with body', async () => {
      const body = { menus: [] }

      await fetchDeliveroo(
        mockCredentials,
        `/v1/brands/${BRAND_ID}/menus`,
        { method: 'POST', body },
        'menu'
      )

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${BRAND_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify(body))
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('should retry with fresh token on 401 error', async () => {
      let apiCallCount = 0

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: apiCallCount === 0 ? 'old-token' : 'new-token',
              token_type: 'Bearer',
              expires_in: 3600,
            }),
          })
        }

        apiCallCount++
        if (apiCallCount === 1) {
          // M-03: Client now consumes body on 401 before retry
          return Promise.resolve({ ok: false, status: 401, text: async () => '' })
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      })

      const response = await fetchDeliveroo(
        mockCredentials,
        `/v1/brands/${BRAND_ID}/menus`
      )

      expect(response.ok).toBe(true)
      expect(apiCallCount).toBe(2)
    })

    it('should route to different base URLs based on apiType', async () => {
      await fetchDeliveroo(
        mockCredentials,
        `/v1/orders/123`,
        {},
        'order'
      )

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('/v1/orders/123')
      )

      expect(apiCall).toBeDefined()
      const [url] = apiCall!
      expect(url).toBe('https://api.developers.deliveroo.com/order/v1/orders/123')
    })

    it('should include custom headers', async () => {
      await fetchDeliveroo(
        mockCredentials,
        `/v1/brands/${BRAND_ID}/menus`,
        {
          headers: { 'X-Custom-Header': 'custom-value' },
        }
      )

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${BRAND_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.headers['X-Custom-Header']).toBe('custom-value')
      expect(options.headers.Authorization).toBe('Bearer test-token')
    })
  })
})
