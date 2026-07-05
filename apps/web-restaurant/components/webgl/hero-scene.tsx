"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  detectCapabilities,
  useSceneVisibility,
} from "@beindigital/webgl-utils";

/**
 * HeroScene — constellation 3D de l'univers restauration.
 *
 * Même doctrine que la scène hero de l'agency (Decision Log #19) :
 * pas de blob générique, pas de post-processing arcade — des cartes 3D
 * texturées avec de la vraie matière (photos food/salle/chef) qui
 * flottent en périphérie du titre, plus un voile de braises mint qui
 * monte lentement. Parallax souris lerpé, fade au scroll, coupé sur
 * les devices faibles et en prefers-reduced-motion.
 */

type MoodCard = {
  readonly src: string;
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly tilt: readonly [number, number]; // [rotX, rotY]
  readonly bobAmp: number;
  readonly bobSpeed: number;
  readonly phase: number;
};

const CARDS: readonly MoodCard[] = [
  {
    // Dressage gastro — haut gauche
    src: "/photos/plat-gastronomie.webp",
    position: [-1.75, 0.72, -0.55],
    scale: 0.66,
    tilt: [0.05, 0.3],
    bobAmp: 0.055,
    bobSpeed: 0.55,
    phase: 0,
  },
  {
    // Burger — droite
    src: "/photos/burger-premium.webp",
    position: [1.8, 0.38, -0.4],
    scale: 0.58,
    tilt: [0.03, -0.32],
    bobAmp: 0.06,
    bobSpeed: 0.7,
    phase: 1.4,
  },
  {
    // Salle chaleureuse — bas gauche
    src: "/photos/salle-restaurant2.webp",
    position: [-1.62, -0.78, -0.75],
    scale: 0.48,
    tilt: [-0.04, 0.24],
    bobAmp: 0.05,
    bobSpeed: 0.62,
    phase: 2.6,
  },
  {
    // Chef aux fourneaux — bas droite
    src: "/photos/chef-flammes.webp",
    position: [1.68, -0.88, -0.9],
    scale: 0.52,
    tilt: [0.06, -0.22],
    bobAmp: 0.05,
    bobSpeed: 0.75,
    phase: 3.6,
  },
];

const CARD_GEOMETRY = { width: 1.5, height: 1.0 } as const;

function PhotoCard({ card }: { card: MoodCard }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useTexture(card.src);

  // In-place texture tuning — known exception to the React immutability rule
  // (same pattern as the agency hero scene).
  useEffect(() => {
    /* eslint-disable react-hooks/immutability */
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipMapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    /* eslint-enable react-hooks/immutability */
  }, [tex]);

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    m.position.y =
      card.position[1] + Math.sin(t * card.bobSpeed + card.phase) * card.bobAmp;
    m.rotation.y = card.tilt[1] + Math.sin(t * 0.22 + card.phase) * 0.035;
    m.rotation.x = card.tilt[0] + Math.cos(t * 0.16 + card.phase) * 0.025;
  });

  return (
    <mesh
      ref={meshRef}
      position={card.position as unknown as [number, number, number]}
      scale={card.scale}
    >
      <planeGeometry args={[CARD_GEOMETRY.width, CARD_GEOMETRY.height]} />
      <meshBasicMaterial map={tex} toneMapped={false} transparent opacity={0.92} />
    </mesh>
  );
}

useTexture.preload(CARDS.map((c) => c.src));

/** Pseudo-aléatoire déterministe (pur — compatible React Compiler) */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Braises / vapeur mint qui montent lentement derrière le titre */
function Embers({ count = 90 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seeded(i, 1) - 0.5) * 5.2; // x
      positions[i * 3 + 1] = (seeded(i, 2) - 0.5) * 3.0; // y
      positions[i * 3 + 2] = -1.4 + seeded(i, 3) * 1.6; // z (derrière les cartes)
      seeds[i * 2] = seeded(i, 4) * Math.PI * 2; // phase
      seeds[i * 2 + 1] = 0.05 + seeded(i, 5) * 0.1; // vitesse ascension
    }
    return { positions, seeds };
  }, [count]);

  useFrame((state, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const phase = seeds[i * 2]!;
      const speed = seeds[i * 2 + 1]!;
      let y = arr[i * 3 + 1]! + speed * delta; // monte doucement
      if (y > 1.6) y = -1.6; // recycle en bas
      arr[i * 3 + 1] = y;
      arr[i * 3] = arr[i * 3]! + Math.sin(t * 0.4 + phase) * 0.0009; // sway
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#52cfaf"
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SceneContent() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    // Parallax souris — subtil et lerpé (même réglage que l'agency)
    const ty = state.mouse.x * 0.16;
    const tx = -state.mouse.y * 0.09;
    g.rotation.y += (ty - g.rotation.y) * 0.05;
    g.rotation.x += (tx - g.rotation.x) * 0.05;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} color="#1c3329" />
      <Embers />
      {CARDS.map((card) => (
        <PhotoCard key={card.src} card={card} />
      ))}
    </group>
  );
}

export function HeroScene() {
  const [webglReady, setWebglReady] = useState(false);
  const { ref, visible } = useSceneVisibility<HTMLDivElement>({
    rootMargin: "160px",
  });
  const [scrollFade, setScrollFade] = useState(1);

  useEffect(() => {
    // rAF : évite un setState synchrone dans l'effect (règle React 19)
    const raf = requestAnimationFrame(() => {
      setWebglReady(detectCapabilities().canRunFullWebGL);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fade la scène quand on quitte le hero (30vh → 100vh), comme l'agency
  useEffect(() => {
    if (!webglReady) return;
    const onScroll = () => {
      const vh = window.innerHeight;
      const y = window.scrollY;
      const fadeStart = vh * 0.3;
      const fadeEnd = vh * 1.0;
      setScrollFade(
        y < fadeStart
          ? 1
          : y > fadeEnd
            ? 0
            : 1 - (y - fadeStart) / (fadeEnd - fadeStart),
      );
    };
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [webglReady]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-screen z-[1] hidden md:block"
      style={{ opacity: scrollFade, transition: "opacity 180ms linear" }}
    >
      {webglReady && visible && scrollFade > 0 && (
        <Canvas
          dpr={[1, 1.75]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          frameloop="always"
          camera={{ position: [0, 0, 4.2], fov: 38, near: 0.1, far: 100 }}
        >
          <SceneContent />
        </Canvas>
      )}
    </div>
  );
}
