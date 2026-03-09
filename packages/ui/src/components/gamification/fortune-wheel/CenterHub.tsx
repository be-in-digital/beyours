"use client"

interface CenterHubProps {
  depth: number
}

export function CenterHub({ depth }: CenterHubProps) {
  return (
    <group position={[0, 0, depth / 2]}>
      <mesh position={[0, 0, 0.25]}>
        <sphereGeometry args={[0.5, 48, 48]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.15}
          envMapIntensity={1.2}
        />
      </mesh>
    </group>
  )
}
