"use client"

interface WheelRimProps {
  radius: number
  enableLEDs: boolean
}

export function WheelRim({ radius, enableLEDs }: WheelRimProps) {
  const rimRadius = radius + 0.08

  const studCount = enableLEDs ? 20 : 0

  return (
    <group>
      {/* Main outer rim */}
      <mesh>
        <torusGeometry args={[rimRadius, 0.12, 24, 96]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.95}
          roughness={0.1}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Inner decorative ring */}
      <mesh position={[0, 0, 0.04]}>
        <torusGeometry args={[rimRadius - 0.06, 0.04, 12, 96]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.85} roughness={0.1} />
      </mesh>

      {/* Outer thin ring */}
      <mesh position={[0, 0, -0.04]}>
        <torusGeometry args={[rimRadius + 0.06, 0.03, 12, 96]} />
        <meshStandardMaterial color="#FFD700" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Decorative studs */}
      {Array.from({ length: studCount }).map((_, i) => {
        const a = (i / studCount) * Math.PI * 2
        const x = Math.cos(a) * rimRadius
        const y = Math.sin(a) * rimRadius
        return (
          <mesh key={i} position={[x, y, 0.14]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial
              color="#FFD700"
              metalness={0.95}
              roughness={0.1}
              emissive="#FFD700"
              emissiveIntensity={0.15}
            />
          </mesh>
        )
      })}

      {/* LED glow ring */}
      {enableLEDs && (
        <mesh position={[0, 0, 0.16]}>
          <torusGeometry args={[rimRadius, 0.015, 6, 96]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}
    </group>
  )
}
