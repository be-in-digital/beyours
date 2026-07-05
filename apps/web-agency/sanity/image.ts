import createImageUrlBuilder, { type SanityImageSource } from "@sanity/image-url";

import { dataset, projectId } from "./env";

const builder = createImageUrlBuilder({ projectId, dataset });

/**
 * Construit une URL Sanity à partir d'une référence d'image. Chaîne les
 * transformations classiques côté composant (width, fit, auto, etc.).
 *
 *   urlFor(image).width(1280).fit('max').auto('format').url()
 */
export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
