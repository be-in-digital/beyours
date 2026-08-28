/**
 * Store Service
 *
 * Pure business logic functions for store operations
 * No side effects, no Convex calls - operates on data only
 */

import type { BusinessHours, Address, StoreDoc, StoreHoursStatus } from '../types'

/**
 * Is this a service that runs past midnight?
 *
 * `"18:00" – "02:00"` closes on the *next* calendar day. The two times are
 * compared as strings, so a service that ends before it starts can only mean it
 * crossed midnight. `open === close` is the 24-hour day that `"00:00" – "00:00"`
 * has always meant; a day that is shut says so with `isClosed`.
 */
const isOvernight = (open: string, close: string): boolean => close <= open

/** Minutes past midnight, for arithmetic the `"HH:mm"` strings cannot do. */
const toMinutes = (time: string): number => {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

/** `now`, moved to `time` on the same day, offset by `dayOffset` days. */
const at = (now: Date, time: string, dayOffset = 0): Date => {
  const parts = time.split(':').map(Number)
  const moment = new Date(now)
  if (dayOffset !== 0) moment.setDate(now.getDate() + dayOffset)
  moment.setHours(parts[0] ?? 0, parts[1] ?? 0, 0, 0)
  return moment
}

/**
 * Check if store is currently open based on business hours
 *
 * WHY THE PREVIOUS DAY IS READ: a service declared on Friday as 18:00–02:00 is
 * still serving at 01:00 on Saturday. Saturday's own row says nothing about it —
 * Saturday's service starts at 18:00, and Saturday may even be closed. So the
 * hour before the close time belongs to the day before, and that is the row
 * that has to answer.
 *
 * The comparison used to be a plain `open <= now < close` on `"HH:mm"` strings,
 * with no wrap. An evening restaurant read as closed all evening: at 23:00
 * `"23:00" < "02:00"` is false, and at 01:00 `"01:00" >= "18:00"` is false. The
 * boolean disables add-to-cart everywhere and blocks checkout, so the shipped
 * `fast-food-minuit` vertical and the food trucks could not sell anything.
 */
export const isStoreOpen = (hours: BusinessHours[], now: Date = new Date()): StoreHoursStatus => {
  const currentDay = now.getDay() // 0=Sunday, 6=Saturday
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // 1. Yesterday's service, if it runs into today.
  const yesterdayHours = hours.find((h) => h.day === (currentDay + 6) % 7)
  if (
    yesterdayHours &&
    !yesterdayHours.isClosed &&
    isOvernight(yesterdayHours.open, yesterdayHours.close) &&
    toMinutes(currentTime) < toMinutes(yesterdayHours.close)
  ) {
    return {
      isOpen: true,
      nextChange: at(now, yesterdayHours.close),
      currentPeriod: { open: yesterdayHours.open, close: yesterdayHours.close },
    }
  }

  const todayHours = hours.find((h) => h.day === currentDay)

  if (!todayHours || todayHours.isClosed) {
    return {
      isOpen: false,
      nextChange: getNextOpenTime(hours, now),
      currentPeriod: undefined,
    }
  }

  // 2. Today's own service.
  const overnight = isOvernight(todayHours.open, todayHours.close)
  const isOpen = overnight
    ? currentTime >= todayHours.open
    : currentTime >= todayHours.open && currentTime < todayHours.close

  let nextChange: Date | null
  if (isOpen) {
    // Closing time — tomorrow's date when the service crosses midnight.
    nextChange = at(now, todayHours.close, overnight ? 1 : 0)
  } else if (currentTime < todayHours.open) {
    // Still to open today. This is also where an overnight day lands between
    // its close and its open — 10:00 on an 18:00–02:00 day opens at 18:00.
    nextChange = at(now, todayHours.open)
  } else {
    // Done for today. Only a same-day range reaches this branch: an overnight
    // one is open from its opening time until midnight.
    nextChange = getNextOpenTime(hours, now)
  }

  return {
    isOpen,
    nextChange,
    currentPeriod: {
      open: todayHours.open,
      close: todayHours.close,
    },
  }
}

/**
 * Get next opening time from now
 *
 * Looks at the days *after* today only: every reason to ask this question —
 * today is closed, or today's service is over — has already ruled today out.
 */
export const getNextOpenTime = (hours: BusinessHours[], now: Date = new Date()): Date | null => {
  const currentDay = now.getDay()

  // Check remaining days this week
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7
    const dayHours = hours.find((h) => h.day === checkDay)

    if (dayHours && !dayHours.isClosed) {
      // Return opening time for this day
      return at(now, dayHours.open, i)
    }
  }

  return null // Store never opens (all days closed)
}

/**
 * Format store address for display
 */
export const formatStoreAddress = (address: Address): string => {
  return `${address.street}, ${address.postalCode} ${address.city}, ${address.country}`
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 * Returns Infinity if coordinates are invalid
 */
export const getStoreDistance = (
  storeLat: number | undefined,
  storeLng: number | undefined,
  userLat: number,
  userLng: number
): number => {
  if (storeLat === undefined || storeLng === undefined) {
    return Infinity
  }

  const R = 6371 // Earth's radius in km
  const dLat = toRad(userLat - storeLat)
  const dLng = toRad(userLng - storeLng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(storeLat)) * Math.cos(toRad(userLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * 100) / 100 // Round to 2 decimals
}

/**
 * Helper: Convert degrees to radians
 */
const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180
}

/**
 * Sort stores by distance from user location
 */
export const sortStoresByDistance = (
  stores: StoreDoc[],
  userLat: number,
  userLng: number
): StoreDoc[] => {
  return [...stores].sort((a, b) => {
    const distA = getStoreDistance(a.address.latitude, a.address.longitude, userLat, userLng)
    const distB = getStoreDistance(b.address.latitude, b.address.longitude, userLat, userLng)

    return distA - distB
  })
}
