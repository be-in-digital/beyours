"use client"

interface Pointer3DProps {
  radius: number
}

export function Pointer3D({ radius }: Pointer3DProps) {
  return (
    <group position={[0, radius + 0.4, 0.4]}>
      {/* Triangle pointer */}
      <mesh rotation={[0, 0, Math.PI]} position={[0, -0.35, 0]}>
        <coneGeometry args={[0.25, 0.7, 24]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.95}
          roughness={0.1}
        />
      </mesh>

      {/* Mounting bracket */}
      <mesh position={[0, 0.15, -0.15]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}
