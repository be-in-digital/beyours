"use client"

import { useRef } from "react"
import { RoundedBox, Text } from "@react-three/drei"
import * as THREE from "three"

interface CardMeshProps {
  prizeText: string
  didWin: boolean
  primaryColor?: string
}

const CARD_WIDTH = 2.8
const CARD_HEIGHT = 1.8
const CARD_DEPTH = 0.05

export function CardMesh({ prizeText, didWin, primaryColor = "#D4AF37" }: CardMeshProps) {
  const groupRef = useRef<THREE.Group>(null)

  return (
    <group ref={groupRef}>
      {/* Card body */}
      <RoundedBox
        args={[CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH]}
        radius={0.08}
        smoothness={4}
      >
        <meshStandardMaterial
          color="#faf8f0"
          roughness={0.6}
          metalness={0.1}
          side={THREE.FrontSide}
        />
      </RoundedBox>

      {/* Back face */}
      <mesh position={[0, 0, -CARD_DEPTH / 2 - 0.001]}>
        <planeGeometry args={[CARD_WIDTH - 0.1, CARD_HEIGHT - 0.1]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Prize text on front face */}
      <Text
        position={[0, 0.15, CARD_DEPTH / 2 + 0.001]}
        fontSize={0.22}
        maxWidth={CARD_WIDTH * 0.8}
        textAlign="center"
        anchorY="middle"
        color={didWin ? primaryColor : "#888888"}
      >
        {prizeText}
      </Text>

      {/* Subtitle */}
      <Text
        position={[0, -0.2, CARD_DEPTH / 2 + 0.001]}
        fontSize={0.1}
        maxWidth={CARD_WIDTH * 0.8}
        textAlign="center"
        anchorY="middle"
        color="#aaaaaa"
      >
        {didWin ? "Félicitations !" : "Pas de chance..."}
      </Text>

      {/* Decorative border on edges */}
      <mesh>
        <boxGeometry args={[CARD_WIDTH + 0.02, CARD_HEIGHT + 0.02, CARD_DEPTH + 0.01]} />
        <meshStandardMaterial
          color={primaryColor}
          roughness={0.4}
          metalness={0.6}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  )
}

export { CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH }
