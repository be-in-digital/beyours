import type { SceneContract } from "./types";

/**
 * SceneRegistry — singleton registry of the WebGL scenes active in the app.
 *
 * Pattern: a scene registers itself with `register()` when React mounts it,
 * then unregisters with `unregister()` on unmount.
 * The global R3FRoot canvas iterates over the active scenes on every frame
 * (through update()), but only the visible ones (filtered by
 * SceneVisibilityManager).
 *
 * See Decision Log #19.
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

  /** Global cleanup (handy for HMR + tests). */
  reset(): void {
    for (const scene of this.scenes.values()) {
      scene.unmount();
    }
    this.scenes.clear();
  }
}

export const SceneRegistry = new SceneRegistryClass();
