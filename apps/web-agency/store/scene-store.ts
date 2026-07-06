"use client";

import { create } from "zustand";
import type { DeviceCapabilities } from "@beindigital/webgl-utils";

/**
 * sceneStore — état global de l'orchestration WebGL.
 *
 * Decision Log #19 + #23 + #24 :
 * - Canvas Three.js global persistant dans le root layout
 * - Lenis = seul driver de scroll, ses valeurs alimentent ce store
 * - Les scènes consomment scrollY/scrollProgress sans dépendre de RAF concurrents
 */
interface SceneState {
  /** Scène 3D actuellement "active" (visible / focus). */
  activeSceneId: string | null;

  /** Scroll progress global [0, 1] sur la longueur totale du document. */
  scrollProgress: number;

  /** Scroll Y pixel value (raw, depuis Lenis). */
  scrollY: number;

  /** Viewport courant (resize-aware). */
  viewport: { width: number; height: number };

  /** Capabilities GPU détectées au mount client. */
  capabilities: DeviceCapabilities | null;

  /** Indique si la 3D peut tourner (capabilities + reduced-motion + readiness). */
  webglReady: boolean;

  /** Setters. */
  setActiveScene: (id: string | null) => void;
  setScroll: (y: number, progress: number) => void;
  setViewport: (w: number, h: number) => void;
  setCapabilities: (caps: DeviceCapabilities) => void;
  setWebglReady: (ready: boolean) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  activeSceneId: null,
  scrollProgress: 0,
  scrollY: 0,
  viewport: { width: 0, height: 0 },
  capabilities: null,
  webglReady: false,

  setActiveScene: (id) => set({ activeSceneId: id }),
  setScroll: (y, progress) => set({ scrollY: y, scrollProgress: progress }),
  setViewport: (width, height) => set({ viewport: { width, height } }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setWebglReady: (webglReady) => set({ webglReady }),
}));
