"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const POOL_SIZE = 60
const PARTICLE_LIFETIME = 0.4

interface Particle {
  active: boolean
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

interface ScratchParticlesProps {
  enabled: boolean
}

export function ScratchParticles({ enabled }: ScratchParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const positionsRef = useRef(new Float32Array(POOL_SIZE * 3))
  const colorsRef = useRef(new Float32Array(POOL_SIZE * 3))
  const sizesRef = useRef(new Float32Array(POOL_SIZE))

  const particles = useRef<Particle[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      life: 0,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
    }))
  )

  // Gold/silver colors
  const goldColor = useMemo(() => new THREE.Color("#FFD700"), [])
  const silverColor = useMemo(() => new THREE.Color("#C0C0C0"), [])

  useFrame((_, delta) => {
    if (!pointsRef.current || !enabled) return

    const positions = positionsRef.current
    const colors = colorsRef.current
    const sizes = sizesRef.current
    const pool = particles.current

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i]!
      if (!p.active) {
        positions[i * 3] = 0
        positions[i * 3 + 1] = 0
        positions[i * 3 + 2] = -10
        sizes[i] = 0
        continue
      }

      p.life -= delta
      if (p.life <= 0) {
        p.active = false
        sizes[i] = 0
        continue
      }

      // Physics
      p.vy -= 2 * delta // gravity
      p.x += p.vx * delta
      p.y += p.vy * delta
      p.z += p.vz * delta

      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z

      const lifeFrac = p.life / PARTICLE_LIFETIME
      sizes[i] = lifeFrac * 0.06

      const color = i % 2 === 0 ? goldColor : silverColor
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    const geom = pointsRef.current.geometry
    geom.attributes.position!.needsUpdate = true
    geom.attributes.color!.needsUpdate = true
    geom.attributes.size!.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current, 3]}
          count={POOL_SIZE}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colorsRef.current, 3]}
          count={POOL_SIZE}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizesRef.current, 1]}
          count={POOL_SIZE}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/**
 * Emit 1-2 particles at the given position.
 * Called from ScratchLayer on paint events.
 */
export function emitParticles(
  particles: React.RefObject<Particle[]>,
  x: number,
  y: number,
  z: number
): void {
  const pool = particles.current
  if (!pool) return

  const count = 1 + Math.floor(Math.random() * 2)
  let emitted = 0

  for (let i = 0; i < POOL_SIZE && emitted < count; i++) {
    const p = pool[i]!
    if (p.active) continue

    p.active = true
    p.life = PARTICLE_LIFETIME
    p.x = x + (Math.random() - 0.5) * 0.1
    p.y = y + (Math.random() - 0.5) * 0.1
    p.z = z + 0.05
    p.vx = (Math.random() - 0.5) * 1.5
    p.vy = Math.random() * 1.5 + 0.5
    p.vz = Math.random() * 0.5
    emitted++
  }
}
