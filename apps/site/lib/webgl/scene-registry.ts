import type { SceneContract } from "./types";

/**
 * SceneRegistry — registre singleton des scènes WebGL actives dans l'app.
 *
 * Pattern : une scène s'enregistre via `register()` à son mount React,
 * puis se désenregistre via `unregister()` à son unmount.
 * Le R3FRoot canvas global itère sur les scènes actives à chaque frame
 * (via update()) seulement si visibles (filtre par SceneVisibilityManager).
 *
 * Voir Decision Log #19.
 */
class SceneRegistryClass {
  private scenes = new Map<string, SceneContract>();

  register<T>(scene: SceneContract<T>): void {
    if (this.scenes.has(scene.id)) {
      throw new Error(`SceneRegistry: scene "${scene.id}" already registered`);
    }
    this.scenes.set(scene.id, scene as SceneContract);
  }

  unregister(id: string): void {
    const scene = this.scenes.get(id);
    if (!scene) return;
    scene.unmount();
    this.scenes.delete(id);
  }

  get(id: string): SceneContract | undefined {
    return this.scenes.get(id);
  }

  list(): SceneContract[] {
    return Array.from(this.scenes.values());
  }

  /** Cleanup global (utile pour HMR + tests). */
  reset(): void {
    for (const scene of this.scenes.values()) {
      scene.unmount();
    }
    this.scenes.clear();
  }
}

export const SceneRegistry = new SceneRegistryClass();
