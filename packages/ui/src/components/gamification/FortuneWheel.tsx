"use client"

import { lazy, Suspense, useRef, useEffect, useState, useCallback } from "react"

import type { FortuneWheelProps } from "./types"
import { WebGLErrorBoundary } from "./ErrorBoundary"

export type { WheelSegment, FortuneWheelProps } from "./types"

const FortuneWheel3DLazy = lazy(() =>
  import("./fortune-wheel/FortuneWheel3D")
    .then((m) => ({ default: m.FortuneWheel3D }))
    .catch(() => ({
      default: () => {
        throw new Error("3D load failed")
      },
    }))
)

function LoadingPlaceholder({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle, #1a1a2e 0%, #0a0a15 100%)",
        borderRadius: "50%",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(255,215,0,0.3)",
          borderTopColor: "#FFD700",
          borderRadius: "50%",
          animation: "fortune-spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes fortune-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ErrorPlaceholder({ size, onRetry }: { size: number; onRetry: () => void }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 8,
        background: "radial-gradient(circle, #1a1a2e 0%, #0a0a15 100%)",
        borderRadius: "50%",
      }}
    >
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
        Impossible de charger la roue 3D
      </p>
      <button
        onClick={onRetry}
        style={{
          color: "#FFD700",
          fontSize: 13,
          background: "none",
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 8,
          padding: "6px 16px",
          cursor: "pointer",
        }}
      >
        Recharger
      </button>
    </div>
  )
}

/**
 * Wrapper that monitors WebGL context health.
 * On context loss, remounts the 3D component to recover.
 */
function FortuneWheel3DGuarded(
  props: FortuneWheelProps & { onContextLost: () => void }
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

    // R3F might not have created the canvas yet, poll briefly
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
      <FortuneWheel3DLazy {...rest} />
    </div>
  )
}

/**
 * Fortune Wheel — Three.js only, with context loss recovery.
 */
export function FortuneWheel(props: FortuneWheelProps) {
  const { size = 320 } = props
  const [mountKey, setMountKey] = useState(0)
  const [hasError, setHasError] = useState(false)
  const retryCountRef = useRef(0)

  const handleContextLost = useCallback(() => {
    retryCountRef.current++
    if (retryCountRef.current > 3) {
      // Too many retries, show error
      setHasError(true)
      return
    }
    // Remount the 3D component after a short delay
    setTimeout(() => {
      setMountKey((k) => k + 1)
    }, 500)
  }, [])

  const handleRetry = useCallback(() => {
    retryCountRef.current = 0
    setHasError(false)
    setMountKey((k) => k + 1)
  }, [])

  if (hasError) {
    return <ErrorPlaceholder size={size} onRetry={handleRetry} />
  }

  return (
    <WebGLErrorBoundary fallback={<ErrorPlaceholder size={size} onRetry={handleRetry} />}>
      <Suspense fallback={<LoadingPlaceholder size={size} />}>
        <FortuneWheel3DGuarded
          key={mountKey}
          {...props}
          onContextLost={handleContextLost}
        />
      </Suspense>
    </WebGLErrorBoundary>
  )
}
