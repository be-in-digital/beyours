/**
 * Store selection
 *
 * Two guarantees are worth a test because both were bugs:
 *
 * - admin and storefront must not share a key. They did, so a visitor letting
 *   the storefront pick the nearest restaurant moved the dashboard the owner
 *   was working in, and vice versa.
 * - only the id is persisted. The whole document used to be, and nothing ever
 *   refreshed it: a renamed store or new opening hours stayed wrong in that
 *   browser until localStorage was cleared.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null
  }
  get length() {
    return this.data.size
  }
}

const storage = new MemoryStorage()

function installBrowser() {
  vi.stubGlobal('window', { localStorage: storage })
  vi.stubGlobal('localStorage', storage)
}

/** Re-imports the module so `persist` re-reads whatever the test seeded. */
async function loadSelectionStores() {
  vi.resetModules()
  installBrowser()
  return await import('../stores/store')
}

describe('store selection', () => {
  beforeEach(() => {
    storage.clear()
    vi.unstubAllGlobals()
  })

  it('keeps the admin and storefront selections apart', async () => {
    const {
      useAdminStoreSelection,
      useStorefrontStoreSelection,
      ADMIN_SELECTION_KEY,
      STOREFRONT_SELECTION_KEY,
    } = await loadSelectionStores()

    useAdminStoreSelection.getState().setStoreId('store_lyon')
    useStorefrontStoreSelection.getState().setStoreId('store_paris')

    expect(useAdminStoreSelection.getState().storeId).toBe('store_lyon')
    expect(useStorefrontStoreSelection.getState().storeId).toBe('store_paris')
    expect(ADMIN_SELECTION_KEY).not.toBe(STOREFRONT_SELECTION_KEY)
  })

  it('persists the id and nothing else', async () => {
    const { useAdminStoreSelection, ADMIN_SELECTION_KEY } =
      await loadSelectionStores()

    useAdminStoreSelection.getState().setStoreId('store_lyon')

    const written = JSON.parse(storage.getItem(ADMIN_SELECTION_KEY) as string)
    expect(written.state).toEqual({ storeId: 'store_lyon' })
  })

  it('carries an existing selection over from the pre-split key', async () => {
    storage.setItem(
      'beindigital-store',
      JSON.stringify({
        state: {
          currentStore: {
            _id: 'store_legacy',
            name: 'Chez Luigi',
            hours: { monday: { open: '12:00', close: '14:00' } },
          },
        },
        version: 0,
      })
    )

    const { useAdminStoreSelection, useStorefrontStoreSelection } =
      await loadSelectionStores()

    expect(useAdminStoreSelection.getState().storeId).toBe('store_legacy')
    expect(useStorefrontStoreSelection.getState().storeId).toBe('store_legacy')
  })

  it('ignores a legacy payload once the zone has its own selection', async () => {
    storage.setItem(
      'beindigital-store',
      JSON.stringify({ state: { currentStore: { _id: 'store_legacy' } } })
    )
    storage.setItem(
      'beyours-admin-store',
      JSON.stringify({ state: { storeId: 'store_chosen' }, version: 0 })
    )

    const { useAdminStoreSelection } = await loadSelectionStores()

    expect(useAdminStoreSelection.getState().storeId).toBe('store_chosen')
  })

  it('survives a corrupt legacy payload', async () => {
    storage.setItem('beindigital-store', '{ not json')

    const { useAdminStoreSelection } = await loadSelectionStores()

    expect(useAdminStoreSelection.getState().storeId).toBeNull()
  })
})
