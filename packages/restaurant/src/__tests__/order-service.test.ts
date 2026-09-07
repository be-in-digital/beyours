/**
 * Order Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  getNextStatus,
  canTransitionTo,
  estimatePreparationTime,
  formatOrderNumber,
  getOrderStatusColor,
  getOrderStatusLabel,
  isOrderActive,
} from '../services/order'
import type { OrderStatus, CartItem } from '../types'

describe('Order Service', () => {
  describe('getNextStatus', () => {
    it('should return valid next statuses for pending', () => {
      const next = getNextStatus('pending')
      expect(next).toContain('confirmed')
      expect(next).toContain('cancelled')
    })

    it('should return valid next statuses for confirmed', () => {
      const next = getNextStatus('confirmed')
      expect(next).toContain('preparing')
      expect(next).toContain('cancelled')
    })

    it('should return empty array for completed', () => {
      const next = getNextStatus('completed')
      expect(next).toHaveLength(0)
    })
  })

  describe('canTransitionTo', () => {
    it('should allow valid transitions', () => {
      expect(canTransitionTo('pending', 'confirmed')).toBe(true)
      expect(canTransitionTo('confirmed', 'preparing')).toBe(true)
      expect(canTransitionTo('preparing', 'ready')).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(canTransitionTo('pending', 'ready')).toBe(false)
      expect(canTransitionTo('completed', 'pending')).toBe(false)
      expect(canTransitionTo('cancelled', 'preparing')).toBe(false)
    })
  })

  describe('estimatePreparationTime', () => {
    it('should estimate prep time based on items', () => {
      const items: CartItem[] = [
        {
          productId: 'p1',
          name: 'Burger',
          price: 1000,
          quantity: 2,
          options: [],
        },
        {
          productId: 'p2',
          name: 'Fries',
          price: 500,
          quantity: 1,
          options: [],
        },
      ]

      const time = estimatePreparationTime(items)
      expect(time).toBeGreaterThan(0)
      expect(time).toBeLessThanOrEqual(60) // Cap at 60 minutes
    })

    it('should cap prep time at 60 minutes', () => {
      const items: CartItem[] = Array(20).fill({
        productId: 'p1',
        name: 'Burger',
        price: 1000,
        quantity: 5,
        options: [],
      })

      const time = estimatePreparationTime(items)
      expect(time).toBe(60)
    })
  })

  describe('formatOrderNumber', () => {
    it('should format numeric order number', () => {
      expect(formatOrderNumber('1')).toBe('#0001')
      expect(formatOrderNumber('42')).toBe('#0042')
      expect(formatOrderNumber('1234')).toBe('#1234')
    })

    it('should not format non-numeric order number', () => {
      expect(formatOrderNumber('ORD-123')).toBe('ORD-123')
    })
  })

  describe('getOrderStatusColor', () => {
    it('should return correct color for each status', () => {
      const statuses: OrderStatus[] = [
        'pending',
        'confirmed',
        'preparing',
        'ready',
        'out_for_delivery',
        'delivered',
        'completed',
        'cancelled',
      ]

      statuses.forEach((status) => {
        const color = getOrderStatusColor(status)
        expect(color).toBeTruthy()
        expect(color).toContain('text-')
        expect(color).toContain('bg-')
      })
    })
  })

  describe('getOrderStatusLabel', () => {
    /**
     * REWRITTEN. These three assertions read 'Pending', 'Confirmed' and
     * 'Out for Delivery' — they pinned an English label map living one package
     * away from a badge that held a second English map of the same eight words,
     * both of them mounted on French screens. The words now come from the one
     * vocabulary in `@be-in-digital/core/status-labels`, in the language this
     * product is written in.
     */
    it('returns the source-language word for a status', () => {
      expect(getOrderStatusLabel('pending')).toBe('En attente')
      expect(getOrderStatusLabel('confirmed')).toBe('Confirmée')
      expect(getOrderStatusLabel('out_for_delivery')).toBe('En livraison')
    })

    it('falls back to the status itself for one it does not know', () => {
      expect(getOrderStatusLabel('archived' as never)).toBe('archived')
    })
  })

  describe('isOrderActive', () => {
    it('should return true for active statuses', () => {
      expect(isOrderActive('pending')).toBe(true)
      expect(isOrderActive('confirmed')).toBe(true)
      expect(isOrderActive('preparing')).toBe(true)
      expect(isOrderActive('ready')).toBe(true)
    })

    it('should return false for inactive statuses', () => {
      expect(isOrderActive('completed')).toBe(false)
      expect(isOrderActive('cancelled')).toBe(false)
    })
  })
})
