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

export interface UseNearestStoreOptions {
  /**
   * Ask the browser for the visitor's position as soon as the hook mounts.
   *
   * This prompts. Off by default, and reserved for the UI whose whole point is
   * distance - the "Nos restaurants" panel. It used to be unconditional, so
   * every storefront page opened with a location prompt, including on
   * single-location restaurants where the answer cannot change anything.
   */
  autoLocate?: boolean

  /**
   * Use the position only if the visitor has already granted it.
   *
   * Never prompts and never touches the Geolocation API otherwise, which also
   * keeps it clear of a permissions-policy violation where the API is blocked
   * outright. This is what automatic resolution wants: honour a permission the
   * visitor gave earlier, ask nothing of the one who did not.
   */
  useGrantedLocation?: boolean
}

/**
 * useNearestStore
 *
 * Uses browser Geolocation API to find the nearest store from a list.
 * Returns stores sorted by distance with the nearest one highlighted.
 *
 * If geolocation is unavailable or denied, returns stores without distance info.
 */
export function useNearestStore(
  stores: StoreDoc[],
  options?: UseNearestStoreOptions
): UseNearestStoreResult {
  const autoLocate = options?.autoLocate ?? false
  const useGrantedLocation = options?.useGrantedLocation ?? false
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

  useEffect(() => {
    if (!autoLocate) return
    requestLocation()
  }, [autoLocate, requestLocation])

  useEffect(() => {
    if (autoLocate || !useGrantedLocation) return
    if (typeof navigator === 'undefined' || !navigator.permissions) return

    let cancelled = false
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === 'granted') requestLocation()
      })
      .catch(() => {
        // A browser that will not answer the question is a browser we do not
        // ask the position of either.
      })

    return () => {
      cancelled = true
    }
  }, [autoLocate, useGrantedLocation, requestLocation])

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
