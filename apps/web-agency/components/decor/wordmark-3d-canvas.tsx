"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import * as THREE from "three";

/**
 * Wordmark 3D extrudé — "BE IN DIGITAL" rendu en 3 lignes empilées,
 * legère rotation au scroll/mouse parallax, lumière mint qui glisse
 * sur les faces.
 *
 * Texte sur 3 lignes pour densifier la composition et tenir dans le
 * cadre :
 *      BE
 *      IN
 *      DIGITAL
 *
 * Helvetiker Bold (font Three.js officielle, MIT-licensed) — sobre,
 * lisible en grande taille, lecture neutre qui laisse le mint parler.
 */

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";
const SHARED_TEXT_PROPS = {
  font: FONT_URL,
  size: 1.05,
  height: 0.32,
  curveSegments: 12,
  bevelEnabled: true,
  bevelSize: 0.018,
  bevelThickness: 0.022,
  bevelSegments: 4,
} as const;

function WordmarkContent() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    // Lent yaw/roll continu
    groupRef.current.rotation.y += delta * 0.05;

    // Mouse parallax doux + tilt de base
    const targetX = -0.18 + state.pointer.y * 0.06;
    const targetZ = 0.05 + state.pointer.x * 0.08;
    groupRef.current.rotation.x +=
      (targetX - groupRef.current.rotation.x) * 0.04;
    groupRef.current.rotation.z +=
      (targetZ - groupRef.current.rotation.z) * 0.04;
  });

  return (
    <group ref={groupRef} rotation={[-0.18, 0, 0.05]}>
      {/* Lumière qui sculpte les facettes mint */}
      <ambientLight intensity={0.18} color="#0F1F1A" />
      <directionalLight
        position={[3, 4, 5]}
        intensity={1.4}
        color="#A0E5D3"
      />
      <directionalLight
        position={[-3, -2, 3]}
        intensity={0.8}
        color="#52CFAF"
      />
      <pointLight position={[0, 0, 3]} intensity={1.0} color="#7DDBC3" />

      <Center>
        <group>
          <Text3D {...SHARED_TEXT_PROPS} position={[0, 1.55, 0]}>
            BE
            <meshStandardMaterial
              color="#52CFAF"
              metalness={0.55}
              roughness={0.32}
              emissive="#0E2520"
              emissiveIntensity={0.45}
            />
          </Text3D>

          <Text3D {...SHARED_TEXT_PROPS} position={[0, 0, 0]}>
            IN
            <meshStandardMaterial
              color="#52CFAF"
              metalness={0.55}
              roughness={0.32}
              emissive="#0E2520"
              emissiveIntensity={0.45}
            />
          </Text3D>

          <Text3D {...SHARED_TEXT_PROPS} position={[0, -1.55, 0]}>
            DIGITAL
            <meshStandardMaterial
              color="#52CFAF"
              metalness={0.55}
              roughness={0.32}
              emissive="#0E2520"
              emissiveIntensity={0.45}
            />
          </Text3D>
        </group>
      </Center>
    </group>
  );
}

export function Wordmark3DCanvas() {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        dpr={[1, 2]}
        frameloop="always"
        camera={{ position: [0, 0, 7], fov: 36 }}
      >
        <WordmarkContent />
      </Canvas>
    </div>
  );
}
