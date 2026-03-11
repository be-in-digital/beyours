/**
 * Tests for Uber Eats API client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getAccessToken,
  clearTokenCache,
  fetchUberEats,
  fetchOrder,
  acceptOrder,
  denyOrder,
  cancelOrder,
  updateStoreStatus,
  getStoreStatus,
} from '../client'
import type { UberEatsCredentials, UberEatsOrder } from '../types'

const STORE_ID = '480eab8c-cc25-4c2b-b92f-70d7a1984f97'

const mockCredentials: UberEatsCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  sandboxMode: false,
}

describe('Uber Eats API Client', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Clear token cache before each test
    clearTokenCache()

    // Mock global fetch
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getAccessToken', () => {
    it('should obtain OAuth token successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'eats.store eats.store.orders.read',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      })

      const token = await getAccessToken(mockCredentials)

      expect(token.accessToken).toBe('test-access-token')
      expect(token.tokenType).toBe('Bearer')
      expect(token.scope).toBe('eats.store eats.store.orders.read')
      expect(token.expiresAt).toBeGreaterThan(Date.now())

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://login.uber.com/oauth/v2/token')
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      expect(options.body).toContain('client_id=test-client-id')
      expect(options.body).toContain('client_secret=test-client-secret')
      expect(options.body).toContain('grant_type=client_credentials')
    })

    it('should cache token and reuse it', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'eats.store',
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      })

      // First call
      const token1 = await getAccessToken(mockCredentials)

      // Second call (should use cache)
      const token2 = await getAccessToken(mockCredentials)

      expect(token1.accessToken).toBe(token2.accessToken)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once
    })

    it('should refresh token when cache expires', async () => {
      const expiredTokenResponse = {
        access_token: 'expired-token',
        token_type: 'Bearer',
        expires_in: -1, // Already expired
        scope: 'eats.store',
      }

      const freshTokenResponse = {
        access_token: 'fresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'eats.store',
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => expiredTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => freshTokenResponse,
        })

      // First call (expired token)
      await getAccessToken(mockCredentials)

      // Small delay to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second call should fetch new token
      const token2 = await getAccessToken(mockCredentials)

      expect(token2.accessToken).toBe('fresh-token')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error on failed OAuth request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials',
      })

      await expect(getAccessToken(mockCredentials)).rejects.toThrow(
        'Uber Eats OAuth failed'
      )
    })

    it('should use sandbox URLs when sandboxMode is true', async () => {
      const sandboxCredentials: UberEatsCredentials = {
        ...mockCredentials,
        sandboxMode: true,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'sandbox-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'eats.store',
        }),
      })

      await getAccessToken(sandboxCredentials)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('https://sandbox-login.uber.com/oauth/v2/token')
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
          scope: 'eats.store',
        }),
      })

      // Get token (cached)
      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Get again (should use cache)
      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Clear cache
      clearTokenCache()

      // Get again (should fetch new token)
      await getAccessToken(mockCredentials)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetchUberEats', () => {
    beforeEach(() => {
      // Mock token endpoint
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })
    })

    it('should add authorization header', async () => {
      await fetchUberEats(mockCredentials, '/v2/eats/order/123')

      // Find the API call (not the auth call)
      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('api.uber.com')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.headers.Authorization).toBe('Bearer test-token')
    })

    it('should handle GET requests', async () => {
      await fetchUberEats(mockCredentials, '/v2/eats/order/123')

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('api.uber.com')
      )

      expect(apiCall).toBeDefined()
      const [url, options] = apiCall!
      expect(url).toBe('https://api.uber.com/v2/eats/order/123')
      expect(options.method).toBe('GET')
    })

    it('should handle POST requests with body', async () => {
      const body = { status: 'ONLINE' }

      await fetchUberEats(mockCredentials, '/v1/eats/stores/123/status', {
        method: 'POST',
        body,
      })

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('api.uber.com/v1/eats/stores')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(options.body).toBe(JSON.stringify(body))
      expect(options.headers['Content-Type']).toBe('application/json')
    })

    it('should retry with fresh token on 401 error', async () => {
      let callCount = 0

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: callCount === 0 ? 'old-token' : 'new-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }

        callCount++
        if (callCount === 1) {
          // First API call fails with 401 — M-03: client consumes body before retry
          return Promise.resolve({ ok: false, status: 401, text: async () => '' })
        } else {
          // Second API call succeeds
          return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
        }
      })

      const response = await fetchUberEats(mockCredentials, '/v2/eats/order/123')

      expect(response.ok).toBe(true)
      expect(callCount).toBe(2) // Two API calls (first failed, second succeeded)
    })

    it('should include custom headers', async () => {
      await fetchUberEats(mockCredentials, '/v2/eats/order/123', {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      })

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('api.uber.com')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.headers['X-Custom-Header']).toBe('custom-value')
      expect(options.headers.Authorization).toBe('Bearer test-token')
    })
  })

  describe('fetchOrder', () => {
    it('should fetch order successfully', async () => {
      const mockOrder: UberEatsOrder = {
        id: 'order-123',
        display_id: '#1234',
        current_state: 'ACCEPTED',
        type: 'DELIVERY_BY_UBER',
        store: { id: STORE_ID, name: 'Test Store' },
        eater: { first_name: 'John', last_name: 'Doe' },
        cart: { items: [] },
        payment: {
          charges: {
            total: { amount: 1000, currency_code: 'USD', formatted_amount: '$10.00' },
            sub_total: { amount: 900, currency_code: 'USD', formatted_amount: '$9.00' },
            tax: { amount: 100, currency_code: 'USD', formatted_amount: '$1.00' },
            total_fee: { amount: 0, currency_code: 'USD', formatted_amount: '$0.00' },
          },
          accounting: {
            tax_remittance: {
              tax: { amount: 100, currency_code: 'USD', formatted_amount: '$1.00' },
            },
          },
        },
        placed_at: '2024-02-15T10:00:00Z',
      }

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockOrder,
        })
      })

      const order = await fetchOrder(mockCredentials, 'order-123')

      expect(order).toEqual(mockOrder)
    })

    it('should throw error on failed fetch', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          text: async () => 'Order not found',
        })
      })

      await expect(fetchOrder(mockCredentials, 'order-123')).rejects.toThrow(
        'Failed to fetch Uber Eats order order-123'
      )
    })
  })

  describe('acceptOrder', () => {
    it('should accept order successfully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true })
      })

      await expect(acceptOrder(mockCredentials, 'order-123')).resolves.toBeUndefined()

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('/eats/orders/order-123/accept_pos_order')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({})
    })

    it('should throw error on failed accept', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Order already accepted',
        })
      })

      await expect(acceptOrder(mockCredentials, 'order-123')).rejects.toThrow(
        'Failed to accept Uber Eats order order-123'
      )
    })
  })

  describe('denyOrder', () => {
    it('should deny order with reason', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true })
      })

      const reason = {
        explanation: 'Item not available',
        code: 'ITEM_AVAILABILITY',
      }

      await expect(denyOrder(mockCredentials, 'order-123', reason)).resolves.toBeUndefined()

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('/eats/orders/order-123/deny_pos_order')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({ reason })
    })

    it('should throw error on failed deny', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Cannot deny order',
        })
      })

      await expect(
        denyOrder(mockCredentials, 'order-123', { explanation: 'Test', code: 'OTHER' })
      ).rejects.toThrow('Failed to deny Uber Eats order order-123')
    })
  })

  describe('cancelOrder', () => {
    it('should cancel order with reason', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true })
      })

      const reason = {
        explanation: 'Kitchen is closed',
        code: 'KITCHEN_CLOSED',
      }

      await expect(cancelOrder(mockCredentials, 'order-123', reason)).resolves.toBeUndefined()

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes('/eats/orders/order-123/cancel')
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({ reason })
    })
  })

  describe('updateStoreStatus', () => {
    it('should update store status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true })
      })

      await expect(
        updateStoreStatus(mockCredentials, STORE_ID, 'ONLINE')
      ).resolves.toBeUndefined()

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/eats/stores/${STORE_ID}/status`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body)).toEqual({ status: 'ONLINE' })
    })

    it('should include reason when provided', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({ ok: true })
      })

      await updateStoreStatus(mockCredentials, STORE_ID, 'PAUSED', 'Too busy')

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/eats/stores/${STORE_ID}/status`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(JSON.parse(options.body)).toEqual({ status: 'PAUSED', reason: 'Too busy' })
    })
  })

  describe('getStoreStatus', () => {
    it('should get store status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'test-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'ONLINE' }),
        })
      })

      const status = await getStoreStatus(mockCredentials, STORE_ID)

      expect(status).toEqual({ status: 'ONLINE' })

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/eats/stores/${STORE_ID}/status`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('GET')
    })
  })
})
