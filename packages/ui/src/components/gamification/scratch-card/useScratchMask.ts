"use client"

import { useRef, useCallback, useMemo } from "react"

export interface UseScratchMaskOptions {
  width?: number
  height?: number
  brushRadius?: number
  revealThreshold?: number
  onReveal?: () => void
}

export interface ScratchMaskState {
  progress: number
  strokeCount: number
  isRevealed: boolean
  hasStarted: boolean
  isDirty: boolean
}

export interface UseScratchMaskReturn {
  canvas: HTMLCanvasElement
  /** Paint at normalized [0-1] coordinates */
  paint: (normalizedX: number, normalizedY: number) => void
  /** Call on pointerUp / pointerCancel to break stroke interpolation + check reveal */
  endStroke: () => void
  /** Mutable state ref — read in useFrame without causing re-renders */
  stateRef: React.RefObject<ScratchMaskState>
  /** Reset mask to fully opaque */
  reset: () => void
  /** Clear the dirty flag after texture update */
  clearDirty: () => void
}

interface InternalState {
  ctx: CanvasRenderingContext2D
  lastX: number
  lastY: number
  hasLastPoint: boolean
}

/**
 * Draw a BLACK circle on the white canvas.
 * Black pixels → luminance 0 → alphaMap transparent.
 * White pixels → luminance 1 → alphaMap opaque.
 */
function drawBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
): void {
  ctx.fillStyle = "#000000"
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Interpolate between two points with gritty splatters (coin scratch effect).
 */
function interpolateAndPaint(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const dist = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const step = radius * 0.3

  if (dist < step) {
    drawBrush(ctx, x1, y1, radius)
    return
  }

  const steps = Math.ceil(dist / step)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x0 + dx * t
    const py = y0 + dy * t

    // Main stroke
    drawBrush(ctx, px, py, radius)

    // Gritty splatter particles (2 per step)
    for (let j = 0; j < 2; j++) {
      const radiusOffset = (Math.random() - 0.5) * radius * 1.3
      const angleOffset = Math.random() * Math.PI * 2
      const rx = px + Math.cos(angleOffset) * radiusOffset
      const ry = py + Math.sin(angleOffset) * radiusOffset
      drawBrush(ctx, rx, ry, Math.random() * radius * 0.25)
    }
  }
}

/**
 * Sample progress by checking red channel (black pixels = scratched).
 * Uses stride for performance (every 16th pixel).
 */
function sampleProgress(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const pixelSkip = 16
  const byteSkip = 4 * pixelSkip

  let transparent = 0
  let total = 0

  for (let i = 0; i < data.length; i += byteSkip) {
    // Red channel < 128 means the pixel is dark (scratched)
    if (data[i]! < 128) {
      transparent++
    }
    total++
  }

  return total > 0 ? transparent / total : 0
}

/**
 * Core scratch mask engine — shared between 3D and 2D renderers.
 * Uses black-on-white drawing (not destination-out) for reliable alphaMap.
 * The onReveal callback fires once when reveal conditions are met.
 */
export function useScratchMask(options: UseScratchMaskOptions = {}): UseScratchMaskReturn {
  const {
    width = 512,
    height = 512,
    brushRadius = 25,
    revealThreshold = 0.5,
    onReveal,
  } = options

  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  const stateRef = useRef<ScratchMaskState>({
    progress: 0,
    strokeCount: 0,
    isRevealed: false,
    hasStarted: false,
    isDirty: false,
  })

  const internalRef = useRef<InternalState | null>(null)

  // Create canvas once
  const canvas = useMemo(() => {
    if (typeof document === "undefined") {
      return null as unknown as HTMLCanvasElement
    }
    const c = document.createElement("canvas")
    c.width = width
    c.height = height
    const ctx = c.getContext("2d", { willReadFrequently: true })
    if (ctx) {
      // Fill white = fully opaque in alphaMap
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, width, height)
      internalRef.current = { ctx, lastX: 0, lastY: 0, hasLastPoint: false }
    }
    return c
  }, [width, height])

  const paint = useCallback(
    (normalizedX: number, normalizedY: number) => {
      const internal = internalRef.current
      const state = stateRef.current
      if (!internal || state.isRevealed) return

      // UV Y is inverted: 0=bottom, 1=top. Canvas Y: 0=top.
      const x = normalizedX * width
      const y = (1 - normalizedY) * height

      if (!state.hasStarted) {
        state.hasStarted = true
      }

      if (internal.hasLastPoint) {
        interpolateAndPaint(internal.ctx, internal.lastX, internal.lastY, x, y, brushRadius)
      } else {
        drawBrush(internal.ctx, x, y, brushRadius)
      }

      internal.lastX = x
      internal.lastY = y
      internal.hasLastPoint = true
      state.strokeCount++
      state.isDirty = true
    },
    [width, height, brushRadius]
  )

  const endStroke = useCallback(() => {
    const internal = internalRef.current
    const state = stateRef.current
    if (!internal) return

    internal.hasLastPoint = false

    // Check reveal on stroke end (not during paint — more efficient)
    if (!state.isRevealed && state.hasStarted) {
      state.progress = sampleProgress(internal.ctx, width, height)

      if (state.progress >= revealThreshold) {
        state.isRevealed = true
        onRevealRef.current?.()
      }
    }
  }, [width, height, revealThreshold])

  const clearDirty = useCallback(() => {
    stateRef.current.isDirty = false
  }, [])

  const reset = useCallback(() => {
    const internal = internalRef.current
    if (!internal) return

    // Reset composite mode and fill white
    internal.ctx.globalCompositeOperation = "source-over"
    internal.ctx.fillStyle = "#ffffff"
    internal.ctx.fillRect(0, 0, width, height)
    internal.lastX = 0
    internal.lastY = 0
    internal.hasLastPoint = false

    stateRef.current = {
      progress: 0,
      strokeCount: 0,
      isRevealed: false,
      hasStarted: false,
      isDirty: true,
    }
  }, [width, height])

  return {
    canvas,
    paint,
    endStroke,
    stateRef: stateRef as React.RefObject<ScratchMaskState>,
    reset,
    clearDirty,
  }
}
