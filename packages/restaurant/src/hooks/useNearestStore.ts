'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { StoreDoc } from '../types'
import { getStoreDistance } from '../services/store'

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
  const storesWithDistance: StoreWithDistance[] = useMemo(() => {
    const withDistance = stores.map((store) => {
      const lat = store.address?.latitude
      const lng = store.address?.longitude

      if (!userPosition || lat == null || lng == null) {
        return { ...store, distance: null }
      }

      const distance = getStoreDistance(lat, lng, userPosition.lat, userPosition.lng)
      return {
        ...store,
        distance: distance === Infinity ? null : distance,
      }
    })

    // Sort: stores with distance first (ascending), then stores without distance
    withDistance.sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance
      if (a.distance != null) return -1
      if (b.distance != null) return 1
      return 0
    })

    return withDistance
  }, [stores, userPosition])

  const nearestStore = storesWithDistance[0] ?? null

  return {
    nearestStore,
    storesWithDistance,
    isLocating,
    locationError,
    requestLocation,
  }
}
