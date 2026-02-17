/**
 * Tests for Uber Eats menu payload builder
 */

import { describe, it, expect } from 'vitest'
import { buildUberEatsMenuPayload } from '../uberEatsMenuSync'
import type { ProductRecord, CategoryRecord } from '../uberEatsMenuSync'

const STORE_ID = '480eab8c-cc25-4c2b-b92f-70d7a1984f97'

/**
 * Helper to create a mock product
 */
function createMockProduct(overrides?: Partial<ProductRecord>): ProductRecord {
  return {
    _id: `prod-${Math.random().toString(36).substring(7)}`,
    storeId: STORE_ID,
    categoryId: 'cat-1',
    name: 'Test Product',
    slug: 'test-product',
    description: 'A test product',
    price: 12.99,
    taxRate: 0.2,
    images: ['https://example.com/image.jpg'],
    isActive: true,
    isFeatured: false,
    sortOrder: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

/**
 * Helper to create a mock category
 */
function createMockCategory(overrides?: Partial<CategoryRecord>): CategoryRecord {
  return {
    _id: `cat-${Math.random().toString(36).substring(7)}`,
    storeId: STORE_ID,
    name: 'Test Category',
    slug: 'test-category',
    sortOrder: 0,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('buildUberEatsMenuPayload', () => {
  it('should build correct menu payload from products and categories', () => {
    const category = createMockCategory({ _id: 'cat-1', name: 'Pizzas' })
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      name: 'Margherita',
      price: 12.5,
      taxRate: 0.1,
    })

    const payload = buildUberEatsMenuPayload([product], [category])

    // Check menus
    expect(payload.menus).toHaveLength(1)
    expect(payload.menus[0].id).toBe('main-menu')
    expect(payload.menus[0].title.translations.en).toBe('Main Menu')
    expect(payload.menus[0].category_ids).toContain('cat-cat-1')

    // Check categories
    expect(payload.categories).toHaveLength(1)
    expect(payload.categories[0].id).toBe('cat-cat-1')
    expect(payload.categories[0].title.translations.en).toBe('Pizzas')
    expect(payload.categories[0].entities).toHaveLength(1)
    expect(payload.categories[0].entities[0].id).toBe('item-prod-1')
    expect(payload.categories[0].entities[0].type).toBe('ITEM')

    // Check items
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].id).toBe('item-prod-1')
    expect(payload.items[0].title.translations.en).toBe('Margherita')
    expect(payload.items[0].price_info.price).toBe(1250) // 12.50 * 100
    expect(payload.items[0].tax_info?.tax_rate).toBe(0.1)
  })

  it('should filter out inactive products and categories', () => {
    const activeCategory = createMockCategory({ _id: 'cat-1', isActive: true })
    const inactiveCategory = createMockCategory({ _id: 'cat-2', isActive: false })

    const activeProduct = createMockProduct({ _id: 'prod-1', categoryId: 'cat-1', isActive: true })
    const inactiveProduct = createMockProduct({ _id: 'prod-2', categoryId: 'cat-1', isActive: false })

    const payload = buildUberEatsMenuPayload(
      [activeProduct, inactiveProduct],
      [activeCategory, inactiveCategory]
    )

    // Only active category should be included
    expect(payload.categories).toHaveLength(1)
    expect(payload.categories[0].id).toBe('cat-cat-1')

    // Only active product should be included
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].id).toBe('item-prod-1')
  })

  it('should skip categories with no active products', () => {
    const category1 = createMockCategory({ _id: 'cat-1', name: 'With Products' })
    const category2 = createMockCategory({ _id: 'cat-2', name: 'Empty Category' })

    const product = createMockProduct({ categoryId: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category1, category2])

    // Only category with products should be included
    expect(payload.categories).toHaveLength(1)
    expect(payload.categories[0].title.translations.en).toBe('With Products')
    expect(payload.menus[0].category_ids).toHaveLength(1)
  })

  it('should convert prices from euros to cents correctly', () => {
    const products = [
      createMockProduct({ price: 10.0 }),
      createMockProduct({ price: 12.5 }),
      createMockProduct({ price: 9.99 }),
      createMockProduct({ price: 0.5 }),
    ]
    const category = createMockCategory({ _id: 'cat-1' })

    products.forEach((p) => (p.categoryId = 'cat-1'))

    const payload = buildUberEatsMenuPayload(products, [category])

    expect(payload.items[0].price_info.price).toBe(1000)
    expect(payload.items[1].price_info.price).toBe(1250)
    expect(payload.items[2].price_info.price).toBe(999)
    expect(payload.items[3].price_info.price).toBe(50)
  })

  it('should map product options to modifier groups', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [
        {
          id: 'opt-1',
          name: 'Size',
          required: true,
          maxSelections: 1,
          choices: [
            { id: 'choice-1', name: 'Small', priceModifier: 0 },
            { id: 'choice-2', name: 'Large', priceModifier: 3.0 },
          ],
        },
      ],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    // Should have modifier groups
    expect(payload.modifier_groups).toBeDefined()
    expect(payload.modifier_groups).toHaveLength(1)

    const modGroup = payload.modifier_groups![0]
    expect(modGroup.id).toBe('mg-prod-1-opt-1')
    expect(modGroup.title.translations.en).toBe('Size')
    expect(modGroup.quantity_info.quantity.min_permitted).toBe(1) // Required
    expect(modGroup.quantity_info.quantity.max_permitted).toBe(1)
    expect(modGroup.modifier_options).toHaveLength(2)

    // Should have modifier items
    const modItems = payload.items.filter((item) => item.id.startsWith('mod-'))
    expect(modItems).toHaveLength(2)
    expect(modItems[0].title.translations.en).toBe('Small')
    expect(modItems[0].price_info.price).toBe(0)
    expect(modItems[1].title.translations.en).toBe('Large')
    expect(modItems[1].price_info.price).toBe(300) // 3.0 * 100

    // Main item should reference modifier group
    const mainItem = payload.items.find((item) => item.id === 'item-prod-1')
    expect(mainItem?.modifier_group_ids?.ids).toContain('mg-prod-1-opt-1')
  })

  it('should handle products without options', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: undefined,
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const mainItem = payload.items.find((item) => item.id === 'item-prod-1')
    expect(mainItem?.modifier_group_ids).toBeUndefined()
    expect(payload.modifier_groups).toEqual([])
  })

  it('should handle empty options array', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const mainItem = payload.items.find((item) => item.id === 'item-prod-1')
    expect(mainItem?.modifier_group_ids).toBeUndefined()
    expect(payload.modifier_groups).toEqual([])
  })

  it('should use external IDs when available for modifier IDs', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [
        {
          id: 'opt-1',
          name: 'Size',
          required: false,
          externalIds: {
            uberEatsId: 'uber-mg-123',
          },
          choices: [
            {
              id: 'choice-1',
              name: 'Large',
              priceModifier: 2.0,
              externalIds: {
                uberEatsId: 'uber-mod-456',
              },
            },
          ],
        },
      ],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    // Should use external ID for modifier group
    expect(payload.modifier_groups![0].id).toBe('uber-mg-123')

    // Should use external ID for modifier item
    const modItem = payload.items.find((item) => item.id.startsWith('uber-mod'))
    expect(modItem?.id).toBe('uber-mod-456')

    // Main item should reference external modifier group ID
    const mainItem = payload.items.find((item) => item.id === 'item-prod-1')
    expect(mainItem?.modifier_group_ids?.ids).toContain('uber-mg-123')
  })

  it('should generate full-week service availability', () => {
    const product = createMockProduct({ categoryId: 'cat-1' })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const serviceAvailability = payload.menus[0].service_availability

    expect(serviceAvailability).toHaveLength(7)

    const expectedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    expectedDays.forEach((day, index) => {
      expect(serviceAvailability[index].day_of_week).toBe(day)
      expect(serviceAvailability[index].time_periods).toHaveLength(1)
      expect(serviceAvailability[index].time_periods[0]).toEqual({
        start_time: '00:00',
        end_time: '23:59',
      })
    })
  })

  it('should handle multiple products with multiple options', () => {
    const products = [
      createMockProduct({
        _id: 'prod-1',
        categoryId: 'cat-1',
        name: 'Pizza',
        options: [
          {
            id: 'opt-1',
            name: 'Size',
            required: true,
            choices: [
              { id: 'choice-1', name: 'Small', priceModifier: 0 },
              { id: 'choice-2', name: 'Large', priceModifier: 3.0 },
            ],
          },
          {
            id: 'opt-2',
            name: 'Toppings',
            required: false,
            maxSelections: 3,
            choices: [
              { id: 'choice-3', name: 'Mushrooms', priceModifier: 1.5 },
              { id: 'choice-4', name: 'Olives', priceModifier: 1.0 },
            ],
          },
        ],
      }),
      createMockProduct({
        _id: 'prod-2',
        categoryId: 'cat-1',
        name: 'Salad',
        options: [
          {
            id: 'opt-3',
            name: 'Dressing',
            required: true,
            choices: [{ id: 'choice-5', name: 'Caesar', priceModifier: 0 }],
          },
        ],
      }),
    ]
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload(products, [category])

    // Should have 3 modifier groups total
    expect(payload.modifier_groups).toHaveLength(3)

    // First product should have 2 modifier groups
    const prod1Item = payload.items.find((item) => item.id === 'item-prod-1')
    expect(prod1Item?.modifier_group_ids?.ids).toHaveLength(2)

    // Second product should have 1 modifier group
    const prod2Item = payload.items.find((item) => item.id === 'item-prod-2')
    expect(prod2Item?.modifier_group_ids?.ids).toHaveLength(1)

    // Should have 5 modifier items + 2 main items = 7 total items
    expect(payload.items).toHaveLength(7)
  })

  it('should handle non-required modifier groups', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [
        {
          id: 'opt-1',
          name: 'Extra Toppings',
          required: false,
          maxSelections: 5,
          choices: [{ id: 'choice-1', name: 'Extra Cheese', priceModifier: 2.0 }],
        },
      ],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const modGroup = payload.modifier_groups![0]
    expect(modGroup.quantity_info.quantity.min_permitted).toBe(0) // Not required
    expect(modGroup.quantity_info.quantity.max_permitted).toBe(5)
  })

  it('should default max_permitted to number of choices when not specified', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [
        {
          id: 'opt-1',
          name: 'Toppings',
          required: false,
          // maxSelections not specified
          choices: [
            { id: 'choice-1', name: 'Mushrooms', priceModifier: 1.0 },
            { id: 'choice-2', name: 'Olives', priceModifier: 1.0 },
            { id: 'choice-3', name: 'Peppers', priceModifier: 1.0 },
          ],
        },
      ],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const modGroup = payload.modifier_groups![0]
    expect(modGroup.quantity_info.quantity.max_permitted).toBe(3) // Number of choices
  })

  it('should include product description when available', () => {
    const productWithDesc = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      description: 'Delicious pizza with fresh ingredients',
    })
    const productWithoutDesc = createMockProduct({
      _id: 'prod-2',
      categoryId: 'cat-1',
      description: undefined,
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([productWithDesc, productWithoutDesc], [category])

    const itemWithDesc = payload.items.find((item) => item.id === 'item-prod-1')
    expect(itemWithDesc?.description?.translations.en).toBe('Delicious pizza with fresh ingredients')

    const itemWithoutDesc = payload.items.find((item) => item.id === 'item-prod-2')
    expect(itemWithoutDesc?.description).toBeUndefined()
  })

  it('should include first image as image_url', () => {
    const productWithImages = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    })
    const productWithoutImages = createMockProduct({
      _id: 'prod-2',
      categoryId: 'cat-1',
      images: [],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([productWithImages, productWithoutImages], [category])

    const itemWithImage = payload.items.find((item) => item.id === 'item-prod-1')
    expect(itemWithImage?.image_url).toBe('https://example.com/image1.jpg')

    const itemWithoutImage = payload.items.find((item) => item.id === 'item-prod-2')
    expect(itemWithoutImage?.image_url).toBeUndefined()
  })

  it('should include tax_info only when tax rate is greater than 0', () => {
    const productWithTax = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      taxRate: 0.2,
    })
    const productWithoutTax = createMockProduct({
      _id: 'prod-2',
      categoryId: 'cat-1',
      taxRate: 0,
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([productWithTax, productWithoutTax], [category])

    const itemWithTax = payload.items.find((item) => item.id === 'item-prod-1')
    expect(itemWithTax?.tax_info?.tax_rate).toBe(0.2)

    const itemWithoutTax = payload.items.find((item) => item.id === 'item-prod-2')
    expect(itemWithoutTax?.tax_info).toBeUndefined()
  })

  it('should include external_data with product _id', () => {
    const product = createMockProduct({ _id: 'prod-123', categoryId: 'cat-1' })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const mainItem = payload.items.find((item) => item.id === 'item-prod-123')
    expect(mainItem?.external_data).toBe('prod-123')
  })

  it('should include external_data with choice id for modifier items', () => {
    const product = createMockProduct({
      _id: 'prod-1',
      categoryId: 'cat-1',
      options: [
        {
          id: 'opt-1',
          name: 'Size',
          required: true,
          choices: [{ id: 'choice-abc', name: 'Large', priceModifier: 2.0 }],
        },
      ],
    })
    const category = createMockCategory({ _id: 'cat-1' })

    const payload = buildUberEatsMenuPayload([product], [category])

    const modItem = payload.items.find((item) => item.id.includes('choice-abc'))
    expect(modItem?.external_data).toBe('choice-abc')
  })

  it('should handle multiple categories with products', () => {
    const category1 = createMockCategory({ _id: 'cat-1', name: 'Pizzas' })
    const category2 = createMockCategory({ _id: 'cat-2', name: 'Salads' })

    const product1 = createMockProduct({ _id: 'prod-1', categoryId: 'cat-1', name: 'Margherita' })
    const product2 = createMockProduct({ _id: 'prod-2', categoryId: 'cat-2', name: 'Caesar Salad' })

    const payload = buildUberEatsMenuPayload([product1, product2], [category1, category2])

    expect(payload.categories).toHaveLength(2)
    expect(payload.menus[0].category_ids).toHaveLength(2)
    expect(payload.items).toHaveLength(2)

    expect(payload.categories[0].title.translations.en).toBe('Pizzas')
    expect(payload.categories[1].title.translations.en).toBe('Salads')
  })
})
