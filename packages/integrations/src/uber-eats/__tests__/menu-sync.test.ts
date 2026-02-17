/**
 * Tests for Uber Eats menu synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { pullMenu, pushMenu } from '../menu-sync'
import type { UberEatsCredentials, UberEatsMenuPayload } from '../types'

const STORE_ID = '480eab8c-cc25-4c2b-b92f-70d7a1984f97'

const mockCredentials: UberEatsCredentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  sandboxMode: false,
}

describe('Uber Eats Menu Sync', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('pullMenu', () => {
    it('should fetch and parse menu successfully', async () => {
      const mockMenuResponse = {
        menus: [
          {
            id: 'main-menu',
            category_ids: ['cat-1', 'cat-2'],
          },
        ],
        categories: [
          {
            id: 'cat-1',
            title: { translations: { en: 'Pizzas' } },
            entities: [{ id: 'item-1' }, { id: 'item-2' }],
          },
          {
            id: 'cat-2',
            title: { translations: { en: 'Salads' } },
            entities: [{ id: 'item-3' }],
          },
        ],
        items: [
          {
            id: 'item-1',
            title: { translations: { en: 'Margherita' } },
            description: { translations: { en: 'Classic pizza' } },
            image_url: 'https://example.com/margherita.jpg',
            price_info: { price: 1200 },
            modifier_group_ids: { ids: ['mg-1'] },
          },
          {
            id: 'item-2',
            title: { translations: { en: 'Pepperoni' } },
            price_info: { price: 1400 },
          },
          {
            id: 'item-3',
            title: { translations: { en: 'Caesar Salad' } },
            price_info: { price: 800 },
          },
          {
            id: 'mod-item-1',
            title: { translations: { en: 'Large' } },
            price_info: { price: 300 },
          },
        ],
        modifier_groups: [
          {
            id: 'mg-1',
            title: { translations: { en: 'Size' } },
            modifier_options: [{ id: 'mod-item-1' }],
          },
        ],
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
        if (url.includes('/menus')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockMenuResponse,
          })
        }
        return Promise.resolve({ ok: false, status: 404 })
      })

      const result = await pullMenu(mockCredentials, STORE_ID)

      expect(result.rawMenu).toEqual(mockMenuResponse)
      expect(result.categories).toHaveLength(2)

      // Check first category
      expect(result.categories[0]).toMatchObject({
        externalId: 'cat-1',
        name: 'Pizzas',
      })
      expect(result.categories[0].items).toHaveLength(2)
      expect(result.categories[0].items[0]).toMatchObject({
        externalId: 'item-1',
        name: 'Margherita',
        description: 'Classic pizza',
        imageUrl: 'https://example.com/margherita.jpg',
        price: 1200,
      })

      // Check modifier groups
      expect(result.categories[0].items[0].modifierGroups).toHaveLength(1)
      expect(result.categories[0].items[0].modifierGroups[0]).toMatchObject({
        externalId: 'mg-1',
        name: 'Size',
      })
      expect(result.categories[0].items[0].modifierGroups[0].modifiers).toHaveLength(1)
      expect(result.categories[0].items[0].modifierGroups[0].modifiers[0]).toMatchObject({
        externalId: 'mod-item-1',
        name: 'Large',
        price: 300,
      })
    })

    it('should handle menu with multiple languages (fallback to first available)', async () => {
      const mockMenuResponse = {
        categories: [
          {
            id: 'cat-1',
            title: { translations: { fr: 'Pizzas', es: 'Pizzas' } }, // No English
            entities: [{ id: 'item-1' }],
          },
        ],
        items: [
          {
            id: 'item-1',
            title: { translations: { fr: 'Margherita', es: 'Margarita' } },
            price_info: { price: 1200 },
          },
        ],
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
          json: async () => mockMenuResponse,
        })
      })

      const result = await pullMenu(mockCredentials, STORE_ID)

      // Should fallback to first available language (fr)
      expect(result.categories[0].name).toBe('Pizzas')
      expect(result.categories[0].items[0].name).toBe('Margherita')
    })

    it('should handle empty menu response', async () => {
      const emptyMenuResponse = {
        categories: [],
        items: [],
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
          json: async () => emptyMenuResponse,
        })
      })

      const result = await pullMenu(mockCredentials, STORE_ID)

      expect(result.categories).toHaveLength(0)
    })

    it('should handle missing optional fields', async () => {
      const minimalMenuResponse = {
        categories: [
          {
            id: 'cat-1',
            entities: [{ id: 'item-1' }],
          },
        ],
        items: [
          {
            id: 'item-1',
            // No title, description, image, etc.
          },
        ],
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
          json: async () => minimalMenuResponse,
        })
      })

      const result = await pullMenu(mockCredentials, STORE_ID)

      expect(result.categories).toHaveLength(1)
      expect(result.categories[0].name).toBe('cat-1') // Falls back to ID
      expect(result.categories[0].items[0].name).toBe('item-1') // Falls back to ID
      expect(result.categories[0].items[0].price).toBe(0)
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
          text: async () => 'Store not found',
        })
      })

      await expect(pullMenu(mockCredentials, STORE_ID)).rejects.toThrow(
        `Failed to fetch menu for store ${STORE_ID} (404): Store not found`
      )
    })

    it('should use correct API endpoint', async () => {
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
          json: async () => ({ categories: [], items: [] }),
        })
      })

      await pullMenu(mockCredentials, STORE_ID)

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v2/eats/stores/${STORE_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
    })
  })

  describe('pushMenu', () => {
    it('should push menu payload successfully', async () => {
      const menuPayload: UberEatsMenuPayload = {
        menus: [
          {
            id: 'main-menu',
            title: { translations: { en: 'Main Menu' } },
            service_availability: [
              {
                day_of_week: 'monday',
                time_periods: [{ start_time: '00:00', end_time: '23:59' }],
              },
            ],
            category_ids: ['cat-1'],
          },
        ],
        categories: [
          {
            id: 'cat-1',
            title: { translations: { en: 'Pizzas' } },
            entities: [{ id: 'item-1', type: 'ITEM' }],
          },
        ],
        items: [
          {
            id: 'item-1',
            title: { translations: { en: 'Margherita' } },
            price_info: { price: 1200 },
          },
        ],
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
        return Promise.resolve({ ok: true })
      })

      await expect(pushMenu(mockCredentials, STORE_ID, menuPayload)).resolves.toBeUndefined()

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v2/eats/stores/${STORE_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      expect(options.method).toBe('PUT')
      expect(JSON.parse(options.body)).toEqual(menuPayload)
    })

    it('should throw error on failed push', async () => {
      const menuPayload: UberEatsMenuPayload = {
        menus: [],
        categories: [],
        items: [],
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
          ok: false,
          status: 400,
          text: async () => 'Invalid menu payload',
        })
      })

      await expect(pushMenu(mockCredentials, STORE_ID, menuPayload)).rejects.toThrow(
        `Failed to push menu to store ${STORE_ID} (400): Invalid menu payload`
      )
    })

    it('should handle menu with modifier groups', async () => {
      const menuPayload: UberEatsMenuPayload = {
        menus: [
          {
            id: 'main-menu',
            title: { translations: { en: 'Main Menu' } },
            service_availability: [],
            category_ids: ['cat-1'],
          },
        ],
        categories: [
          {
            id: 'cat-1',
            title: { translations: { en: 'Pizzas' } },
            entities: [{ id: 'item-1', type: 'ITEM' }],
          },
        ],
        items: [
          {
            id: 'item-1',
            title: { translations: { en: 'Margherita' } },
            price_info: { price: 1200 },
            modifier_group_ids: { ids: ['mg-1'] },
          },
          {
            id: 'mod-1',
            title: { translations: { en: 'Large' } },
            price_info: { price: 300 },
          },
        ],
        modifier_groups: [
          {
            id: 'mg-1',
            title: { translations: { en: 'Size' } },
            quantity_info: { quantity: { max_permitted: 1, min_permitted: 1 } },
            modifier_options: [{ id: 'mod-1', type: 'ITEM' }],
          },
        ],
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
        return Promise.resolve({ ok: true })
      })

      await pushMenu(mockCredentials, STORE_ID, menuPayload)

      const apiCall = mockFetch.mock.calls.find((call) =>
        call[0].includes(`/v2/eats/stores/${STORE_ID}/menus`)
      )

      expect(apiCall).toBeDefined()
      const [, options] = apiCall!
      const sentPayload = JSON.parse(options.body)
      expect(sentPayload.modifier_groups).toHaveLength(1)
      expect(sentPayload.modifier_groups[0].modifier_options).toHaveLength(1)
    })
  })
})
