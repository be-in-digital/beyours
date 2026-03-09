"use client"

import { lazy, Suspense, useRef, useEffect, useCallback, useState } from "react"

import type { ScratchCardProps } from "./scratch-card/types"
import { WebGLErrorBoundary } from "./ErrorBoundary"

export type { ScratchCardProps } from "./scratch-card/types"

const ScratchCard3DLazy = lazy(() =>
  import("./scratch-card/ScratchCard3D")
    .then((m) => ({ default: m.ScratchCard3D }))
    .catch(() => ({
      default: () => {
        throw new Error("3D load failed")
      },
    }))
)

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false
  try {
    const canvas = document.createElement("canvas")
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    if (!gl) return false
    const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info")
    if (debugInfo) {
      const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      if (typeof renderer === "string" && renderer.toLowerCase().includes("swiftshader")) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

// ─── 2D Canvas Fallback (self-contained, no shared mask) ────────────

function ScratchCard2D({ prizeText, didWin, onReveal, size = 400, primaryColor = "#D4AF37", interactive = false }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const isScratchingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasStartedRef = useRef(false)
  const revealedRef = useRef(false)
  const [revealed, setRevealed] = useState(false)

  const cardWidth = size
  const cardHeight = size * 0.72
  const brushRadius = 20

  // Draw base card with prize text
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = cardWidth * dpr
    canvas.height = cardHeight * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = "#faf8f0"
    const r = 12
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(cardWidth - r, 0)
    ctx.quadraticCurveTo(cardWidth, 0, cardWidth, r)
    ctx.lineTo(cardWidth, cardHeight - r)
    ctx.quadraticCurveTo(cardWidth, cardHeight, cardWidth - r, cardHeight)
    ctx.lineTo(r, cardHeight)
    ctx.quadraticCurveTo(0, cardHeight, 0, cardHeight - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()
    ctx.fill()

    // Border
    ctx.strokeStyle = primaryColor + "40"
    ctx.lineWidth = 2
    ctx.stroke()

    // Prize text
    ctx.fillStyle = didWin ? primaryColor : "#888888"
    ctx.font = `bold ${Math.floor(cardWidth / 14)}px system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(prizeText, cardWidth / 2, cardHeight / 2)

    // Subtitle
    ctx.fillStyle = "#aaaaaa"
    ctx.font = `${Math.floor(cardWidth / 22)}px system-ui, sans-serif`
    ctx.fillText(didWin ? "Félicitations !" : "Pas de chance...", cardWidth / 2, cardHeight / 2 + 30)
  }, [cardWidth, cardHeight, prizeText, didWin, primaryColor])

  // Draw gold overlay
  useEffect(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const ctx = overlay.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    overlay.width = cardWidth * dpr
    overlay.height = cardHeight * dpr
    ctx.scale(dpr, dpr)

    const grad = ctx.createLinearGradient(0, 0, cardWidth, cardHeight)
    grad.addColorStop(0, "#D4AF37")
    grad.addColorStop(0.3, "#F5E6B8")
    grad.addColorStop(0.5, "#D4AF37")
    grad.addColorStop(0.7, "#C0C0C0")
    grad.addColorStop(1, "#D4AF37")

    const r = 12
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.lineTo(cardWidth - r, 0)
    ctx.quadraticCurveTo(cardWidth, 0, cardWidth, r)
    ctx.lineTo(cardWidth, cardHeight - r)
    ctx.quadraticCurveTo(cardWidth, cardHeight, cardWidth - r, cardHeight)
    ctx.lineTo(r, cardHeight)
    ctx.quadraticCurveTo(0, cardHeight, 0, cardHeight - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // "GRATTEZ ICI" text
    ctx.fillStyle = "#ffffff"
    ctx.font = `bold ${Math.floor(cardWidth / 16)}px system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("GRATTEZ ICI", cardWidth / 2, cardHeight / 2 + 6)

    hasStartedRef.current = false
    revealedRef.current = false
    lastPosRef.current = null
  }, [cardWidth, cardHeight])

  // Draw scratch directly on overlay canvas using destination-out
  const drawScratch = useCallback((clientX: number, clientY: number) => {
    const overlay = overlayCanvasRef.current
    if (!overlay || revealedRef.current) return
    const ctx = overlay.getContext("2d")
    if (!ctx) return

    const rect = overlay.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = ((clientX - rect.left) / rect.width) * cardWidth * dpr
    const y = ((clientY - rect.top) / rect.height) * cardHeight * dpr

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = "destination-out"

    const radius = brushRadius * dpr

    if (lastPosRef.current) {
      // Interpolate between points
      const dx = x - lastPosRef.current.x
      const dy = y - lastPosRef.current.y
      const dist = Math.hypot(dx, dy)
      const step = radius * 0.3

      const steps = Math.max(1, Math.ceil(dist / step))
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const px = lastPosRef.current.x + dx * t
        const py = lastPosRef.current.y + dy * t

        ctx.beginPath()
        ctx.arc(px, py, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
    lastPosRef.current = { x, y }
    hasStartedRef.current = true
  }, [cardWidth, cardHeight, brushRadius])

  // Check reveal on stroke end
  const checkReveal = useCallback(() => {
    const overlay = overlayCanvasRef.current
    if (!overlay || revealedRef.current) return
    const ctx = overlay.getContext("2d")
    if (!ctx) return

    const imgData = ctx.getImageData(0, 0, overlay.width, overlay.height)
    const data = imgData.data
    const pixelSkip = 16
    const byteSkip = 4 * pixelSkip

    let transparent = 0
    let total = 0

    for (let i = 0; i < data.length; i += byteSkip) {
      if (data[i + 3]! < 128) transparent++
      total++
    }

    if (total > 0 && transparent / total >= 0.5) {
      revealedRef.current = true
      setRevealed(true)
      setTimeout(() => onReveal(), 600)
    }
  }, [onReveal])

  return (
    <div
      style={{ position: "relative", width: cardWidth, height: cardHeight, touchAction: "none" }}
      className={`transition-all duration-500 ${revealed ? "scale-105 opacity-0" : ""}`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: cardWidth, height: cardHeight, position: "absolute", top: 0, left: 0, borderRadius: 12 }}
      />
      <canvas
        ref={overlayCanvasRef}
        style={{ width: cardWidth, height: cardHeight, position: "absolute", top: 0, left: 0, borderRadius: 12, cursor: "crosshair" }}
        onPointerDown={(e) => {
          if (!interactive) return
          isScratchingRef.current = true
          drawScratch(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (!interactive || !isScratchingRef.current) return
          drawScratch(e.clientX, e.clientY)
        }}
        onPointerUp={() => {
          isScratchingRef.current = false
          lastPosRef.current = null
          checkReveal()
        }}
        onPointerLeave={() => {
          isScratchingRef.current = false
          lastPosRef.current = null
          checkReveal()
        }}
        onPointerCancel={() => {
          isScratchingRef.current = false
          lastPosRef.current = null
          checkReveal()
        }}
      />
    </div>
  )
}

// ─── Wrapper ───────────────────────────────────────────────────────

function LoadingPlaceholder({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size * 0.72,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #D4AF37 0%, #F5E6B8 50%, #D4AF37 100%)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(255,255,255,0.3)",
          borderTopColor: "#ffffff",
          borderRadius: "50%",
          animation: "scratch-spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes scratch-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

/**
 * Scratch Card with automatic 3D/2D fallback.
 * Tier A/B → 3D (Three.js), Tier C → 2D (Canvas).
 */
export function ScratchCard(props: ScratchCardProps) {
  const [renderMode, setRenderMode] = useState<"detecting" | "3d" | "2d">("detecting")
  const { size = 400 } = props

  useEffect(() => {
    if (!detectWebGL()) {
      setRenderMode("2d")
      return
    }
    setRenderMode("3d")
  }, [])

  const handleFallbackTo2D = useCallback(() => {
    setRenderMode("2d")
  }, [])

  if (renderMode === "detecting") {
    return <LoadingPlaceholder size={size} />
  }

  if (renderMode === "2d") {
    return <ScratchCard2D {...props} />
  }

  return (
    <WebGLErrorBoundary fallback={<ScratchCard2D {...props} />}>
      <Suspense fallback={<LoadingPlaceholder size={size} />}>
        <ScratchCard3DGuarded {...props} onContextLost={handleFallbackTo2D} />
      </Suspense>
    </WebGLErrorBoundary>
  )
}

function ScratchCard3DGuarded(
  props: ScratchCardProps & { onContextLost: () => void }
) {
  const { onContextLost, ...rest } = props
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let canvas: HTMLCanvasElement | null = null

    function handleContextLost(e: Event) {
      e.preventDefault()
      onContextLost()
    }

    function attachListener(el: HTMLCanvasElement) {
      el.addEventListener("webglcontextlost", handleContextLost)
    }

    let pollAttempts = 0
    const pollInterval = setInterval(() => {
      canvas = container.querySelector("canvas")
      pollAttempts++
      if (canvas) {
        clearInterval(pollInterval)
        attachListener(canvas)
      } else if (pollAttempts > 50) {
        clearInterval(pollInterval)
        onContextLost()
      }
    }, 100)

    return () => {
      clearInterval(pollInterval)
      if (canvas) {
        canvas.removeEventListener("webglcontextlost", handleContextLost)
      }
    }
  }, [onContextLost])

  return (
    <div ref={containerRef}>
      <ScratchCard3DLazy {...rest} />
    </div>
  )
}
