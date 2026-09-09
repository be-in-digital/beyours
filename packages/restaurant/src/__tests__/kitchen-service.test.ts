/**
 * Kitchen Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  createTicketFromOrder,
  assignStation,
  getPriorityLevel,
  getTicketColor,
  calculateElapsedTime,
  isOverdue,
} from '../services/kitchen'
import type { OrderDoc, OrderItem } from '../types'

describe('Kitchen Service', () => {
  describe('createTicketFromOrder', () => {
    it('should create kitchen ticket from order', () => {
      const order: OrderDoc = {
        _id: 'o1',
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        storeId: 's1',
        orderNumber: '0001',
        customerId: 'c1',
        type: 'pickup',
        status: 'confirmed',
        paymentStatus: 'pending',
        source: 'website',
        customerInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+33123456789',
        },
        items: [
          {
            productId: 'p1',
            productName: 'Burger',
            quantity: 2,
            unitPrice: 1000,
            selectedOptions: [
              {
                optionId: 'o1',
                optionName: 'Size',
                choiceId: 'c1',
                choiceName: 'Large',
                priceModifier: 200,
              },
            ],
            subtotal: 2400,
            notes: 'No onions',
          },
        ],
        subtotal: 2400,
        taxAmount: 480,
        total: 2880,
      }

      const ticket = createTicketFromOrder(order, 's1')

      expect(ticket.orderId).toBe('o1')
      expect(ticket.orderNumber).toBe('0001')
      expect(ticket.orderType).toBe('pickup')
      expect(ticket.items).toHaveLength(1)
      expect(ticket.items[0].productName).toBe('Burger')
      expect(ticket.items[0].quantity).toBe(2)
      expect(ticket.items[0].options).toContain('Size: Large')
      expect(ticket.items[0].notes).toBe('No onions')
    })
  })

  describe('assignStation', () => {
    it('should assign items to stations based on mapping', () => {
      const items: OrderItem[] = [
        {
          productId: 'p1',
          productName: 'Burger',
          quantity: 1,
          unitPrice: 1000,
          selectedOptions: [],
          subtotal: 1000,
        },
        {
          productId: 'p2',
          productName: 'Fries',
          quantity: 1,
          unitPrice: 500,
          selectedOptions: [],
          subtotal: 500,
        },
      ]

      const mapping = {
        p1: 'grill',
        p2: 'fryer',
      }

      const stations = assignStation(items, mapping)

      expect(stations['grill']).toHaveLength(1)
      expect(stations['grill'][0].productName).toBe('Burger')
      expect(stations['fryer']).toHaveLength(1)
      expect(stations['fryer'][0].productName).toBe('Fries')
    })

    it('should assign to general station when no mapping', () => {
      const items: OrderItem[] = [
        {
          productId: 'p1',
          productName: 'Burger',
          quantity: 1,
          unitPrice: 1000,
          selectedOptions: [],
          subtotal: 1000,
        },
      ]

      const stations = assignStation(items, {})

      expect(stations['general']).toHaveLength(1)
    })
  })

  describe('getPriorityLevel', () => {
    const baseOrder: OrderDoc = {
      _id: 'o1',
      _creationTime: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      storeId: 's1',
      orderNumber: '0001',
      type: 'pickup',
      status: 'confirmed',
      paymentStatus: 'pending',
      source: 'website',
      customerInfo: { name: 'John Doe' },
      items: [],
      subtotal: 1000,
      taxAmount: 200,
      total: 1200,
    }

    it('should return VIP for external platform orders', () => {
      const uberOrder = { ...baseOrder, source: 'uber_eats' as const }
      expect(getPriorityLevel(uberOrder)).toBe('vip')

      const deliverooOrder = { ...baseOrder, source: 'deliveroo' as const }
      expect(getPriorityLevel(deliverooOrder)).toBe('vip')
    })

    it('should return urgent for delivery orders', () => {
      const deliveryOrder = { ...baseOrder, type: 'delivery' as const }
      expect(getPriorityLevel(deliveryOrder)).toBe('urgent')
    })

    /*
     * Two cases stood here, both keyed on the order's `scheduledFor`: that a
     * scheduled order is not urgent, and that a scheduled *delivery* still
     * is. The field had no writer anywhere and was removed with #413, so
     * both were asserting the ranking of an order this product cannot take.
     * What they were really pinning — that being a delivery is what makes an
     * order urgent, and that nothing else about it raises the priority — is
     * the pair of cases immediately above and below.
     */

    it('should return normal for pickup orders', () => {
      expect(getPriorityLevel(baseOrder)).toBe('normal')
    })
  })

  describe('getTicketColor', () => {
    it('should return correct color for each status', () => {
      expect(getTicketColor('pending')).toContain('yellow')
      expect(getTicketColor('in_progress')).toContain('blue')
      expect(getTicketColor('ready')).toContain('green')
      expect(getTicketColor('completed')).toContain('gray')
    })
  })

  describe('calculateElapsedTime', () => {
    it('should calculate elapsed time in minutes', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000
      const elapsed = calculateElapsedTime(tenMinutesAgo)
      expect(elapsed).toBe(10)
    })
  })

  describe('isOverdue', () => {
    it('should return true when elapsed time exceeds max prep time', () => {
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
      expect(isOverdue(thirtyMinutesAgo, 20)).toBe(true)
    })

    it('should return false when within max prep time', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000
      expect(isOverdue(tenMinutesAgo, 20)).toBe(false)
    })
  })
})
