"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  detectCapabilities,
  useSceneVisibility,
} from "@/lib/webgl";

/**
 * HeroScene — voile de braises au-dessus du hero cinématique.
 *
 * Le hero est une photo plein écran (chef aux fourneaux) : la scène 3D
 * n'ajoute que ce que la photo ne peut pas faire — des braises qui
 * montent lentement, avec un parallax souris amorti. Sobriété héritée
 * de la doctrine agency : pas de blob, pas de post-processing.
 * Coupé sur devices faibles et en prefers-reduced-motion.
 */

/** Pseudo-aléatoire déterministe (pur — compatible React Compiler) */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Braises mint qui montent lentement */
function Embers({ count = 90 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seeded(i, 1) - 0.5) * 5.2; // x
      positions[i * 3 + 1] = (seeded(i, 2) - 0.5) * 3.0; // y
      positions[i * 3 + 2] = -1.4 + seeded(i, 3) * 1.6; // z
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
        opacity={0.3}
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
      <Embers />
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
