/**
 * Store Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  isStoreOpen,
  getNextOpenTime,
  formatStoreAddress,
  getStoreDistance,
  sortStoresByDistance,
} from '../services/store'
import type { BusinessHours, Address, StoreDoc } from '../types'

describe('Store Service', () => {
  describe('isStoreOpen', () => {
    it('should return open when current time is within hours', () => {
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false }, // Monday
      ]

      // Create a Monday at 12:00
      const monday = new Date('2024-01-01T12:00:00') // 2024-01-01 is a Monday

      const result = isStoreOpen(hours, monday)

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '09:00', close: '18:00' })
    })

    it('should return closed when current time is outside hours', () => {
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false }, // Monday
      ]

      // Create a Monday at 20:00
      const monday = new Date('2024-01-01T20:00:00')

      const result = isStoreOpen(hours, monday)

      expect(result.isOpen).toBe(false)
    })

    it('should return closed when day is marked as closed', () => {
      const hours: BusinessHours[] = [
        { day: 0, open: '09:00', close: '18:00', isClosed: true }, // Sunday closed
      ]

      // Create a Sunday at 12:00
      const sunday = new Date('2024-01-07T12:00:00') // 2024-01-07 is a Sunday

      const result = isStoreOpen(hours, sunday)

      expect(result.isOpen).toBe(false)
    })
  })

  describe('getNextOpenTime', () => {
    it('should return next opening time', () => {
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false }, // Monday
        { day: 2, open: '09:00', close: '18:00', isClosed: false }, // Tuesday
      ]

      // Create a Monday at 20:00 (after close)
      const monday = new Date('2024-01-01T20:00:00')

      const result = getNextOpenTime(hours, monday)

      expect(result).not.toBeNull()
      expect(result?.getDay()).toBe(2) // Tuesday
      expect(result?.getHours()).toBe(9)
    })

    it('should return null when store never opens', () => {
      const hours: BusinessHours[] = [
        { day: 0, open: '09:00', close: '18:00', isClosed: true },
        { day: 1, open: '09:00', close: '18:00', isClosed: true },
        { day: 2, open: '09:00', close: '18:00', isClosed: true },
        { day: 3, open: '09:00', close: '18:00', isClosed: true },
        { day: 4, open: '09:00', close: '18:00', isClosed: true },
        { day: 5, open: '09:00', close: '18:00', isClosed: true },
        { day: 6, open: '09:00', close: '18:00', isClosed: true },
      ]

      const result = getNextOpenTime(hours)

      expect(result).toBeNull()
    })
  })

  describe('formatStoreAddress', () => {
    it('should format address correctly', () => {
      const address: Address = {
        street: '123 Main St',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      }

      const formatted = formatStoreAddress(address)

      expect(formatted).toBe('123 Main St, 75001 Paris, FR')
    })
  })

  describe('getStoreDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // Paris coordinates
      const storeLat = 48.8566
      const storeLng = 2.3522

      // Lyon coordinates (approx 392km from Paris)
      const userLat = 45.764
      const userLng = 4.8357

      const distance = getStoreDistance(storeLat, storeLng, userLat, userLng)

      // Should be approximately 392km
      expect(distance).toBeGreaterThan(390)
      expect(distance).toBeLessThan(400)
    })

    it('should return 0 for same coordinates', () => {
      const lat = 48.8566
      const lng = 2.3522

      const distance = getStoreDistance(lat, lng, lat, lng)

      expect(distance).toBe(0)
    })
  })

  describe('sortStoresByDistance', () => {
    it('should sort stores by distance from user', () => {
      const stores: StoreDoc[] = [
        {
          _id: 's1',
          _creationTime: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          name: 'Store 1',
          slug: 'store-1',
          address: {
            street: 'Street 1',
            city: 'City',
            postalCode: '12345',
            country: 'FR',
            latitude: 45.764, // Lyon
            longitude: 4.8357,
          },
          settings: {
            currency: 'EUR',
            timezone: 'Europe/Paris',
            deliveryEnabled: false,
            pickupEnabled: true,
            dineInEnabled: false,
          },
          status: 'open',
        },
        {
          _id: 's2',
          _creationTime: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          name: 'Store 2',
          slug: 'store-2',
          address: {
            street: 'Street 2',
            city: 'City',
            postalCode: '12345',
            country: 'FR',
            latitude: 48.8566, // Paris (closer to reference point)
            longitude: 2.3522,
          },
          settings: {
            currency: 'EUR',
            timezone: 'Europe/Paris',
            deliveryEnabled: false,
            pickupEnabled: true,
            dineInEnabled: false,
          },
          status: 'open',
        },
      ]

      // User in Paris area
      const userLat = 48.85
      const userLng = 2.35

      const sorted = sortStoresByDistance(stores, userLat, userLng)

      expect(sorted[0]._id).toBe('s2') // Paris store first
      expect(sorted[1]._id).toBe('s1') // Lyon store second
    })
  })
})
