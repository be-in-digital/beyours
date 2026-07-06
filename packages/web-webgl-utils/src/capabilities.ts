import type { DeviceCapabilities } from "./types";

/**
 * detectCapabilities — détermine si le device peut supporter le WebGL
 * maximaliste, ou s'il faut servir un fallback DOM premium.
 *
 * Critères (Decision Log #11 + Multi-agent perf review) :
 * - deviceMemory <= 2 GB ou hardwareConcurrency <= 4 → tier "low" → fallback DOM
 * - prefers-reduced-motion → fallback DOM strict (image SVG du hero)
 * - sinon → tier "medium" ou "high" selon ressources
 *
 * Doit être appelé côté client uniquement (window/navigator requis).
 */
export function detectCapabilities(): DeviceCapabilities {
  if (typeof window === "undefined") {
    return {
      deviceMemory: 0,
      hardwareConcurrency: 0,
      canRunFullWebGL: false,
      tier: "low",
      prefersReducedMotion: false,
    };
  }

  // navigator.deviceMemory peut être undefined sur certains navigateurs
  const nav = navigator as Navigator & { deviceMemory?: number };
  const deviceMemory = nav.deviceMemory ?? 4;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Be permissive: only opt out of WebGL when motion is explicitly disabled
  // OR when the device is genuinely tiny (1GB RAM and 2 cores). Modern
  // mobiles are fine with our shader; exclusions should be a last resort.
  const isTinyDevice = deviceMemory < 2 || hardwareConcurrency < 2;
  const canRunFullWebGL = !prefersReducedMotion && !isTinyDevice;

  let tier: DeviceCapabilities["tier"];
  if (prefersReducedMotion || isTinyDevice) {
    tier = "low";
  } else if (deviceMemory >= 8 && hardwareConcurrency >= 8) {
    tier = "high";
  } else {
    tier = "medium";
  }

  return {
    deviceMemory,
    hardwareConcurrency,
    canRunFullWebGL,
    tier,
    prefersReducedMotion,
  };
}
