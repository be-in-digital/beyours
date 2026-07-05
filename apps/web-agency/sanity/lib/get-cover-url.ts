import { urlFor } from "../image";
import type { SanityImage } from "../types";

/**
 * Helper qui construit une URL CDN Sanity pour une cover image, à un
 * sizing standard pour DeviceMockup (~1280×800).
 *
 * Perf : `quality(70)` au lieu du défaut 75 → ~15-20 % plus léger en
 * bytes pour une perte visuellement non détectable sur les captures
 * de produits dans un mockup laptop. `auto('format')` laisse Sanity
 * servir AVIF aux navigateurs qui supportent.
 */
export function getCoverUrl(image: SanityImage): string {
  return urlFor(image)
    .width(1280)
    .fit("max")
    .auto("format")
    .quality(70)
    .url();
}
