"use client"

import { useRef, useCallback } from "react"

interface UseWheelSoundsReturn {
  initAudio: () => void
  playClick: () => void
  playWin: () => void
}

/**
 * Programmatic sound synthesis via Web Audio API.
 * No audio files needed.
 *
 * IMPORTANT: On iOS, AudioContext must be created/resumed
 * after a user gesture. Call `initAudio()` on the first
 * user interaction (e.g. "Jouer la partie" button).
 */
export function useWheelSounds(): UseWheelSoundsReturn {
  const ctxRef = useRef<AudioContext | null>(null)
  const initializedRef = useRef(false)

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null

    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      } catch {
        return null
      }
    }

    return ctxRef.current
  }, [])

  // Must be called from a user gesture (click handler) for iOS
  const initAudio = useCallback(() => {
    if (initializedRef.current) return
    const ctx = getContext()
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    initializedRef.current = true
  }, [getContext])

  const playClick = useCallback(() => {
    const ctx = getContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = "sine"
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    } catch {
      // Silently fail if audio not available
    }
  }, [getContext])

  const playWin = useCallback(() => {
    const ctx = getContext()
    if (!ctx) return

    try {
      // Ascending tone sequence: C5-E5-G5-C6
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.type = "sine"
        const startTime = ctx.currentTime + i * 0.12
        osc.frequency.setValueAtTime(freq, startTime)
        gain.gain.setValueAtTime(0.25, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)

        osc.start(startTime)
        osc.stop(startTime + 0.3)
      })
    } catch {
      // Silently fail
    }
  }, [getContext])

  return { initAudio, playClick, playWin }
}
