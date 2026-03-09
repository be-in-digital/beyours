"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import * as THREE from "three"

import { CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH } from "./CardMesh"
import type { ScratchMaskState } from "./useScratchMask"

interface ScratchLayerProps {
  maskCanvas: HTMLCanvasElement
  stateRef: React.RefObject<ScratchMaskState>
  onPaint: (uvX: number, uvY: number) => void
  onEndStroke: () => void
  onClearDirty: () => void
  interactive: boolean
}

/**
 * Create a procedural silver foil texture (noise + diagonal scratches).
 * Inspired by real scratch card appearance.
 */
function createFoilCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas

  // Silver base
  ctx.fillStyle = "#c0b070"
  ctx.fillRect(0, 0, w, h)

  // Metallic noise (grain)
  const imgData = ctx.getImageData(0, 0, w, h)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 50
    data[i] = Math.max(0, Math.min(255, data[i]! + noise))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise))
  }
  ctx.putImageData(imgData, 0, 0)

  // Diagonal scratch lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)"
  ctx.lineWidth = 1
  for (let i = -w; i < w; i += 15) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + h, h)
    ctx.stroke()
  }

  return canvas
}

export function ScratchLayer({
  maskCanvas,
  stateRef,
  onPaint,
  onEndStroke,
  onClearDirty,
  interactive,
}: ScratchLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const textRef = useRef<THREE.Group>(null)
  const isScratchingRef = useRef(false)
  const revealAnimRef = useRef({ active: false })

  // Create textures via useEffect + useState (proven pattern from reference)
  const [alphaMap, setAlphaMap] = useState<THREE.CanvasTexture | null>(null)
  const [foilTexture, setFoilTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    // Alpha map from scratch canvas
    const tex = new THREE.CanvasTexture(maskCanvas)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    setAlphaMap(tex)

    // Foil texture for metallic appearance
    const foilCanvas = createFoilCanvas(512, 512)
    const foilTex = new THREE.CanvasTexture(foilCanvas)
    foilTex.wrapS = THREE.RepeatWrapping
    foilTex.wrapT = THREE.RepeatWrapping
    foilTex.minFilter = THREE.LinearFilter
    setFoilTexture(foilTex)

    return () => {
      tex.dispose()
      foilTex.dispose()
    }
  }, [maskCanvas])

  // Reset reveal animation + material when interactive changes
  useEffect(() => {
    if (interactive) {
      revealAnimRef.current.active = false
      if (materialRef.current) {
        materialRef.current.opacity = 1
        materialRef.current.needsUpdate = true
      }
      if (meshRef.current) {
        meshRef.current.visible = true
      }
    }
  }, [interactive])

  // Frame loop: update texture + fade-out on reveal
  useFrame((_, delta) => {
    const state = stateRef.current
    if (!state) return

    // Update alphaMap texture when mask canvas is dirty
    if (state.isDirty && alphaMap) {
      alphaMap.needsUpdate = true
      onClearDirty()
    }

    // Fade "GRATTEZ ICI" text after first scratch
    if (textRef.current) {
      const targetOpacity = state.hasStarted ? 0 : 1
      const mat = (textRef.current.children[0] as THREE.Mesh)?.material as THREE.MeshBasicMaterial | undefined
      if (mat && "opacity" in mat) {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1)
      }
    }

    // Reveal fade-out animation (smooth, delta-based like reference)
    if (state.isRevealed && !revealAnimRef.current.active) {
      revealAnimRef.current.active = true
    }

    if (revealAnimRef.current.active && materialRef.current) {
      materialRef.current.opacity = THREE.MathUtils.lerp(
        materialRef.current.opacity,
        0,
        delta * 4
      )
      if (materialRef.current.opacity < 0.01 && meshRef.current) {
        meshRef.current.visible = false
      }
    }
  })

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!interactive || revealAnimRef.current.active) return
    e.stopPropagation()
    isScratchingRef.current = true
    // Pointer capture for smooth interaction
    ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
    const uv = e.uv
    if (uv) onPaint(uv.x, uv.y)
  }, [interactive, onPaint])

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isScratchingRef.current || !interactive || revealAnimRef.current.active) return
    e.stopPropagation()
    const uv = e.uv
    if (uv) onPaint(uv.x, uv.y)
  }, [interactive, onPaint])

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isScratchingRef.current) return
    e.stopPropagation()
    isScratchingRef.current = false
    ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
    onEndStroke()
  }, [onEndStroke])

  const handlePointerCancel = useCallback((e: ThreeEvent<PointerEvent>) => {
    isScratchingRef.current = false
    ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
    onEndStroke()
  }, [onEndStroke])

  // Don't render until textures are ready
  if (!alphaMap) return null

  return (
    <group>
      {/* Scratch layer plane — sits above the card */}
      <mesh
        ref={meshRef}
        position={[0, 0, CARD_DEPTH / 2 + 0.003]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <planeGeometry args={[CARD_WIDTH - 0.08, CARD_HEIGHT - 0.08]} />
        <meshStandardMaterial
          ref={materialRef}
          map={foilTexture}
          color="#ffffff"
          metalness={0.9}
          roughness={0.35}
          alphaMap={alphaMap}
          transparent
          alphaTest={0.05}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* "GRATTEZ ICI" overlay text */}
      <group ref={textRef} position={[0, 0, CARD_DEPTH / 2 + 0.006]}>
        <Text
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          material-transparent={true}
          material-opacity={1}
          material-depthWrite={false}
        >
          GRATTEZ ICI
        </Text>
      </group>
    </group>
  )
}
