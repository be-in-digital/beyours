/**
 * Tests for the Deliveroo menu payload builder, focused on stock propagation.
 *
 * Deliveroo carries item availability on a SEPARATE endpoint, not in the menu
 * payload. So the sold-out dish stays in the uploaded menu — an id absent from
 * the menu cannot be 86'd — and `collectDeliverooAvailabilityUpdates` gives the
 * sync action the per-item delta to send to the item-unavailabilities endpoint.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDeliverooMenuPayload,
  collectDeliverooAvailabilityUpdates,
  deliverooItemId,
} from '../deliverooMenuSync'
import type { ProductRecord, CategoryRecord } from '../uberEatsMenuSync'

const STORE_ID = 'store-1'
const SITE_ID = 'site-1'

function createMockProduct(overrides?: Partial<ProductRecord>): ProductRecord {
  return {
    _id: 'prod-1',
    storeId: STORE_ID,
    categoryId: 'cat-1',
    name: 'Margherita',
    slug: 'margherita',
    price: 1250,
    taxRate: 10,
    images: [],
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function createMockCategory(overrides?: Partial<CategoryRecord>): CategoryRecord {
  return {
    _id: 'cat-1',
    storeId: STORE_ID,
    name: 'Pizzas',
    slug: 'pizzas',
    sortOrder: 0,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

const soldOut = createMockProduct({
  _id: 'prod-soldout',
  stock: { tracked: true, quantity: 0, lowStockThreshold: 2 },
})

describe('deliverooItemId', () => {
  it('prefers the mapped Deliveroo id', () => {
    const mapped = createMockProduct({ externalIds: { deliverooId: 'droo-42' } })
    expect(deliverooItemId(mapped)).toBe('droo-42')
  })

  it('falls back to the Convex id', () => {
    expect(deliverooItemId(createMockProduct({ _id: 'prod-9' }))).toBe('prod-9')
  })
})

const CATEGORIES = [createMockCategory()]

describe('collectDeliverooAvailabilityUpdates', () => {
  it('marks a tracked product whose quantity has run out unavailable', () => {
    expect(collectDeliverooAvailabilityUpdates([soldOut], CATEGORIES)).toEqual([
      { itemId: 'prod-soldout', status: 'unavailable' },
    ])
  })

  // The delta has to assert both directions, or a restocked dish stays 86'd.
  it('marks a restocked tracked product available again', () => {
    const restocked = createMockProduct({
      _id: 'prod-restocked',
      stock: { tracked: true, quantity: 4, lowStockThreshold: 2 },
    })

    expect(collectDeliverooAvailabilityUpdates([restocked], CATEGORIES)).toEqual([
      { itemId: 'prod-restocked', status: 'available' },
    ])
  })

  it('uses the mapped Deliveroo id when the product has one', () => {
    const mapped = createMockProduct({
      _id: 'prod-mapped',
      externalIds: { deliverooId: 'droo-7' },
      stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
    })

    expect(collectDeliverooAvailabilityUpdates([mapped], CATEGORIES)).toEqual([
      { itemId: 'droo-7', status: 'unavailable' },
    ])
  })

  // Convex is not the authority on availability: staff 86 dishes on the
  // Deliveroo tablet and nothing writes that back. Saying nothing about an
  // untracked product is what stops a catalogue edit un-86ing their work.
  it('says nothing about a product with stock tracking off', () => {
    const untracked = createMockProduct({
      _id: 'prod-untracked',
      stock: { tracked: false, quantity: 0, lowStockThreshold: 0 },
    })

    expect(collectDeliverooAvailabilityUpdates([untracked], CATEGORIES)).toEqual([])
  })

  it('says nothing about a product with no stock block at all', () => {
    expect(
      collectDeliverooAvailabilityUpdates([createMockProduct({ _id: 'prod-plain' })], CATEGORIES)
    ).toEqual([])
  })

  it('skips inactive products', () => {
    const inactive = createMockProduct({
      _id: 'prod-inactive',
      isActive: false,
      stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
    })

    expect(collectDeliverooAvailabilityUpdates([inactive], CATEGORIES)).toEqual([])
  })

  // An id Deliveroo has never seen makes the whole availability request fail,
  // which would leave every OTHER sold-out dish on sale.
  it('skips a product whose category is inactive', () => {
    const hidden = createMockProduct({
      _id: 'prod-hidden',
      categoryId: 'cat-off',
      stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
    })

    const categories = [createMockCategory(), createMockCategory({ _id: 'cat-off', isActive: false })]

    expect(collectDeliverooAvailabilityUpdates([hidden], categories)).toEqual([])
  })

  it('skips a product whose category does not exist', () => {
    const orphan = createMockProduct({
      _id: 'prod-orphan',
      categoryId: 'cat-gone',
      stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
    })

    expect(collectDeliverooAvailabilityUpdates([orphan], CATEGORIES)).toEqual([])
  })

  // The guarantee that makes the call safe at all.
  it('only ever names ids the menu payload publishes', () => {
    const products = [
      soldOut,
      createMockProduct({ _id: 'prod-ok' }),
      createMockProduct({
        _id: 'prod-orphan',
        categoryId: 'cat-gone',
        stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
      }),
      createMockProduct({
        _id: 'prod-inactive',
        isActive: false,
        stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
      }),
    ]

    const payload = buildDeliverooMenuPayload(products, CATEGORIES, SITE_ID)
    const publishedIds = new Set(payload.menu.items.map((i) => i.id))

    for (const update of collectDeliverooAvailabilityUpdates(products, CATEGORIES)) {
      expect(publishedIds.has(update.itemId)).toBe(true)
    }
  })
})

describe('buildDeliverooMenuPayload — out of stock', () => {
  it('keeps the sold-out dish in the menu so it can be 86-ed by id', () => {
    const payload = buildDeliverooMenuPayload([soldOut], [createMockCategory()], SITE_ID)

    expect(payload.menu.items.map((i) => i.id)).toContain('prod-soldout')
    expect(payload.menu.categories[0].item_ids).toContain('prod-soldout')
  })

  it('still excludes inactive products from the menu', () => {
    const inactive = createMockProduct({ _id: 'prod-inactive', isActive: false })

    const payload = buildDeliverooMenuPayload(
      [inactive, createMockProduct({ _id: 'prod-ok' })],
      [createMockCategory()],
      SITE_ID
    )

    expect(payload.menu.items.map((i) => i.id)).toEqual(['prod-ok'])
  })

  it('addresses menu items and the availability list with the same ids', () => {
    const mapped = createMockProduct({
      _id: 'prod-mapped',
      externalIds: { deliverooId: 'droo-7' },
      stock: { tracked: true, quantity: 0, lowStockThreshold: 1 },
    })

    const payload = buildDeliverooMenuPayload([mapped], [createMockCategory()], SITE_ID)

    // If these two ever diverge, the availability call silently 86s nothing.
    expect(payload.menu.items.map((i) => i.id)).toEqual(
      collectDeliverooAvailabilityUpdates([mapped], [createMockCategory()]).map((u) => u.itemId)
    )
  })
})

/**
 * Enabling stock tracking on a product with no count is a real, deliberate 86.
 *
 * `products.toggleStockTracking` defaults a missing stock row to `quantity: 0`,
 * so ticking the box makes the dish sold out. That looks surprising, but it is
 * exactly what the restaurant's OWN storefront already does —
 * `packages/restaurant/src/services/product.ts` `isProductAvailable` returns
 * false for `tracked && quantity <= 0`. The platforms were the only surface
 * still selling it. Pinning the behaviour here so nobody "fixes" the platforms
 * back into disagreeing with the storefront.
 */
describe('enabling stock tracking takes the dish off sale everywhere', () => {
  it('marks a freshly tracked product with no count unavailable', () => {
    const justTracked = createMockProduct({
      _id: 'prod-just-tracked',
      stock: { tracked: true, quantity: 0, lowStockThreshold: 5 },
    })

    expect(collectDeliverooAvailabilityUpdates([justTracked], CATEGORIES)).toEqual([
      { itemId: 'prod-just-tracked', status: 'unavailable' },
    ])
  })

  it('says nothing about the same product before tracking was enabled', () => {
    const untracked = createMockProduct({
      _id: 'prod-just-tracked',
      stock: { tracked: false, quantity: 0, lowStockThreshold: 5 },
    })

    expect(collectDeliverooAvailabilityUpdates([untracked], CATEGORIES)).toEqual([])
  })
})
