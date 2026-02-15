/**
 * Store Service
 *
 * Pure business logic functions for store operations
 * No side effects, no Convex calls - operates on data only
 */

import type { BusinessHours, Address, StoreDoc, StoreHoursStatus } from '../types'

/**
 * Check if store is currently open based on business hours
 */
export const isStoreOpen = (hours: BusinessHours[], now: Date = new Date()): StoreHoursStatus => {
  const currentDay = now.getDay() // 0=Sunday, 6=Saturday
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const todayHours = hours.find((h) => h.day === currentDay)

  if (!todayHours || todayHours.isClosed) {
    const nextOpen = getNextOpenTime(hours, now)
    return {
      isOpen: false,
      nextChange: nextOpen,
      currentPeriod: undefined,
    }
  }

  const isOpen = currentTime >= todayHours.open && currentTime < todayHours.close

  // Calculate next change (closing time today or opening time tomorrow)
  let nextChange: Date | null = null
  if (isOpen) {
    // Next change is closing time today
    const timeParts = todayHours.close.split(':').map(Number)
    const closeHour = timeParts[0] ?? 0
    const closeMinute = timeParts[1] ?? 0
    nextChange = new Date(now)
    nextChange.setHours(closeHour, closeMinute, 0, 0)
  } else if (currentTime < todayHours.open) {
    // Next change is opening time today
    const timeParts = todayHours.open.split(':').map(Number)
    const openHour = timeParts[0] ?? 0
    const openMinute = timeParts[1] ?? 0
    nextChange = new Date(now)
    nextChange.setHours(openHour, openMinute, 0, 0)
  } else {
    // Already closed for today, next change is next opening
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
 */
export const getNextOpenTime = (hours: BusinessHours[], now: Date = new Date()): Date | null => {
  const currentDay = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Check remaining days this week
  for (let i = 1; i <= 7; i++) {
    const checkDay = (currentDay + i) % 7
    const dayHours = hours.find((h) => h.day === checkDay)

    if (dayHours && !dayHours.isClosed) {
      // If it's today and before opening time, return today's opening
      if (i === 0 && currentTime < dayHours.open) {
        const timeParts = dayHours.open.split(':').map(Number)
        const openHour = timeParts[0] ?? 0
        const openMinute = timeParts[1] ?? 0
        const nextOpen = new Date(now)
        nextOpen.setHours(openHour, openMinute, 0, 0)
        return nextOpen
      }

      // Return opening time for this day
      const timeParts = dayHours.open.split(':').map(Number)
      const openHour = timeParts[0] ?? 0
      const openMinute = timeParts[1] ?? 0
      const nextOpen = new Date(now)
      nextOpen.setDate(now.getDate() + i)
      nextOpen.setHours(openHour, openMinute, 0, 0)
      return nextOpen
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
