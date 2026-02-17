/**
 * Tests for Uber Eats order mapping to unified format
 */

import { describe, it, expect } from 'vitest'
import { mapUberEatsOrderToUnified } from '../mappers'
import type { UberEatsOrder, UberEatsMoney, UberEatsCartItem } from '../types'

const STORE_ID = '480eab8c-cc25-4c2b-b92f-70d7a1984f97'

/**
 * Helper to create UberEatsMoney object
 */
function createMoney(amount: number, currencyCode = 'USD'): UberEatsMoney {
  return {
    amount,
    currency_code: currencyCode,
    formatted_amount: `$${(amount / 100).toFixed(2)}`,
  }
}

/**
 * Helper to create a complete mock UberEatsOrder
 */
function createMockUberEatsOrder(overrides?: Partial<UberEatsOrder>): UberEatsOrder {
  return {
    id: 'uber-order-123',
    display_id: '#1234',
    current_state: 'ACCEPTED',
    type: 'DELIVERY_BY_UBER',
    store: {
      id: STORE_ID,
      name: 'Test Restaurant',
    },
    eater: {
      first_name: 'John',
      last_name: 'Doe',
      phone: '+33612345678',
    },
    cart: {
      items: [
        {
          id: 'item-1',
          instance_id: 'inst-1',
          title: 'Margherita Pizza',
          quantity: 2,
          price: createMoney(1200),
          special_instructions: 'Extra crispy',
          selected_modifier_groups: [
            {
              id: 'mg-1',
              title: 'Size',
              selected_items: [
                {
                  id: 'mod-1',
                  title: 'Large',
                  quantity: 1,
                  price: createMoney(300),
                },
              ],
            },
          ],
        },
      ],
      special_instructions: 'Please ring doorbell',
    },
    payment: {
      charges: {
        total: createMoney(3000),
        sub_total: createMoney(2400),
        tax: createMoney(240),
        total_fee: createMoney(360),
        delivery_fee: createMoney(200),
        promotions: {
          total: createMoney(100),
        },
      },
      accounting: {
        tax_remittance: {
          tax: createMoney(240),
        },
      },
    },
    placed_at: '2024-02-15T10:30:00Z',
    delivery_info: {
      estimated_delivery_time: '2024-02-15T11:00:00Z',
    },
    ...overrides,
  }
}

