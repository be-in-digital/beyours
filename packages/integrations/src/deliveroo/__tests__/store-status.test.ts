/**
 * Tests for Deliveroo site status, busy mode and item availability (86'ing).
 *
 * These endpoints were previously untested and mis-targeted: availability went
 * to a `/v1/.../unavailabilities` path that does not exist, with an
 * `unavailable_items` body Deliveroo does not accept, and the site status was
 * sent in lowercase when the enum is uppercase. A sold-out dish therefore kept
 * selling. The assertions below pin the documented contract.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  updateSiteStatus,
  updateStoreStatus,
  setItemsUnavailable,
  setItemAvailability,
  clearUnavailabilities,
} from '../store-status'
import { clearTokenCache } from '../client'
import type { DeliverooCredentials } from '../types'

const BRAND_ID = '13eaa505-f059-479f-8ada-c24a1f9c56ec'
const SITE_ID = '101'
const MENU_ID = 'menu-101'
// Availability is a Menu API concern; open/close is Site API.
const SITE_API = 'https://api.developers.deliveroo.com/site'
const MENU_API = 'https://api.developers.deliveroo.com/menu'

const mockCredentials: DeliverooCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  sandboxMode: false,
}

describe('Deliveroo store status and item availability', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  /** The single non-OAuth request the call under test made. */
  function apiCall(): [string, { method: string; body?: string }] {
    const call = mockFetch.mock.calls.find((c) => !String(c[0]).includes('oauth2/token'))
    expect(call).toBeDefined()
    return call as [string, { method: string; body?: string }]
  }

  function mockJson(payload: unknown): void {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('oauth2/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: 'test-token', token_type: 'Bearer', expires_in: 3600 }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => payload, text: async () => '' })
    })
  }

  beforeEach(() => {
    clearTokenCache()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    mockJson({})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('updateSiteStatus', () => {
    it('PUTs the documented uppercase status enum', async () => {
      await updateSiteStatus(mockCredentials, BRAND_ID, SITE_ID, 'CLOSED')

      const [url, options] = apiCall()
      expect(url).toBe(`${SITE_API}/v1/brands/${BRAND_ID}/sites/${SITE_ID}/status`)
      expect(options.method).toBe('PUT')
      expect(JSON.parse(options.body!)).toEqual({ status: 'CLOSED' })
    })

    it('raises an IntegrationError on a non-2xx response', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ access_token: 't', token_type: 'Bearer', expires_in: 3600 }),
          })
        }
        return Promise.resolve({ ok: false, status: 422, text: async () => 'OPENING_HOURS' })
      })

      await expect(
        updateSiteStatus(mockCredentials, BRAND_ID, SITE_ID, 'OPEN')
      ).rejects.toThrow('Failed to update Deliveroo site status')
    })
  })

  describe('updateStoreStatus', () => {
    it('maps ONLINE to OPEN', async () => {
      await updateStoreStatus(mockCredentials, BRAND_ID, SITE_ID, 'ONLINE')
      expect(JSON.parse(apiCall()[1].body!)).toEqual({ status: 'OPEN' })
    })

    // Deliveroo has no "paused" site status — the enum is OPEN | CLOSED |
    // READY_TO_OPEN — so a pause and a shutdown both stop orders the same way.
    it.each(['PAUSED', 'OFFLINE'] as const)('maps %s to CLOSED', async (status) => {
      await updateStoreStatus(mockCredentials, BRAND_ID, SITE_ID, status)
      expect(JSON.parse(apiCall()[1].body!)).toEqual({ status: 'CLOSED' })
    })
  })

  describe('setItemsUnavailable (full reconcile)', () => {
    it('PUTs the v2 item-unavailabilities endpoint with the documented body', async () => {
      await setItemsUnavailable(mockCredentials, BRAND_ID, SITE_ID, ['item-1', 'item-2'])

      const [url, options] = apiCall()
      expect(url).toBe(
        `${MENU_API}/v2/brands/${BRAND_ID}/sites/${SITE_ID}/menu/item-unavailabilities`
      )
      expect(options.method).toBe('PUT')
      expect(JSON.parse(options.body!)).toEqual({
        unavailable_ids: ['item-1', 'item-2'],
        hidden_ids: [],
      })
    })

    it('carries hidden ids separately from unavailable ones', async () => {
      await setItemsUnavailable(mockCredentials, BRAND_ID, SITE_ID, ['item-1'], ['item-9'])

      expect(JSON.parse(apiCall()[1].body!)).toEqual({
        unavailable_ids: ['item-1'],
        hidden_ids: ['item-9'],
      })
    })

    // PUT is a replace, not a delta. An empty list is a meaningful instruction
    // ("everything is back in stock"), so it must still hit the network.
    it('sends an empty reconcile rather than skipping the call', async () => {
      await setItemsUnavailable(mockCredentials, BRAND_ID, SITE_ID, [])

      expect(JSON.parse(apiCall()[1].body!)).toEqual({ unavailable_ids: [], hidden_ids: [] })
    })
  })

  describe('setItemAvailability (per-item delta)', () => {
    it('POSTs only the listed items, leaving the rest untouched', async () => {
      await setItemAvailability(mockCredentials, BRAND_ID, MENU_ID, SITE_ID, [
        { itemId: 'item-1', status: 'unavailable' },
        { itemId: 'item-2', status: 'available' },
      ])

      const [url, options] = apiCall()
      expect(url).toBe(
        `${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item-unavailabilities/${SITE_ID}`
      )
      expect(options.method).toBe('POST')
      expect(JSON.parse(options.body!)).toEqual({
        item_unavailabilities: [
          { item_id: 'item-1', status: 'unavailable' },
          { item_id: 'item-2', status: 'available' },
        ],
      })
    })

    it('skips the request when there is nothing to change', async () => {
      await setItemAvailability(mockCredentials, BRAND_ID, MENU_ID, SITE_ID, [])
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('clearUnavailabilities', () => {
    it('replaces the whole state with empty lists', async () => {
      await clearUnavailabilities(mockCredentials, BRAND_ID, SITE_ID)

      const [url, options] = apiCall()
      expect(url).toBe(
        `${MENU_API}/v2/brands/${BRAND_ID}/sites/${SITE_ID}/menu/item-unavailabilities`
      )
      expect(options.method).toBe('PUT')
      expect(JSON.parse(options.body!)).toEqual({ unavailable_ids: [], hidden_ids: [] })
    })
  })
})
