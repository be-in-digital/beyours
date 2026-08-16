/**
 * Site config — beyours.fr
 *
 * Central home for the SEO metadata. SITE_URL is wired to a public env var
 * (NEXT_PUBLIC_SITE_URL) with a prod fallback, which makes switching between
 * prod / preview / dev straightforward.
 *
 * The site runs on its own domain `beyours.fr` (apex; www redirects with a
 * 308). The agency keeps `beindigital.fr` — hence STUDIO_URL and SITE_EMAIL
 * below, which still point at the agency apex.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://beyours.fr";

export const SITE_NAME = "BeYours";

export const SITE_DESCRIPTION =
  "Site web premium, commande en ligne directe, KDS en cuisine, fidélité : la plateforme tout-en-un pensée pour les restaurants. 0 % de commission sur vos ventes directes. Reprenez la main sur votre marge.";

/** Apex URL of the studio (for cross-linking from the restaurant site). */
export const STUDIO_URL = "https://beindigital.fr";

/** Contact email (on the apex domain — unchanged). */
export const SITE_EMAIL = "hello@beindigital.fr";