describe('mapUberEatsOrderToUnified', () => {
  it('should map a complete Uber Eats order to unified format', () => {
    const uberOrder = createMockUberEatsOrder()
    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(result).toMatchObject({
      externalOrderId: 'uber-order-123',
      platform: 'uberEats',
      storeExternalId: STORE_ID,
      displayId: '#1234',
      status: 'confirmed',
      type: 'delivery',
      customer: {
        name: 'John Doe',
        phone: '+33612345678',
      },
      subtotal: 24.0,
      taxAmount: 2.4,
      deliveryFee: 2.0,
      discountAmount: 1.0,
      total: 30.0,
      currency: 'USD',
      notes: 'Please ring doorbell',
      placedAt: '2024-02-15T10:30:00Z',
    })
  })

  it('should map order type DELIVERY_BY_UBER to delivery', () => {
    const uberOrder = createMockUberEatsOrder({ type: 'DELIVERY_BY_UBER' })
    const result = mapUberEatsOrderToUnified(uberOrder)
    expect(result.type).toBe('delivery')
    expect(result.delivery).toBeDefined()
    expect(result.delivery?.type).toBe('delivery')
  })

  it('should map order type DELIVERY_BY_RESTAURANT to delivery', () => {
    const uberOrder = createMockUberEatsOrder({ type: 'DELIVERY_BY_RESTAURANT' })
    const result = mapUberEatsOrderToUnified(uberOrder)
    expect(result.type).toBe('delivery')
    expect(result.delivery).toBeDefined()
  })

  it('should map order type PICK_UP to pickup', () => {
    const uberOrder = createMockUberEatsOrder({ type: 'PICK_UP' })
    const result = mapUberEatsOrderToUnified(uberOrder)
    expect(result.type).toBe('pickup')
    expect(result.delivery).toBeUndefined()
  })

  it('should map order type DINE_IN to dine_in', () => {
    const uberOrder = createMockUberEatsOrder({ type: 'DINE_IN' })
    const result = mapUberEatsOrderToUnified(uberOrder)
    expect(result.type).toBe('dine_in')
    expect(result.delivery).toBeUndefined()
  })

  it('should map status correctly using UBER_EATS_STATUS_MAP', () => {
    const statusTests = [
      { uberStatus: 'CREATED', expected: 'pending' },
      { uberStatus: 'ACCEPTED', expected: 'confirmed' },
      { uberStatus: 'DENIED', expected: 'denied' },
      { uberStatus: 'IN_PROGRESS', expected: 'preparing' },
      { uberStatus: 'READY_FOR_PICKUP', expected: 'ready' },
      { uberStatus: 'PICKED_UP', expected: 'out_for_delivery' },
      { uberStatus: 'DELIVERED', expected: 'delivered' },
      { uberStatus: 'CANCELLED', expected: 'cancelled' },
      { uberStatus: 'FINISHED', expected: 'completed' },
    ]

    for (const { uberStatus, expected } of statusTests) {
      const uberOrder = createMockUberEatsOrder({ current_state: uberStatus })
      const result = mapUberEatsOrderToUnified(uberOrder)
      expect(result.status).toBe(expected)
    }
  })

  it('should default to pending for unknown status', () => {
    const uberOrder = createMockUberEatsOrder({ current_state: 'UNKNOWN_STATUS' })
    const result = mapUberEatsOrderToUnified(uberOrder)
    expect(result.status).toBe('pending')
  })

  it('should convert prices from cents to decimal correctly', () => {
    const uberOrder = createMockUberEatsOrder({
      payment: {
        charges: {
          total: createMoney(5000),
          sub_total: createMoney(4500),
          tax: createMoney(450),
          total_fee: createMoney(50),
          delivery_fee: createMoney(350),
        },
        accounting: {
          tax_remittance: {
            tax: createMoney(450),
          },
        },
      },
    })

    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(result.total).toBe(50.0)
    expect(result.subtotal).toBe(45.0)
    expect(result.taxAmount).toBe(4.5)
    expect(result.deliveryFee).toBe(3.5)
  })

  it('should map modifiers correctly', () => {
    const uberOrder = createMockUberEatsOrder()
    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].modifiers).toHaveLength(1)
    expect(result.items[0].modifiers[0]).toMatchObject({
      externalId: 'mod-1',
      name: 'Large',
      quantity: 1,
      price: 3.0,
    })
  })

  it('should calculate item total price including modifiers', () => {
    const uberOrder = createMockUberEatsOrder()
    const result = mapUberEatsOrderToUnified(uberOrder)

    const item = result.items[0]
    // Unit price: 12.00, modifier: 3.00, quantity: 2
    // Expected: (12.00 + 3.00) * 2 = 30.00
    expect(item.unitPrice).toBe(12.0)
    expect(item.totalPrice).toBe(30.0)
  })

  it('should handle items with multiple modifier groups', () => {
    const uberOrder = createMockUberEatsOrder({
      cart: {
        items: [
          {
            id: 'item-1',
            instance_id: 'inst-1',
            title: 'Custom Pizza',
            quantity: 1,
            price: createMoney(1000),
            selected_modifier_groups: [
              {
                id: 'mg-1',
                title: 'Size',
                selected_items: [
                  {
                    id: 'mod-1',
                    title: 'Large',
                    quantity: 1,
                    price: createMoney(200),
                  },
                ],
              },
              {
                id: 'mg-2',
                title: 'Toppings',
                selected_items: [
                  {
                    id: 'mod-2',
                    title: 'Extra Cheese',
                    quantity: 1,
                    price: createMoney(150),
                  },
                  {
                    id: 'mod-3',
                    title: 'Mushrooms',
                    quantity: 1,
                    price: createMoney(100),
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    const result = mapUberEatsOrderToUnified(uberOrder)
    const item = result.items[0]

    expect(item.modifiers).toHaveLength(3)
    expect(item.modifiers[0]).toMatchObject({ externalId: 'mod-1', name: 'Large', price: 2.0 })
    expect(item.modifiers[1]).toMatchObject({ externalId: 'mod-2', name: 'Extra Cheese', price: 1.5 })
    expect(item.modifiers[2]).toMatchObject({ externalId: 'mod-3', name: 'Mushrooms', price: 1.0 })
    // Total: 10.00 + 2.00 + 1.50 + 1.00 = 14.50
    expect(item.totalPrice).toBe(14.5)
  })

  it('should handle missing optional fields', () => {
    const minimalOrder = createMockUberEatsOrder({
      eater: {
        first_name: 'Jane',
        last_name: 'Smith',
        // phone is optional
      },
      cart: {
        items: [
          {
            id: 'item-1',
            instance_id: 'inst-1',
            title: 'Simple Item',
            quantity: 1,
            price: createMoney(500),
            // no special_instructions
            // no selected_modifier_groups
          },
        ],
        // no special_instructions
      },
      payment: {
        charges: {
          total: createMoney(600),
          sub_total: createMoney(500),
          tax: createMoney(50),
          total_fee: createMoney(50),
          // no delivery_fee
          // no promotions
        },
        accounting: {
          tax_remittance: {
            tax: createMoney(50),
          },
        },
      },
      type: 'PICK_UP',
      // no delivery_info
    })

    const result = mapUberEatsOrderToUnified(minimalOrder)

    expect(result.customer.name).toBe('Jane Smith')
    expect(result.customer.phone).toBeUndefined()
    expect(result.items[0].notes).toBeUndefined()
    expect(result.items[0].modifiers).toHaveLength(0)
    expect(result.notes).toBeUndefined()
    expect(result.deliveryFee).toBe(0)
    expect(result.discountAmount).toBe(0)
    expect(result.delivery).toBeUndefined()
  })

  it('should handle multiple items in cart', () => {
    const uberOrder = createMockUberEatsOrder({
      cart: {
        items: [
          {
            id: 'item-1',
            instance_id: 'inst-1',
            title: 'Margherita Pizza',
            quantity: 2,
            price: createMoney(1200),
          },
          {
            id: 'item-2',
            instance_id: 'inst-2',
            title: 'Caesar Salad',
            quantity: 1,
            price: createMoney(800),
          },
        ],
      },
    })

    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(result.items).toHaveLength(2)
    expect(result.items[0].name).toBe('Margherita Pizza')
    expect(result.items[1].name).toBe('Caesar Salad')
  })

  it('should include raw data as JSON string', () => {
    const uberOrder = createMockUberEatsOrder()
    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(typeof result.rawData).toBe('string')
    const parsed = JSON.parse(result.rawData)
    expect(parsed).toEqual(uberOrder)
  })

  it('should trim customer name correctly', () => {
    const tests = [
      { first: 'John', last: 'Doe', expected: 'John Doe' },
      { first: 'Jane', last: '', expected: 'Jane' },
      { first: '', last: 'Smith', expected: 'Smith' },
      { first: '  John  ', last: '  Doe  ', expected: 'John     Doe' }, // spaces preserved between
    ]

    for (const { first, last, expected } of tests) {
      const uberOrder = createMockUberEatsOrder({
        eater: { first_name: first, last_name: last },
      })
      const result = mapUberEatsOrderToUnified(uberOrder)
      expect(result.customer.name.trim()).toBe(expected.trim())
    }
  })

  it('should include estimated delivery time when available', () => {
    const uberOrder = createMockUberEatsOrder({
      type: 'DELIVERY_BY_UBER',
      delivery_info: {
        estimated_delivery_time: '2024-02-15T12:00:00Z',
      },
    })

    const result = mapUberEatsOrderToUnified(uberOrder)

    expect(result.delivery?.estimatedDeliveryTime).toBe('2024-02-15T12:00:00Z')
  })

  it('should handle modifier quantities correctly', () => {
    const uberOrder = createMockUberEatsOrder({
      cart: {
        items: [
          {
            id: 'item-1',
            instance_id: 'inst-1',
            title: 'Burger',
            quantity: 1,
            price: createMoney(1000),
            selected_modifier_groups: [
              {
                id: 'mg-1',
                title: 'Extra Patties',
                selected_items: [
                  {
                    id: 'mod-1',
                    title: 'Beef Patty',
                    quantity: 3, // Customer wants 3 extra patties
                    price: createMoney(200),
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    const result = mapUberEatsOrderToUnified(uberOrder)
    const modifier = result.items[0].modifiers[0]

    expect(modifier.quantity).toBe(3)
    expect(modifier.price).toBe(2.0)
  })
})
