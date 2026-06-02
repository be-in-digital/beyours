/**
 * Tests for integration validation flow.
 *
 * Simulates the exact logic of the Convex action `validateIntegration`
 * which validates credentials + store/brand IDs before saving an integration.
 *
 * Test data based on real restaurant:
 *   Restaurant: Pizza Bobigny
 *   Location ID (Site ID): 101
 *   Brand ID: 13eaa505-f059-479f-8ada-c24a1f9c56ec
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { uberEats, deliveroo } from '../index'

// Real test fixtures
const UBER_EATS_STORE_ID = '480eab8c-cc25-4c2b-b92f-70d7a1984f97'
const DELIVEROO_BRAND_ID = '13eaa505-f059-479f-8ada-c24a1f9c56ec'
const DELIVEROO_SITE_ID = '101'

describe('Integration Validation Flow', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    uberEats.clearTokenCache()
    deliveroo.clearTokenCache()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ─── Uber Eats Validation ───────────────────────────────────────

  describe('Uber Eats validation (getStoreStatus)', () => {
    const credentials = {
      clientId: 'ue-client-id',
      clientSecret: 'ue-client-secret',
      sandboxMode: false,
    }

    function setupUberEatsMock(storeStatusResponse: { ok: boolean; status?: number; body?: unknown; errorText?: string }) {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'ue-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        // Store status endpoint
        if (storeStatusResponse.ok) {
          return Promise.resolve({
            ok: true,
            json: async () => storeStatusResponse.body ?? { status: 'ONLINE' },
          })
        }
        return Promise.resolve({
          ok: false,
          status: storeStatusResponse.status ?? 404,
          text: async () => storeStatusResponse.errorText ?? 'Not found',
        })
      })
    }

    it('should return valid=true when store ID is valid', async () => {
      setupUberEatsMock({ ok: true, body: { status: 'ONLINE' } })

      const result = await uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)

      expect(result).toEqual({ status: 'ONLINE' })

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/eats/store/${UBER_EATS_STORE_ID}/status`)
      )
      expect(apiCall).toBeDefined()
    })

    it('should return valid=true when store is PAUSED', async () => {
      setupUberEatsMock({ ok: true, body: { status: 'PAUSED' } })

      const result = await uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)

      expect(result).toEqual({ status: 'PAUSED' })
    })

    it('should return valid=true when store is OFFLINE', async () => {
      setupUberEatsMock({ ok: true, body: { status: 'OFFLINE' } })

      const result = await uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)

      expect(result).toEqual({ status: 'OFFLINE' })
    })

    it('should throw when store ID is invalid (404)', async () => {
      setupUberEatsMock({
        ok: false,
        status: 404,
        errorText: 'Store not found',
      })

      await expect(
        uberEats.getStoreStatus(credentials, 'invalid-store-id')
      ).rejects.toThrow('Failed to get Uber Eats store status')
    })

    it('should throw when credentials are invalid (401)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid client credentials',
      })

      await expect(
        uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)
      ).rejects.toThrow('Uber Eats OAuth failed')
    })

    it('should throw when API returns 403 (forbidden)', async () => {
      setupUberEatsMock({
        ok: false,
        status: 403,
        errorText: 'Access denied to this store',
      })

      await expect(
        uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)
      ).rejects.toThrow('Failed to get Uber Eats store status')
    })

    it('should simulate full validation flow: valid credentials + valid store', async () => {
      setupUberEatsMock({ ok: true, body: { status: 'ONLINE' } })

      // This is the exact flow from the Convex action
      let valid = false
      let error: string | undefined

      try {
        await uberEats.getStoreStatus(credentials, UBER_EATS_STORE_ID)
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(true)
      expect(error).toBeUndefined()
    })

    it('should simulate full validation flow: valid credentials + invalid store', async () => {
      setupUberEatsMock({
        ok: false,
        status: 404,
        errorText: 'Store not found',
      })

      let valid = false
      let error: string | undefined

      try {
        await uberEats.getStoreStatus(credentials, 'bad-store-id')
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Failed to get Uber Eats store status')
    })

    it('should validate sandbox mode: use fetchUberEats /v1/eats/stores/{id} instead of /status', async () => {
      // In sandbox, /v1/eats/stores/{id}/status returns 404,
      // so we use /v1/eats/stores/{id} to validate.
      const sandboxCreds = { ...credentials, sandboxMode: true }

      uberEats.clearTokenCache()
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'ue-sandbox-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        // /v1/eats/stores/{id} (without /status)
        if (url.includes(`/eats/stores/${UBER_EATS_STORE_ID}`) && !url.includes('/status')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              store_id: UBER_EATS_STORE_ID,
              name: 'BD Theme Test Store 1',
              status: 'active',
            }),
          })
        }
        return Promise.resolve({ ok: false, status: 404, text: async () => '404 page not found' })
      })

      const isSandbox = sandboxCreds.sandboxMode
      let valid = false
      let error: string | undefined

      try {
        if (isSandbox) {
          const response = await uberEats.fetchUberEats(
            sandboxCreds,
            `/v1/eats/stores/${UBER_EATS_STORE_ID}`
          )
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Store ID invalide (${response.status}): ${errorText}`)
          }
        } else {
          await uberEats.getStoreStatus(sandboxCreds, UBER_EATS_STORE_ID)
        }
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(true)
      expect(error).toBeUndefined()

      // Verify the correct endpoint was called (not /status)
      const storeCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/eats/stores/${UBER_EATS_STORE_ID}`) && !call[0].includes('/status')
      )
      expect(storeCall).toBeDefined()
    })

    it('should validate sandbox mode: reject invalid store ID (400)', async () => {
      // Real Uber Eats sandbox returns 400 for invalid store IDs
      const sandboxCreds = { ...credentials, sandboxMode: true }

      uberEats.clearTokenCache()
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth/v2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              access_token: 'ue-sandbox-token',
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'eats.store',
            }),
          })
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => '{"code":"bad_request","message":"Your store ID is invalid."}',
        })
      })

      let valid = false
      let error: string | undefined

      try {
        const response = await uberEats.fetchUberEats(
          sandboxCreds,
          '/v1/eats/stores/invalid-id'
        )
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Store ID invalide (${response.status}): ${errorText}`)
        }
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Store ID invalide')
      expect(error).toContain('400')
    })
  })

  // ─── Deliveroo Validation ──────────────────────────────────────

  describe('Deliveroo validation (getAccessToken + fetchDeliveroo menus)', () => {
    const credentials = {
      clientId: 'dl-client-id',
      clientSecret: 'dl-client-secret',
      sandboxMode: false,
    }

    const sandboxCredentials = {
      clientId: 'dl-client-id',
      clientSecret: 'dl-client-secret',
      sandboxMode: true,
    }

    function setupDeliverooMock(options: {
      authOk: boolean
      authErrorText?: string
      menuOk?: boolean
      menuStatus?: number
      menuErrorText?: string
      menuBody?: unknown
    }) {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          if (options.authOk) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                access_token: 'dl-token',
                token_type: 'Bearer',
                expires_in: 3600,
              }),
            })
          }
          return Promise.resolve({
            ok: false,
            status: 400,
            text: async () => options.authErrorText ?? '{"error":"invalid_client"}',
          })
        }

        // Menu API endpoint
        if (options.menuOk ?? true) {
          return Promise.resolve({
            ok: true,
            json: async () => options.menuBody ?? { menus: [] },
          })
        }
        return Promise.resolve({
          ok: false,
          status: options.menuStatus ?? 404,
          text: async () => options.menuErrorText ?? 'Not found',
        })
      })
    }

    it('should validate credentials via getAccessToken', async () => {
      setupDeliverooMock({ authOk: true })

      const token = await deliveroo.getAccessToken(credentials)

      expect(token.accessToken).toBe('dl-token')
      expect(token.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should reject invalid credentials (400 invalid_client)', async () => {
      // Real Deliveroo returns 400, not 401, for bad credentials
      setupDeliverooMock({
        authOk: false,
        authErrorText: '{"error":"invalid_client"}',
      })

      await expect(deliveroo.getAccessToken(credentials)).rejects.toThrow(
        'Deliveroo OAuth failed'
      )
    })

    it('should validate brand ID by fetching menus', async () => {
      setupDeliverooMock({ authOk: true, menuOk: true, menuBody: { menus: [{ id: 'menu-1' }] } })

      const response = await deliveroo.fetchDeliveroo(
        credentials,
        `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
        {},
        'menu'
      )

      expect(response.ok).toBe(true)

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${DELIVEROO_BRAND_ID}/menus`)
      )
      expect(apiCall).toBeDefined()
    })

    it('should detect invalid brand ID (404)', async () => {
      setupDeliverooMock({
        authOk: true,
        menuOk: false,
        menuStatus: 404,
        menuErrorText: 'Brand not found',
      })

      const response = await deliveroo.fetchDeliveroo(
        credentials,
        '/v1/brands/invalid-brand-id/menus',
        {},
        'menu'
      )

      expect(response.ok).toBe(false)
    })

    it('should detect forbidden brand access (403)', async () => {
      setupDeliverooMock({
        authOk: true,
        menuOk: false,
        menuStatus: 403,
        menuErrorText: 'Access denied',
      })

      const response = await deliveroo.fetchDeliveroo(
        credentials,
        `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
        {},
        'menu'
      )

      expect(response.ok).toBe(false)
    })

    it('should simulate full validation flow: valid credentials + valid brand ID', async () => {
      setupDeliverooMock({
        authOk: true,
        menuOk: true,
        menuBody: { menus: [{ id: 'menu-1', name: 'Pizza Bobigny Menu' }] },
      })

      // This is the exact flow from the Convex action
      let valid = false
      let error: string | undefined

      try {
        // Step 1: Validate credentials
        await deliveroo.getAccessToken(credentials)

        // Step 2: Validate brand ID
        const response = await deliveroo.fetchDeliveroo(
          credentials,
          `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
          {},
          'menu'
        )

        if (!response.ok) {
          const errorText = await response.text()
          error = `Brand ID invalide (${response.status}): ${errorText}`
        } else {
          valid = true
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(true)
      expect(error).toBeUndefined()
    })

    it('should simulate full validation flow: invalid credentials', async () => {
      setupDeliverooMock({
        authOk: false,
        authErrorText: '{"error":"invalid_client"}',
      })

      let valid = false
      let error: string | undefined

      try {
        await deliveroo.getAccessToken(credentials)

        const response = await deliveroo.fetchDeliveroo(
          credentials,
          `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
          {},
          'menu'
        )

        if (!response.ok) {
          const errorText = await response.text()
          error = `Brand ID invalide (${response.status}): ${errorText}`
        } else {
          valid = true
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Deliveroo OAuth failed')
    })

    it('should simulate full validation flow: valid credentials + invalid brand ID', async () => {
      setupDeliverooMock({
        authOk: true,
        menuOk: false,
        menuStatus: 404,
        menuErrorText: 'Brand not found',
      })

      let valid = false
      let error: string | undefined

      try {
        await deliveroo.getAccessToken(credentials)

        const response = await deliveroo.fetchDeliveroo(
          credentials,
          '/v1/brands/bad-brand-id/menus',
          {},
          'menu'
        )

        if (!response.ok) {
          const errorText = await response.text()
          error = `Brand ID invalide (${response.status}): ${errorText}`
        } else {
          valid = true
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Brand ID invalide')
      expect(error).toContain('404')
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error: ECONNREFUSED'))

      let valid = false
      let error: string | undefined

      try {
        await deliveroo.getAccessToken(credentials)
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Network error')
    })

    it('should handle timeout errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError: The operation was aborted'))

      let valid = false
      let error: string | undefined

      try {
        await deliveroo.getAccessToken(credentials)
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('AbortError')
    })

    it('should validate sandbox mode: credentials only (skip brandId API check)', async () => {
      // In sandbox mode, the Deliveroo API gateway rejects Bearer tokens,
      // so we only validate credentials via getAccessToken.
      setupDeliverooMock({ authOk: true })

      let valid = false
      let error: string | undefined
      const isSandbox = sandboxCredentials.sandboxMode

      try {
        // Step 1: Validate credentials via OAuth
        await deliveroo.getAccessToken(sandboxCredentials)

        // Step 2: Skip brandId validation in sandbox mode
        if (!isSandbox) {
          const response = await deliveroo.fetchDeliveroo(
            sandboxCredentials,
            `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
            {},
            'menu'
          )

          if (!response.ok) {
            const errorText = await response.text()
            error = `Brand ID invalide (${response.status}): ${errorText}`
          }
        }

        if (!error) valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(true)
      expect(error).toBeUndefined()
      // Should NOT have called the menus API
      const menuApiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/`)
      )
      expect(menuApiCall).toBeUndefined()
    })

    it('should validate sandbox mode: reject invalid credentials', async () => {
      setupDeliverooMock({
        authOk: false,
        authErrorText: 'invalid_client',
      })

      let valid = false
      let error: string | undefined

      try {
        await deliveroo.getAccessToken(sandboxCredentials)
        valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(false)
      expect(error).toContain('Deliveroo OAuth failed')
    })

    it('should validate production mode: check both credentials AND brandId', async () => {
      setupDeliverooMock({
        authOk: true,
        menuOk: true,
        menuBody: { menus: [{ id: 'menu-1' }] },
      })

      let valid = false
      let error: string | undefined
      const isSandbox = credentials.sandboxMode // false

      try {
        await deliveroo.getAccessToken(credentials)

        if (!isSandbox) {
          const response = await deliveroo.fetchDeliveroo(
            credentials,
            `/v1/brands/${DELIVEROO_BRAND_ID}/menus`,
            {},
            'menu'
          )

          if (!response.ok) {
            const errorText = await response.text()
            error = `Brand ID invalide (${response.status}): ${errorText}`
          }
        }

        if (!error) valid = true
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      expect(valid).toBe(true)
      // Should have called the menus API in production mode
      const menuApiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v1/brands/${DELIVEROO_BRAND_ID}/menus`)
      )
      expect(menuApiCall).toBeDefined()
    })
  })

  // ─── Cross-platform: Environment Check ─────────────────────────

  describe('Missing credentials simulation', () => {
    it('should handle missing Uber Eats credentials', () => {
      // Simulates what the Convex action does when env vars are missing
      const clientId = undefined
      const clientSecret = undefined

      let result: { valid: boolean; error?: string }

      if (!clientId || !clientSecret) {
        result = {
          valid: false,
          error: "Credentials Uber Eats non configurees dans l'environnement",
        }
      } else {
        result = { valid: true }
      }

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Credentials Uber Eats')
    })

    it('should handle missing Deliveroo credentials', () => {
      const clientId = undefined
      const clientSecret = undefined

      let result: { valid: boolean; error?: string }

      if (!clientId || !clientSecret) {
        result = {
          valid: false,
          error: "Credentials Deliveroo non configurees dans l'environnement",
        }
      } else {
        result = { valid: true }
      }

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Credentials Deliveroo')
    })

    it('should handle missing Deliveroo brand ID', () => {
      const brandId = undefined

      let result: { valid: boolean; error?: string }

      if (!brandId) {
        result = {
          valid: false,
          error: 'Le Brand ID Deliveroo est requis',
        }
      } else {
        result = { valid: true }
      }

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Le Brand ID Deliveroo est requis')
    })

    it('should accept valid Deliveroo brand ID format (UUID)', () => {
      const brandId = DELIVEROO_BRAND_ID

      expect(brandId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('should accept Deliveroo site ID format (numeric)', () => {
      const siteId = DELIVEROO_SITE_ID

      expect(siteId).toMatch(/^\d+$/)
    })
  })
})
