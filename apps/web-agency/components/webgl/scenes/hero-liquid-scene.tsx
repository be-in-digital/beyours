"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore } from "@/store/scene-store";

/**
 * HeroLiquidScene v4 — Constellation de produits du studio.
 *
 * Cap design (retours user successifs sur les v1-v3) :
 *   "Pas de blob, pas de glass générique, pas de post-processing arcade.
 *    Quelque chose qui parle de ce que fait l'agence : ses produits."
 *
 * Composition :
 *   - 4 plans 3D, chacun texturé avec le screenshot d'un projet réel
 *     (assets en public/work/*.png, capturés en headless Chrome)
 *   - Be in Digital Restaurant en VEDETTE à droite, plus grand
 *   - Wedilly Bird, Maison Binato, Jokko en orbites autour, plus petits
 *   - Léger bobbing par carte (phase et fréquence custom) + parallax
 *     souris sur le groupe entier
 *   - Aucun post-processing : tone mapping ACES sur le canvas, c'est tout.
 *     Lighting basique mint pour ne pas désaturer les screenshots.
 *
 * Inspirations : Untitled Studio, Studio Studio, Locomotive — sobre,
 * commercial, lisible en 0.5s.
 */

type Project = {
  readonly slug: string;
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly tilt: readonly [number, number]; // [rotX, rotY] base
  readonly bobAmp: number;
  readonly bobSpeed: number;
  readonly phase: number;
};

const PROJECTS = [
  {
    slug: "bid-restaurant",
    position: [1.6, 0.25, 0],
    scale: 1.05,
    tilt: [0.04, -0.18],
    bobAmp: 0.04,
    bobSpeed: 0.6,
    phase: 0,
  },
  {
    slug: "wedilly-bird",
    position: [-1.55, 0.95, -0.65],
    scale: 0.58,
    tilt: [0.0, 0.22],
    bobAmp: 0.06,
    bobSpeed: 0.75,
    phase: 1.2,
  },
  {
    slug: "maison-binato",
    position: [-2.05, -0.55, -0.3],
    scale: 0.5,
    tilt: [-0.05, 0.15],
    bobAmp: 0.05,
    bobSpeed: 0.55,
    phase: 2.4,
  },
  {
    slug: "jokko",
    position: [-0.35, -1.1, -0.75],
    scale: 0.55,
    tilt: [0.07, -0.1],
    bobAmp: 0.05,
    bobSpeed: 0.8,
    phase: 3.4,
  },
] as const satisfies readonly Project[];

const CARD_BASE = { width: 1.6, height: 1.0 } as const; // 16:10 aspect

function ProjectCard({ project }: { project: Project }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useTexture(`/work/${project.slug}.png`);

  // Color space + filtering for a clean screenshot rendering.
  // The hook value is a THREE.Texture whose API expects in-place mutation;
  // this is a known exception to the React 19 immutability rule.
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
    // Subtle bobbing on Y, subtle drift on rotation
    m.position.y =
      project.position[1] + Math.sin(t * project.bobSpeed + project.phase) * project.bobAmp;
    m.rotation.y =
      project.tilt[1] + Math.sin(t * 0.25 + project.phase) * 0.03;
    m.rotation.x =
      project.tilt[0] + Math.cos(t * 0.18 + project.phase) * 0.02;
  });

  return (
    <mesh
      ref={meshRef}
      position={project.position as unknown as [number, number, number]}
      scale={project.scale}
    >
      <planeGeometry args={[CARD_BASE.width, CARD_BASE.height]} />
      <meshBasicMaterial
        map={tex}
        toneMapped={false}
        transparent
        opacity={0.96}
      />
    </mesh>
  );
}

// Preload textures so the first frames don't suspend.
useTexture.preload(PROJECTS.map((p) => `/work/${p.slug}.png`));

export function HeroLiquidScene() {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotRef = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    // Mouse parallax: subtle, lerped, dampens jitter from Lenis.
    const t = targetRotRef.current;
    t.y = state.mouse.x * 0.18;
    t.x = -state.mouse.y * 0.1;
    g.rotation.y += (t.y - g.rotation.y) * 0.05;
    g.rotation.x += (t.x - g.rotation.x) * 0.05;

    // Scroll progress contributes a slight Z-distance push that makes
    // the constellation receive the morph cue before the wrapper fades.
    const raw = useSceneStore.getState().scrollProgress;
    const scrollT = Math.min(1, raw * 4);
    g.position.z = -scrollT * 1.8;
  });

  return (
    <group ref={groupRef}>
      {/* Lighting: soft mint ambient + a single key light. We use
          MeshBasicMaterial on the cards (toneMapped:false) so the
          screenshots come through unaltered, but the lighting still
          tints the negative space subtly. */}
      <ambientLight intensity={0.55} color="#1c3329" />
      <directionalLight
        position={[3, 4, 5]}
        intensity={0.6}
        color="#7DDBC3"
      />

      {PROJECTS.map((p) => (
        <ProjectCard key={p.slug} project={p} />
      ))}
    </group>
  );
}
