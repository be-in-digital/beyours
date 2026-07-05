"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { detectCapabilities } from "@beindigital/webgl-utils";
import { useSceneStore } from "@/store/scene-store";
import { HeroLiquidScene } from "./scenes/hero-liquid-scene";

/**
 * R3FRoot — canvas Three.js global persistant.
 *
 * Sobriété assumée (Decision Log #19, retours user) :
 *   - Pas de post-processing global (Bloom / ChromaticAberration / Vignette).
 *     Le combo drei "starter pack" se reconnaît à 1 km dans le jury Awwwards.
 *   - Tone mapping ACES sur le renderer pour des couleurs cinéma sans halo.
 *   - Le canvas est position: fixed inset-0, pointer-events-none, z-0.
 *   - L'opacity du wrapper baisse progressivement quand l'utilisateur
 *     scrolle au-delà du hero, pour que la scène ne reste pas plaquée
 *     en arrière-plan sur les autres sections.
 */
export function R3FRoot() {
  const setCapabilities = useSceneStore((s) => s.setCapabilities);
  const setWebglReady = useSceneStore((s) => s.setWebglReady);
  const setViewport = useSceneStore((s) => s.setViewport);
  const webglReady = useSceneStore((s) => s.webglReady);
  const scrollY = useSceneStore((s) => s.scrollY);
  const viewportH = useSceneStore((s) => s.viewport.height);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const caps = detectCapabilities();
    setCapabilities(caps);
    setWebglReady(caps.canRunFullWebGL);

    const onResize = () => setViewport(window.innerWidth, window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });

    const t = setTimeout(() => setShouldMount(true), 350);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [setCapabilities, setViewport, setWebglReady]);

  if (!shouldMount || !webglReady) return null;

  // Fade out as the user leaves the hero. Fully visible until 30vh of
  // scroll, then linearly drops to 0 at 100vh.
  const fadeStart = viewportH * 0.3;
  const fadeEnd = viewportH * 1.0;
  const opacity =
    scrollY < fadeStart
      ? 1
      : scrollY > fadeEnd
        ? 0
        : 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        opacity,
        transition: "opacity 200ms linear",
      }}
    >
      <Canvas
        dpr={[1, 2]}
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
        <Suspense fallback={null}>
          <HeroLiquidScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
