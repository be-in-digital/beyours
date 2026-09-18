/**
 * Store Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  isStoreOpen,
  resolveStoreHours,
  getNextOpenTime,
  formatStoreAddress,
  formatStoreAddressLines,
  formatWeeklyHours,
  getStoreDistance,
  sortStoresByDistance,
} from '../services/store'
import { isWithinBusinessHours } from '@be-yours/convex-schema'
import type { BusinessHours, Address, StoreDoc } from '../types'

/**
 * The clock a bare `new Date('2024-01-05T23:00:00')` is written on.
 *
 * A date literal with no offset is parsed in the ENVIRONMENT's zone, and
 * `isStoreOpen` used to read a zone-less call on that same clock, so the two
 * cancelled and these cases were true in any runner. `readingFrame` now falls
 * back to `DEFAULT_RESTAURANT_TIMEZONE` — the constant `restaurantClock` uses
 * for the same absence, so the storefront and `orders.create` cannot answer on
 * two different clocks — and leaving these bare would quietly turn every case
 * below into a case about Paris.
 *
 * They are about the midnight-crossing arithmetic. So they say which clock they
 * mean, and it is the one their own literals are written in. The cases that ARE
 * about zones pass a real one and are untouched.
 */
const LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone

describe('Store Service', () => {
  describe('isStoreOpen agrees with the shared rule', () => {
    // `isOpen` is `isWithinBusinessHours` from `@be-yours/convex-schema`,
    // which is also what `orders.create` asks. The storefront's disabled button
    // and the mutation's refusal have to be the same answer: they were not, and
    // an order at 4 a.m. was the result.
    const week = (open: string, close: string, isClosed = false) =>
      Array.from({ length: 7 }, (_, day) => ({ day, open, close, isClosed }))

    it.each([
      ['inside the service', week('11:00', '23:00'), Date.UTC(2029, 6, 3, 12, 0)],
      ['before it opens', week('11:00', '14:00'), Date.UTC(2029, 6, 3, 2, 0)],
      ['on a closed day', week('11:00', '23:00', true), Date.UTC(2029, 6, 3, 12, 0)],
      ['past midnight on an overnight service', week('18:00', '02:00'), Date.UTC(2029, 6, 3, 23, 0)],
      ['between an overnight close and its open', week('18:00', '02:00'), Date.UTC(2029, 6, 3, 8, 0)],
      ['with no week declared at all', [], Date.UTC(2029, 6, 3, 2, 0)],
    ])('%s', (_name, hours, at) => {
      const now = new Date(at)
      expect(isStoreOpen(hours, now, 'Europe/Paris').isOpen).toBe(
        isWithinBusinessHours(hours, at, 'Europe/Paris')
      )
    })
  })

  describe('isStoreOpen', () => {
    it('should return open when current time is within hours', () => {
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false }, // Monday
      ]

      // Create a Monday at 12:00
      const monday = new Date('2024-01-01T12:00:00') // 2024-01-01 is a Monday

      const result = isStoreOpen(hours, monday, LOCAL)

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '09:00', close: '18:00' })
    })

    it('should return closed when current time is outside hours', () => {
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false }, // Monday
      ]

      // Create a Monday at 20:00
      const monday = new Date('2024-01-01T20:00:00')

      const result = isStoreOpen(hours, monday, LOCAL)

      expect(result.isOpen).toBe(false)
    })

    it('should return closed when day is marked as closed', () => {
      const hours: BusinessHours[] = [
        { day: 0, open: '09:00', close: '18:00', isClosed: true }, // Sunday closed
      ]

      // Create a Sunday at 12:00
      const sunday = new Date('2024-01-07T12:00:00') // 2024-01-07 is a Sunday

      const result = isStoreOpen(hours, sunday, LOCAL)

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
      const result = isStoreOpen(eveningService, new Date('2024-01-05T23:00:00'), LOCAL)

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '18:00', close: '02:00' })
    })

    it('is open at 01:00, after midnight', () => {
      // `"01:00" >= "18:00"` is false. This read as closed too — and Saturday's
      // own row cannot answer for it: Saturday opens at 18:00. The service
      // still running belongs to Friday.
      const result = isStoreOpen(eveningService, new Date('2024-01-06T01:00:00'), LOCAL)

      expect(result.isOpen).toBe(true)
      expect(result.currentPeriod).toEqual({ open: '18:00', close: '02:00' })
    })

    it('is closed at 03:00, once the night is over', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-06T03:00:00'), LOCAL)

      expect(result.isOpen).toBe(false)
    })

    it('is closed at 10:00, between two services', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-05T10:00:00'), LOCAL)

      expect(result.isOpen).toBe(false)
    })

    it('closes tomorrow, not today', () => {
      // 23:00 Friday closes at 02:00 *Saturday*. Reported on the wrong day, the
      // banner counts down to a moment eighteen hours in the past.
      const result = isStoreOpen(eveningService, new Date('2024-01-05T23:00:00'), LOCAL)

      expect(result.nextChange?.getDay()).toBe(6)
      expect(result.nextChange?.getHours()).toBe(2)
    })

    it('reports the close time on the day it happens, past midnight', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-06T01:00:00'), LOCAL)

      expect(result.nextChange?.getDay()).toBe(6)
      expect(result.nextChange?.getHours()).toBe(2)
    })

    it('opens later today when asked between services', () => {
      const result = isStoreOpen(eveningService, new Date('2024-01-05T10:00:00'), LOCAL)

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

      expect(isStoreOpen(fridayClosed, new Date('2024-01-06T01:00:00'), LOCAL).isOpen).toBe(false)
    })

    it('serves the tail of Saturday night on Sunday morning', () => {
      // The week wraps: Saturday is day 6, Sunday is day 0.
      const result = isStoreOpen(eveningService, new Date('2024-01-07T01:00:00'), LOCAL)

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
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T12:00:00'), LOCAL).isOpen).toBe(true)
    })

    it('is open at 23:59', () => {
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T23:59:00'), LOCAL).isOpen).toBe(true)
    })

    it('is closed at 08:00, before it opens', () => {
      expect(isStoreOpen(untilMidnight, new Date('2024-01-01T08:00:00'), LOCAL).isOpen).toBe(false)
    })

    it('is closed on Tuesday at 00:30 — midnight is the end, not an overrun', () => {
      // Monday closes *at* midnight. There is no tail to serve on Tuesday.
      expect(isStoreOpen(untilMidnight, new Date('2024-01-02T00:30:00'), LOCAL).isOpen).toBe(false)
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

      expect(isStoreOpen(allDay, new Date('2024-01-01T03:00:00'), LOCAL).isOpen).toBe(true)
      expect(isStoreOpen(allDay, new Date('2024-01-01T15:00:00'), LOCAL).isOpen).toBe(true)
    })

    it('still honours isClosed, whatever the two times say', () => {
      const shut: BusinessHours[] = [
        { day: 1, open: '18:00', close: '02:00', isClosed: true },
      ]

      expect(isStoreOpen(shut, new Date('2024-01-01T23:00:00'), LOCAL).isOpen).toBe(false)
    })
  })

  // ==========================================================================
  // The establishment's clock, not the visitor's (#169)
  //
  // `globalSettings.timezone` was written by the settings page and read by
  // nothing: open/closed came from `now.getDay()` and `now.getHours()`, i.e.
  // the browser. A customer abroad saw the wrong answer, and any visitor could
  // change it by changing their system clock.
  // ==========================================================================

  describe('isStoreOpen — the establishment\'s time zone', () => {
    const parisLunch: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      open: '12:00',
      close: '14:00',
      isClosed: false,
    }))

    it('is open when it is 12:30 in Paris, whatever the visitor\'s clock says', () => {
      // 10:30 UTC is 12:30 in Paris (CEST) and 06:30 in Montréal.
      const instant = new Date('2026-08-28T10:30:00Z')

      expect(isStoreOpen(parisLunch, instant, 'Europe/Paris').isOpen).toBe(true)
      expect(isStoreOpen(parisLunch, instant, 'America/Montreal').isOpen).toBe(false)
    })

    it('is closed when it is 22:00 in Paris, however early it is elsewhere', () => {
      const instant = new Date('2026-08-28T20:00:00Z') // 22:00 Paris, 16:00 Montréal

      expect(isStoreOpen(parisLunch, instant, 'Europe/Paris').isOpen).toBe(false)
    })

    it('reads the weekday in the zone, not on the visitor\'s calendar', () => {
      // 2026-08-28 16:00 UTC is 01:00 on Saturday in Tokyo and 18:00 on Friday
      // in Paris. The day of the week is not a property of the instant.
      const saturdayNights: BusinessHours[] = [
        { day: 6, open: '00:30', close: '06:00', isClosed: false },
      ]
      const instant = new Date('2026-08-28T16:00:00Z')

      expect(isStoreOpen(saturdayNights, instant, 'Asia/Tokyo').isOpen).toBe(true)
      expect(isStoreOpen(saturdayNights, instant, 'Europe/Paris').isOpen).toBe(false)
    })

    it('returns nextChange as a real instant, not a wall clock', () => {
      // Open at 12:30 Paris, closing at 14:00 Paris = 12:00 UTC.
      const instant = new Date('2026-08-28T10:30:00Z')

      const result = isStoreOpen(parisLunch, instant, 'Europe/Paris')

      expect(result.nextChange?.toISOString()).toBe('2026-08-28T12:00:00.000Z')
    })

    it('falls back to the visitor\'s clock when the zone is unknown', () => {
      // A settings row can hold anything, and `Intl` throws on a name it does
      // not know. An unusable zone must not take the storefront down.
      const instant = new Date('2026-08-28T10:30:00Z')

      expect(() => isStoreOpen(parisLunch, instant, 'Not/AZone')).not.toThrow()
    })

    it('behaves exactly as before when no zone is given', () => {
      const monday = new Date('2024-01-01T12:00:00')
      const hours: BusinessHours[] = [
        { day: 1, open: '09:00', close: '18:00', isClosed: false },
      ]

      expect(isStoreOpen(hours, monday, LOCAL).isOpen).toBe(true)
    })
  })

  // ==========================================================================
  // "Use global hours" (#169)
  // ==========================================================================

  describe('resolveStoreHours', () => {
    const globalHours: BusinessHours[] = [
      { day: 1, open: '18:00', close: '02:00', isClosed: false },
    ]
    const storeHours: BusinessHours[] = [
      { day: 1, open: '09:00', close: '22:00', isClosed: false },
    ]

    it('follows the global hours when the flag is on', () => {
      // The flag was written by the dashboard and read by nobody: the
      // storefront took `store.hours`, which for a new establishment is the
      // hard-coded 09:00–22:00 `stores.create` seeds.
      const hours = resolveStoreHours(
        { hours: storeHours, useGlobalHours: true },
        { hours: globalHours }
      )

      expect(hours).toEqual(globalHours)
    })

    it('keeps the establishment\'s own hours when the flag is off', () => {
      const hours = resolveStoreHours(
        { hours: storeHours, useGlobalHours: false },
        { hours: globalHours }
      )

      expect(hours).toEqual(storeHours)
    })

    it('falls back to the establishment when there are no global hours', () => {
      // A deployment whose settings row has never been saved. Following an
      // empty week would close every location.
      expect(
        resolveStoreHours({ hours: storeHours, useGlobalHours: true }, { hours: [] })
      ).toEqual(storeHours)
      expect(
        resolveStoreHours({ hours: storeHours, useGlobalHours: true }, null)
      ).toEqual(storeHours)
    })

    it('treats a store without the flag as keeping its own hours', () => {
      // `FOLLOWS_GLOBAL_HOURS_BY_DEFAULT` is `false`, declared once in
      // `openingHours.ts` and read by the dashboard switch as well as by this
      // resolver — which is the whole point, since the two used to disagree.
      //
      // This branch first made it `true`, on the grounds that every other layer
      // read an absent flag that way. #446 chose `false` and it is the safer
      // reading: `false` is what the order path has always enforced, so it
      // changes no establishment's real hours and only stops the screen
      // claiming otherwise. `true` would have moved every legacy store onto the
      // deployment-wide week without anyone asking for it.
      expect(
        resolveStoreHours({ hours: storeHours }, { hours: globalHours })
      ).toEqual(storeHours)
    })

    it('returns nothing for no store', () => {
      expect(resolveStoreHours(null, { hours: globalHours })).toEqual([])
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

      const result = getNextOpenTime(hours, monday, LOCAL)

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

      const result = getNextOpenTime(hours, new Date(), LOCAL)

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

  describe('formatStoreAddressLines', () => {
    it('writes the address the way it goes on an envelope', () => {
      const address: Address = {
        street: '12 rue des Martyrs',
        city: 'Paris',
        postalCode: '75009',
        country: 'France',
      }

      expect(formatStoreAddressLines(address)).toEqual([
        '12 rue des Martyrs',
        '75009 Paris',
        'France',
      ])
    })

    it('leaves out a field the import never filled rather than its punctuation', () => {
      const address: Address = {
        street: '12 rue des Martyrs',
        city: 'Paris',
        postalCode: '',
        country: '',
      }

      expect(formatStoreAddressLines(address)).toEqual([
        '12 rue des Martyrs',
        'Paris',
      ])
    })
  })

  describe('formatWeeklyHours', () => {
    const service = (day: number, open: string, close: string): BusinessHours => ({
      day,
      open,
      close,
      isClosed: false,
    })

    it('collapses consecutive days that serve the same times', () => {
      const hours: BusinessHours[] = [
        service(1, '11:30', '22:00'),
        service(2, '11:30', '22:00'),
        service(3, '11:30', '22:00'),
        service(4, '11:30', '22:00'),
        service(5, '11:30', '23:30'),
        service(6, '18:00', '23:30'),
        { day: 0, open: '00:00', close: '00:00', isClosed: true },
      ]

      expect(formatWeeklyHours(hours)).toEqual([
        { days: 'Lun - Jeu', hours: '11h30 - 22h00' },
        { days: 'Ven', hours: '11h30 - 23h30' },
        { days: 'Sam', hours: '18h00 - 23h30' },
        { days: 'Dim', hours: 'Fermé' },
      ])
    })

    it('starts the week on Monday, whatever order the rows were stored in', () => {
      const hours: BusinessHours[] = [
        { day: 0, open: '00:00', close: '00:00', isClosed: true },
        service(6, '18:00', '23:00'),
        service(1, '09:00', '17:00'),
      ]

      expect(formatWeeklyHours(hours).map((row) => row.days)).toEqual([
        'Lun',
        'Sam',
        'Dim',
      ])
    })

    it('does not bridge a run across a day the store is shut', () => {
      // Open Monday and Wednesday on the same times, shut on Tuesday: reading
      // `Lun - Mer` off this would send someone to a closed door.
      const hours: BusinessHours[] = [
        service(1, '11:00', '22:00'),
        { day: 2, open: '00:00', close: '00:00', isClosed: true },
        service(3, '11:00', '22:00'),
      ]

      expect(formatWeeklyHours(hours)).toEqual([
        { days: 'Lun', hours: '11h00 - 22h00' },
        { days: 'Mar', hours: 'Fermé' },
        { days: 'Mer', hours: '11h00 - 22h00' },
      ])
    })

    it('does not bridge a run across a day the store never declared', () => {
      const hours: BusinessHours[] = [
        service(1, '11:00', '22:00'),
        service(3, '11:00', '22:00'),
      ]

      expect(formatWeeklyHours(hours)).toEqual([
        { days: 'Lun', hours: '11h00 - 22h00' },
        { days: 'Mer', hours: '11h00 - 22h00' },
      ])
    })

    it('keeps an overnight service readable', () => {
      expect(formatWeeklyHours([service(5, '18:00', '02:00')])).toEqual([
        { days: 'Ven', hours: '18h00 - 02h00' },
      ])
    })

    it('returns nothing at all for a store with no declared week', () => {
      expect(formatWeeklyHours([])).toEqual([])
    })

    it('collapses a seven-day identical week into one row', () => {
      const hours = [1, 2, 3, 4, 5, 6, 0].map((day) => service(day, '08:00', '20:00'))

      expect(formatWeeklyHours(hours)).toEqual([
        { days: 'Lun - Dim', hours: '08h00 - 20h00' },
      ])
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


/**
 * The storefront and `orders.create` read one clock, including when nobody said
 * which.
 *
 * WHAT WAS BROKEN. `useStoreStatus` computes two answers from one moment and
 * says so in as many words — "Both answers off one reading of the clock, so
 * they cannot describe two different moments" — but they came from two
 * functions with different fallbacks. `openNow` goes through
 * `isWithinBusinessHours` → `restaurantClock`; `hoursStatus` goes through
 * `isStoreOpen` → `readingFrame`. Given no `globalSettings.timezone` — and
 * `globalSettings` is a singleton nothing seeds, so that is every deployment
 * whose settings have never been saved — the first read the SERVER's clock and
 * the second read the VISITOR's.
 *
 * The result on one screen: "Ouvert" decided in one zone beside "ferme à
 * 02:00" computed in another, and an order the mutation refuses.
 *
 * Both fall back to `DEFAULT_RESTAURANT_TIMEZONE` now. This is the test that
 * stops them separating again — it asserts agreement rather than either value,
 * so it keeps holding if the default itself is ever changed.
 */
describe('the clock when nothing has said which', () => {
  // 12:30 UTC on Wednesday 3 July 2024 is 14:30 in Paris (CEST) — past the
  // close of a lunch service, and inside it on the server's clock.
  const LUNCH: BusinessHours[] = [
    { day: 3, open: '11:00', close: '14:00', isClosed: false },
  ]
  const AFTER_LUNCH_IN_PARIS = new Date('2024-07-03T12:30:00Z')

  it('reads a zone-less call on the restaurant default, not on UTC', () => {
    expect(isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS).isOpen).toBe(false)
    expect(isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS, 'UTC').isOpen).toBe(true)
  })

  it('agrees with the rule orders.create applies', () => {
    // The two halves of `useStoreStatus`, asked the same question. Neither
    // value is asserted here — only that they are the same one.
    for (const zone of [undefined, 'Not/AZone', 'Europe/Paris', 'America/Montreal']) {
      const storefront = isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS, zone).isOpen
      const mutation = isWithinBusinessHours(
        LUNCH,
        AFTER_LUNCH_IN_PARIS.getTime(),
        zone
      )
      expect({ zone, storefront }).toEqual({ zone, storefront: mutation })
    }
  })

  it('falls back to the default for a zone Intl refuses, not to the visitor', () => {
    expect(isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS, 'Not/AZone').isOpen).toBe(false)
  })

  it('never overrides a zone that was given', () => {
    expect(isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS, 'UTC').isOpen).toBe(true)
    expect(isStoreOpen(LUNCH, AFTER_LUNCH_IN_PARIS, 'Europe/Paris').isOpen).toBe(false)
  })
})
