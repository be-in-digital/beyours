import type { DeviceCapabilities } from "./types";

/**
 * detectCapabilities — works out whether the device can handle the maximalist
 * WebGL, or whether we should serve a premium DOM fallback instead.
 *
 * Criteria (Decision Log #11 + multi-agent perf review):
 * - deviceMemory <= 2 GB or hardwareConcurrency <= 4 → tier "low" → DOM fallback
 * - prefers-reduced-motion → strict DOM fallback (the hero's SVG image)
 * - otherwise → tier "medium" or "high" depending on resources
 *
 * Must be called on the client only (window/navigator required).
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

  // navigator.deviceMemory can be undefined in some browsers
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
