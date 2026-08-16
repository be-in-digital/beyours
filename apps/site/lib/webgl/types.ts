/**
 * Scene contract — formalises the API of a WebGL scene run by the SceneRegistry.
 *
 * The contract decouples the React components (which mount scenes through
 * <SceneView slot="...">) from the global orchestration (a canvas that persists
 * in the root layout, frameloop management, cross-route cleanup).
 *
 * Reference: Decision Log #19 (formalised WebGL architecture).
 */
export interface SceneContract<TParams = unknown> {
  /** Unique identifier of the scene (e.g. "hero-liquid", "products-orbit"). */
  id: string;

  /**
   * Mount hook: called when the scene becomes active.
   * Receives the parameters derived from the DOM (size, position, etc.).
   */
  mount: (params: TParams) => void;

  /**
   * Unmount hook: MUST dispose of every GPU resource
   * (geometries, materials, textures, render targets).
   * Without it → a memory leak across routes (critical risk #19).
   */
  unmount: () => void;

  /**
   * Per-frame update with the scroll progress [0,1] and the delta time.
   * Automatically short-circuited when the section is outside the viewport
   * (see SceneVisibilityManager).
   */
  update: (scrollProgress: number, deltaTime: number) => void;
}

/** Global registry state (consumable through Zustand). */
export interface SceneRegistryState {
  scenes: Map<string, SceneContract>;
  activeSceneId: string | null;
  scrollProgress: number;
  viewport: { width: number; height: number };
}

/** GPU capabilities of the current device. */
export interface DeviceCapabilities {
  /** Device RAM in GB (navigator.deviceMemory). */
  deviceMemory: number;
  /** Logical CPU cores. */
  hardwareConcurrency: number;
  /** Whether the device can handle the maximalist WebGL. */
  canRunFullWebGL: boolean;
  /** Derived quality tier: "high" | "medium" | "low". */
  tier: "high" | "medium" | "low";
  /** prefers-reduced-motion honoured (full DOM fallback). */
  prefersReducedMotion: boolean;
}
