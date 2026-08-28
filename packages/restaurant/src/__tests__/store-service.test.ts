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

  // ==========================================================================
  // Services that cross midnight (#126)
  //
  // The comparison was `now >= open && now < close` on "HH:mm" strings, with no
  // wrap, so an evening restaurant read as closed all evening. The boolean
  // disables add-to-cart everywhere and blocks checkout, so the shipped
  // `fast-food-minuit` vertical and the food trucks could not sell anything.
  //
  // 2024-01-05 is a Friday, 2024-01-06 a Saturday.
  // ==========================================================================

  describe('isStoreOpen — a service that runs past midnight', () => {
    const eveningService: BusinessHours[] = [
      { day: 5, open: '18:00', close: '02:00', isClosed: false }, // Friday
      { day: 6, open: '18:00', close: '02:00', isClosed: false }, // Saturday
    ]

    it('is open at 23:00, before midnight', () => {
      // `"23:00" < "02:00"` is false. This read as closed.
      const result = isStoreOpen(eveningService, new Date('2024-01-05T23:00:00'))

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '18:00', close: '02:00' })
    })

    it('is open at 01:00, after midnight', () => {
      // `"01:00" >= "18:00"` is false. This read as closed too — and Saturday's
      // own row cannot answer for it: Saturday opens at 18:00. The service
      // still running belongs to Friday.
      const result = isStoreOpen(eveningService, new Date('2024-01-06T01:00:00'))

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '18:00', close: '02:00' })
    })

    it('is closed at 03:00, once the night is over', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-06T03:00:00'))

      expect(result.isOpen).toBe(false)
    })

    it('is closed at 10:00, between two services', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-05T10:00:00'))

      expect(result.isOpen).toBe(false)
    })

    it('closes tomorrow, not today', () => {
      // 23:00 Friday closes at 02:00 *Saturday*. Reported on the wrong day, the
      // banner counts down to a moment eighteen hours in the past.
      const result = isStoreOpen(eveningService, new Date('2024-01-05T23:00:00'))

      expect(result.nextChange?.getDay()).toBe(6)
      expect(result.nextChange?.getHours()).toBe(2)
    })

    it('reports the close time on the day it happens, past midnight', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-06T01:00:00'))

      expect(result.nextChange?.getDay()).toBe(6)
      expect(result.nextChange?.getHours()).toBe(2)
    })

    it('opens later today when asked between services', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-05T10:00:00'))

      expect(result.nextChange?.getDay()).toBe(5)
      expect(result.nextChange?.getHours()).toBe(18)
    })

    it('stays shut on a night the day before was closed', () => {
      // 01:00 Saturday with Friday closed: nothing is running. Reading the
      // previous day is what makes this answerable at all — Saturday's row
      // alone would say "closed", by accident rather than on purpose.
      const fridayClosed: BusinessHours[] = [
        { day: 5, open: '18:00', close: '02:00', isClosed: true },
        { day: 6, open: '18:00', close: '02:00', isClosed: false },
      ]

      expect(isStoreOpen(fridayClosed, new Date('2024-01-06T01:00:00')).isOpen).toBe(false)
    })

    it('serves the tail of Saturday night on Sunday morning', () => {
      // The week wraps: Saturday is day 6, Sunday is day 0.
      const result = isStoreOpen(eveningService, new Date('2024-01-07T01:00:00'))

      expect(result.isOpen).toBe(true)
    })
  })

  describe('isStoreOpen — a service that ends at midnight', () => {
    // `"00:00"` sorts before every other time, so `09:00–00:00` read as closed
    // all day long, at every hour.
    const untilMidnight: BusinessHours[] = [
      { day: 1, open: '09:00', close: '00:00', isClosed: false }, // Monday
    ]

    it('is open at 12:00', () => {
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T12:00:00')).isOpen).toBe(true)
    })

    it('is open at 23:59', () => {
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T23:59:00')).isOpen).toBe(true)
    })

    it('is closed at 08:00, before it opens', () => {
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T08:00:00')).isOpen).toBe(false)
    })

    it('is closed on Tuesday at 00:30 — midnight is the end, not an overrun', () => {
      // Monday closes *at* midnight. There is no tail to serve on Tuesday.
      expect(isStoreOpen(untilMidnight, new Date('2024-01-02T00:30:00')).isOpen).toBe(false)
    })
  })

  describe('isStoreOpen — the editors must keep accepting what they accept', () => {
    // Both hours editors are plain `<input type="time">` with no `close > open`
    // check. Typing 02:00 into a close field is legitimate and has to keep
    // working; the reading is what was wrong, not the writing.
    it('treats open === close as a 24-hour day, the way 00:00–00:00 always read', () => {
      const allDay: BusinessHours[] = [
        { day: 1, open: '00:00', close: '00:00', isClosed: false },
      ]

      expect(isStoreOpen(allDay, new Date('2024-01-01T03:00:00')).isOpen).toBe(true)
      expect(isStoreOpen(allDay, new Date('2024-01-01T15:00:00')).isOpen).toBe(true)
    })

    it('still honours isClosed, whatever the two times say', () => {
      const shut: BusinessHours[] = [
        { day: 1, open: '18:00', close: '02:00', isClosed: true },
      ]

      expect(isStoreOpen(shut, new Date('2024-01-01T23:00:00')).isOpen).toBe(false)
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
