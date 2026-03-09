"use client"

import { useMemo } from "react"

export interface DeviceCapability {
  isLowEnd: boolean
  curveSegments: number
  enableShadows: boolean
  enableParticles: boolean
  enableLEDs: boolean
  dpr: [number, number]
  enableEnvironment: boolean
  enableBevel: boolean
}

function detectLowEnd(): boolean {
  if (typeof window === "undefined") return false

  const isMobile = window.innerWidth < 768

  // hardwareConcurrency: available on all modern browsers
  const cores = navigator.hardwareConcurrency ?? 0
  if (cores > 0 && cores < 4) return true

  // deviceMemory: Chrome/Edge only, NOT on Safari/iOS
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory < 4) return true

  // If APIs unavailable: mobile = low-end, desktop = high-end
  if (memory === undefined && cores === 0) {
    return isMobile
  }

  return false
}

export function useDeviceCapability(): DeviceCapability {
  return useMemo(() => {
    const isLowEnd = detectLowEnd()

    if (isLowEnd) {
      return {
        isLowEnd: true,
        curveSegments: 16,
        enableShadows: false,
        enableParticles: false,
        enableLEDs: false,
        dpr: [0.5, 1] as [number, number],
        enableEnvironment: false,
        enableBevel: false,
      }
    }

    return {
      isLowEnd: false,
      curveSegments: 32,
      enableShadows: true,
      enableParticles: true,
      enableLEDs: true,
      dpr: [1, 2] as [number, number],
      enableEnvironment: true,
      enableBevel: true,
    }
  }, [])
}
