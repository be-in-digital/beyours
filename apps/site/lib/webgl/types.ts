/**
 * Scene contract — formalise l'API d'une scène WebGL gérée par le SceneRegistry.
 *
 * Ce contrat permet de découpler les composants React (qui montent les scènes
 * via <SceneView slot="...">) de l'orchestration globale (canvas persistant
 * dans le root layout, gestion du frameloop, cleanup cross-route).
 *
 * Référence : Decision Log #19 (architecture WebGL formalisée).
 */
export interface SceneContract<TParams = unknown> {
  /** Identifiant unique de la scène (ex. "hero-liquid", "products-orbit"). */
  id: string;

  /**
   * Hook de montage : appelé quand la scène devient active.
   * Reçoit les paramètres dérivés du DOM (taille, position, etc.).
   */
  mount: (params: TParams) => void;

  /**
   * Hook de démontage : DOIT disposer toutes les ressources GPU
   * (géométries, matériaux, textures, render targets).
   * Sans ça → memory leak inter-routes (risque critique #19).
   */
  unmount: () => void;

  /**
   * Update par frame avec progress de scroll [0,1] et delta time.
   * Court-circuité automatiquement quand la section est hors viewport
   * (voir SceneVisibilityManager).
   */
  update: (scrollProgress: number, deltaTime: number) => void;
}

/** État global du registry (consommable via Zustand). */
export interface SceneRegistryState {
  scenes: Map<string, SceneContract>;
  activeSceneId: string | null;
  scrollProgress: number;
  viewport: { width: number; height: number };
}

/** Capabilities GPU du device courant. */
export interface DeviceCapabilities {
  /** RAM device en GB (navigator.deviceMemory). */
  deviceMemory: number;
  /** Cores logiques CPU. */
  hardwareConcurrency: number;
  /** Indique si le device peut supporter WebGL maximaliste. */
  canRunFullWebGL: boolean;
  /** Tier de qualité dérivé : "high" | "medium" | "low". */
  tier: "high" | "medium" | "low";
  /** prefers-reduced-motion respecté (fallback DOM total). */
  prefersReducedMotion: boolean;
}
