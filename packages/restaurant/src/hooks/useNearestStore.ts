'use client'

import { useState, useEffect, useCallback } from 'react'
import type { StoreDoc } from '../types'

/**
 * Haversine distance in km between two lat/lng points
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export interface StoreWithDistance extends StoreDoc {
  distance: number | null // km, null if no coords
}

interface UseNearestStoreResult {
  nearestStore: StoreDoc | null
  storesWithDistance: StoreWithDistance[]
  isLocating: boolean
  locationError: string | null
  requestLocation: () => void
}

/**
 * useNearestStore
 *
 * Uses browser Geolocation API to find the nearest store from a list.
 * Returns stores sorted by distance with the nearest one highlighted.
 *
 * If geolocation is unavailable or denied, returns stores without distance info.
 */
export function useNearestStore(stores: StoreDoc[]): UseNearestStoreResult {
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Géolocalisation non supportée par votre navigateur')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setIsLocating(false)
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Accès à la localisation refusé')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Position indisponible')
            break
          case error.TIMEOUT:
            setLocationError('Délai de localisation dépassé')
            break
          default:
            setLocationError('Erreur de géolocalisation')
        }
        setIsLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  // Auto-request location on mount
  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  // Compute distances and sort
  const storesWithDistance: StoreWithDistance[] = stores.map((store) => {
    const lat = store.address?.latitude
    const lng = store.address?.longitude

    if (!userPosition || lat == null || lng == null) {
      return { ...store, distance: null }
    }

    return {
      ...store,
      distance: haversineDistance(userPosition.lat, userPosition.lng, lat, lng),
    }
  })

  // Sort: stores with distance first (ascending), then stores without distance
  storesWithDistance.sort((a, b) => {
    if (a.distance != null && b.distance != null) return a.distance - b.distance
    if (a.distance != null) return -1
    if (b.distance != null) return 1
    return 0
  })

  const nearestStore = storesWithDistance[0] ?? null

  return {
    nearestStore,
    storesWithDistance,
    isLocating,
    locationError,
    requestLocation,
  }
}
