"use client"

import { useMemo } from "react"
import { Text } from "@react-three/drei"
import * as THREE from "three"

interface WheelSegment3DProps {
  index: number
  total: number
  color: string
  label: string
  radius: number
  depth: number
  curveSegments: number
  enableBevel: boolean
}

export function WheelSegment3D({
  index,
  total,
  color,
  label,
  radius,
  depth,
  curveSegments,
  enableBevel,
}: WheelSegment3DProps) {
  const segmentAngle = (Math.PI * 2) / total
  const angle = index * segmentAngle

  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.arc(0, 0, radius, 0, segmentAngle, false)
    s.lineTo(0, 0)
    return s
  }, [radius, segmentAngle])

  const extrudeSettings = useMemo(
    () => ({
      depth,
      bevelEnabled: enableBevel,
      bevelSize: enableBevel ? 0.04 : 0,
      bevelThickness: enableBevel ? 0.04 : 0,
      curveSegments,
    }),
    [depth, enableBevel, curveSegments]
  )

  const midAngle = angle + segmentAngle / 2
  const labelRadius = radius * 0.6
  const labelX = Math.cos(midAngle) * labelRadius
  const labelY = Math.sin(midAngle) * labelRadius
  const textRotation = midAngle - Math.PI / 2

  // Truncate label if too long
  const displayLabel = label.length > 14 ? label.slice(0, 12) + "\u2026" : label

  return (
    <group>
      {/* Wedge segment */}
      <group rotation={[0, 0, angle]}>
        <mesh position={[0, 0, -depth / 2]}>
          <extrudeGeometry args={[shape, extrudeSettings]} />
          <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
        </mesh>

        {/* Peg at the outer edge */}
        <mesh position={[radius, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, depth + 0.15, 12]} />
          <meshStandardMaterial color="#FFD700" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Text label */}
      <Text
        position={[labelX, labelY, depth / 2 + 0.05]}
        rotation={[0, 0, textRotation]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#000000"
        maxWidth={radius * 0.55}
      >
        {displayLabel}
      </Text>
    </group>
  )
}
