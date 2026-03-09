"use client"

interface WheelStandProps {
  radius: number
}

export function WheelStand({ radius }: WheelStandProps) {
  return (
    <group position={[0, -radius - 0.25, 0]}>
      {/* Connection piece */}
      <mesh>
        <cylinderGeometry args={[0.25, 0.35, 0.4, 24]} />
        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Main column */}
      <mesh position={[0, -1.0, 0]}>
        <cylinderGeometry args={[0.2, 0.4, 1.6, 24]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.1} />
      </mesh>

      {/* Gold accent ring */}
      <mesh position={[0, -0.35, 0]}>
        <torusGeometry args={[0.3, 0.05, 12, 24]} />
        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Base platform top */}
      <mesh position={[0, -1.9, 0]}>
        <cylinderGeometry args={[1.0, 1.2, 0.12, 48]} />
        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Base platform body */}
      <mesh position={[0, -2.1, 0]}>
        <cylinderGeometry args={[1.25, 1.5, 0.3, 48]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.1} />
      </mesh>

      {/* Base bottom ring */}
      <mesh position={[0, -2.3, 0]}>
        <cylinderGeometry args={[1.55, 1.7, 0.12, 48]} />
        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Ground plate */}
      <mesh position={[0, -2.4, 0]}>
        <cylinderGeometry args={[1.8, 1.9, 0.08, 48]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.05} />
      </mesh>

      {/* Decorative bolts */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 1.3, -2.1, Math.sin(a) * 1.3]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.1} />
          </mesh>
        )
      })}
    </group>
  )
}
