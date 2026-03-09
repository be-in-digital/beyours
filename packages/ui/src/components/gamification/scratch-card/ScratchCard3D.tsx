"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { AdaptiveDpr, ContactShadows, Environment } from "@react-three/drei"
import * as THREE from "three"
import confetti from "canvas-confetti"

import type { ScratchCardProps } from "./types"
import { CardMesh } from "./CardMesh"
import { ScratchLayer } from "./ScratchLayer"
import { ScratchParticles } from "./ScratchParticles"
import { useScratchMask } from "./useScratchMask"
import { useDeviceCapability } from "../fortune-wheel/useDeviceCapability"

type DeviceTier = "A" | "B" | "C"

function getTier(isLowEnd: boolean): DeviceTier {
  if (isLowEnd) return "B"

  if (typeof navigator === "undefined") return "B"
  const cores = navigator.hardwareConcurrency ?? 0
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768

  if (cores >= 6 && (memory === undefined || memory >= 8) && !isMobile) return "A"
  return "B"
}

interface CardSceneProps extends ScratchCardProps {
  tier: DeviceTier
}

function CardScene({ prizeText, didWin, onReveal, primaryColor = "#D4AF37", interactive = false, tier }: CardSceneProps) {
  const groupRef = useRef<THREE.Group>(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const revealFiredRef = useRef(false)
  const [scratchReady, setScratchReady] = useState(false)

  const canvasSize = tier === "A" ? 512 : 256
  const brushSize = tier === "A" ? 25 : 30

  const handleReveal = useCallback(() => {
    if (revealFiredRef.current) return
    revealFiredRef.current = true

    // Fire confetti if won
    if (didWin) {
      const duration = 2000
      const end = Date.now() + duration
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#FFD700", "#FF6B6B", "#4ECDC4"],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#FFD700", "#FF6B6B", "#4ECDC4"],
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }

    // Delay to let reveal animation play
    setTimeout(() => onReveal(), 800)
  }, [didWin, onReveal])

  const mask = useScratchMask({
    width: canvasSize,
    height: canvasSize,
    brushRadius: brushSize,
    revealThreshold: 0.5,
    onReveal: handleReveal,
  })

  // Reset mask and add delay when interactive becomes true
  useEffect(() => {
    if (interactive) {
      mask.reset()
      revealFiredRef.current = false
      // Small delay to prevent accidental paint from CSS transition
      const timer = setTimeout(() => setScratchReady(true), 300)
      return () => clearTimeout(timer)
    } else {
      setScratchReady(false)
    }
  }, [interactive])

  // Card tilt based on pointer position
  useFrame(() => {
    if (!groupRef.current) return
    const targetX = -pointerRef.current.y * 0.175
    const targetY = pointerRef.current.x * 0.175
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.08)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.08)
  })

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <directionalLight position={[-5, -10, -5]} intensity={0.5} color="#c7d2fe" />

      {/* Environment for metallic reflections */}
      {tier === "A" && <Environment preset="city" />}

      {/* Tiltable card group */}
      <group
        ref={groupRef}
        onPointerMove={(e) => {
          const { point } = e
          pointerRef.current.x = Math.max(-1, Math.min(1, point.x / 1.4))
          pointerRef.current.y = Math.max(-1, Math.min(1, point.y / 0.9))
        }}
        onPointerLeave={() => {
          pointerRef.current.x = 0
          pointerRef.current.y = 0
        }}
      >
        <CardMesh
          prizeText={prizeText}
          didWin={didWin}
          primaryColor={primaryColor}
        />
        <ScratchLayer
          maskCanvas={mask.canvas}
          stateRef={mask.stateRef}
          onPaint={mask.paint}
          onEndStroke={mask.endStroke}
          onClearDirty={mask.clearDirty}
          interactive={scratchReady}
        />
      </group>

      {/* Particles — Tier A only */}
      {tier === "A" && <ScratchParticles enabled={true} />}

      {/* Contact shadows — Tier A only */}
      {tier === "A" && (
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.3}
          scale={5}
          blur={2}
          far={3}
        />
      )}
    </>
  )
}

export function ScratchCard3D(props: ScratchCardProps) {
  const device = useDeviceCapability()
  const tier = getTier(device.isLowEnd)
  const { size = 400 } = props

  const dpr: [number, number] = tier === "A" ? [1, 2] : [0.75, 1.5]

  return (
    <div
      style={{
        width: size,
        height: size * 0.72,
        position: "relative",
        touchAction: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <AdaptiveDpr pixelated />
        <CardScene {...props} tier={tier} />
      </Canvas>
    </div>
  )
}
