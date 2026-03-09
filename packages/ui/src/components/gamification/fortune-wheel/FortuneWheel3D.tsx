"use client"

import { useRef, useEffect, useCallback } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { AdaptiveDpr, Environment } from "@react-three/drei"
import * as THREE from "three"
import confetti from "canvas-confetti"

import type { FortuneWheelProps } from "../types"
import { WheelSegment3D } from "./WheelSegment3D"
import { CenterHub } from "./CenterHub"
import { WheelRim } from "./WheelRim"
import { WheelStand } from "./WheelStand"
import { Pointer3D } from "./Pointer3D"
import { useDeviceCapability } from "./useDeviceCapability"
import { useWheelSounds } from "./useWheelSounds"

const SPIN_DURATION = 6 // seconds
const EXTRA_ROTATIONS = 6
const WHEEL_RADIUS = 3.2
const WHEEL_DEPTH = 0.25

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

interface WheelSceneProps extends FortuneWheelProps {
  curveSegments: number
  enableShadows: boolean
  enableLEDs: boolean
  enableBevel: boolean
  enableEnvironment: boolean
}

function WheelScene({
  segments,
  targetIndex,
  spinning,
  onSpinComplete,
  didWin,
  curveSegments,
  enableShadows,
  enableLEDs,
  enableBevel,
  enableEnvironment,
}: WheelSceneProps) {
  const wheelRef = useRef<THREE.Group>(null)
  const spinStartRef = useRef<number | null>(null)
  const startAngleRef = useRef(0)
  const targetAngleRef = useRef(0)
  const completedRef = useRef(false)
  const lastSegmentIndexRef = useRef(-1)

  const { playClick, playWin } = useWheelSounds()

  const segmentCount = segments.length
  const segmentAngle = segmentCount > 0 ? (Math.PI * 2) / segmentCount : 0
  const readyToSpinRef = useRef(false)

  // Start spin when `spinning` becomes true AND targetIndex is set
  useEffect(() => {
    if (!spinning || targetIndex === null || segmentCount === 0) {
      readyToSpinRef.current = false
      return
    }

    const currentAngle = startAngleRef.current
    const targetSegmentCenter = targetIndex * segmentAngle + segmentAngle / 2

    // Pointer is at top (PI/2 in Three.js).
    // We need: segment center + rotation.z = PI/2  (mod 2PI)
    //          rotation.z = -totalTarget
    // So:      totalTarget ≡ targetSegmentCenter - PI/2  (mod 2PI)
    const baseTarget = targetSegmentCenter - Math.PI / 2
    const minTarget = currentAngle + EXTRA_ROTATIONS * Math.PI * 2
    const TWO_PI = Math.PI * 2
    const normalizedBase = ((baseTarget % TWO_PI) + TWO_PI) % TWO_PI
    const normalizedMin = ((minTarget % TWO_PI) + TWO_PI) % TWO_PI
    const delta = ((normalizedBase - normalizedMin) % TWO_PI + TWO_PI) % TWO_PI
    const totalTarget = minTarget + delta

    targetAngleRef.current = totalTarget
    startAngleRef.current = currentAngle
    spinStartRef.current = null // Will be set on first frame
    completedRef.current = false
    readyToSpinRef.current = true
    lastSegmentIndexRef.current = -1
  }, [spinning, targetIndex, segmentCount, segmentAngle])

  const fireConfetti = useCallback(() => {
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
  }, [])

  useFrame((state) => {
    if (!spinning || completedRef.current || !readyToSpinRef.current || !wheelRef.current) return

    // Initialize start time on first frame
    if (spinStartRef.current === null) {
      spinStartRef.current = state.clock.elapsedTime
    }

    const elapsed = state.clock.elapsedTime - spinStartRef.current
    const progress = Math.min(elapsed / SPIN_DURATION, 1)
    const eased = easeOutQuart(progress)

    const currentAngle =
      startAngleRef.current +
      (targetAngleRef.current - startAngleRef.current) * eased

    wheelRef.current.rotation.z = -currentAngle

    // Click sound on segment crossings
    const normalizedAngle = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const currentSegIndex = Math.floor(normalizedAngle / segmentAngle) % segmentCount
    if (
      lastSegmentIndexRef.current !== -1 &&
      currentSegIndex !== lastSegmentIndexRef.current
    ) {
      playClick()
    }
    lastSegmentIndexRef.current = currentSegIndex

    if (progress >= 1) {
      completedRef.current = true
      startAngleRef.current = currentAngle
      if (didWin) {
        playWin()
        fireConfetti()
      }
      // Small delay before callback
      setTimeout(() => {
        onSpinComplete()
      }, didWin ? 800 : 300)
    }
  })

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow={enableShadows}
        shadow-mapSize-width={enableShadows ? 1024 : 256}
        shadow-mapSize-height={enableShadows ? 1024 : 256}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} />
      <pointLight position={[0, 0, 4]} intensity={0.6} color="#FFD700" />

      {enableEnvironment && <Environment preset="city" />}

      {/* Wheel group that rotates */}
      <group ref={wheelRef}>
        {/* Segments */}
        {segments.map((seg, i) => (
          <WheelSegment3D
            key={i}
            index={i}
            total={segmentCount}
            color={seg.color}
            label={seg.label}
            radius={WHEEL_RADIUS}
            depth={WHEEL_DEPTH}
            curveSegments={curveSegments}
            enableBevel={enableBevel}
          />
        ))}

        {/* Center hub */}
        <CenterHub depth={WHEEL_DEPTH} />

        {/* Rim */}
        <WheelRim radius={WHEEL_RADIUS} enableLEDs={enableLEDs} />
      </group>

      {/* Static elements (not spinning) */}
      <Pointer3D radius={WHEEL_RADIUS} />
      <WheelStand radius={WHEEL_RADIUS} />
    </>
  )
}

export function FortuneWheel3D(props: FortuneWheelProps) {
  const {
    curveSegments,
    enableShadows,
    enableLEDs,
    enableBevel,
    enableEnvironment,
    dpr,
  } = useDeviceCapability()

  const { size = 320 } = props

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 50 }}
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <AdaptiveDpr pixelated />
        <WheelScene
          {...props}
          curveSegments={curveSegments}
          enableShadows={enableShadows}
          enableLEDs={enableLEDs}
          enableBevel={enableBevel}
          enableEnvironment={enableEnvironment}
        />
      </Canvas>
    </div>
  )
}
