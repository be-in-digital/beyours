/**
 * Site config — beyours.fr
 *
 * Central home for the SEO metadata. SITE_URL is wired to a public env var
 * (NEXT_PUBLIC_SITE_URL) with a prod fallback, which makes switching between
 * prod / preview / dev straightforward.
 *
 * The site runs on its own domain `beyours.fr` (apex; www redirects with a
 * 308). Everything the product shows — addresses, social accounts, preview
 * subdomains — is on that domain. Nothing here points at `beindigital.fr`
 * any more.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://beyours.fr";

export const SITE_NAME = "BeYours";

export const SITE_DESCRIPTION =
  "Site web premium, commande en ligne directe, KDS en cuisine, fidélité : la plateforme tout-en-un pensée pour les restaurants. 0 % de commission sur vos ventes directes. Reprenez la main sur votre marge.";

/** Apex URL of the studio (for cross-linking from the restaurant site). */
export const STUDIO_URL = "https://beyours.fr";

/**
 * The single contact address for the whole product. Import it rather than
 * writing an address inline: hardcoded copies are how the site ended up
 * showing two domains at once.
 */
export const SITE_EMAIL = "hello@be-yours.fr";

/**
 * The brand's social accounts. Centralised because the footer, the contact
 * page and the JSON-LD `sameAs` all read the same four URLs — three separate
 * copies is what let a domain rename go half-finished the first time.
 */
export const SOCIAL_LINKS = {
  instagram: "https://instagram.com/beyours.fr",
  tiktok: "https://tiktok.com/@be-yours.fr",
  x: "https://x.com/beyours_fr",
  linkedin: "https://linkedin.com/company/beyours-fr",
} as const;

/**
 * WhatsApp deep link behind the navbar's "Une question ?" — the low-commitment
 * way out, next to the high-commitment "Réserver un appel". The prefilled
 * `text` opens the thread with the question already framed, so nobody has to
 * write the first message.
 */
export const SITE_WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=33768715445&text=Bonjour%2C+j%27ai+une+question+sur+Beyours&type=phone_number&app_absent=0";

/**
 * Origin of the self-hosted Cal.com instance behind the booking modal.
 *
 * It lives here rather than in `components/booking-modal.tsx` because two
 * places have to agree on it: the embed loads its script and iframe from this
 * origin, and the Content-Security-Policy in `next.config.ts` has to allow that
 * same origin. Written twice, a move of the Cal instance would update one of
 * them and break booking with a CSP violation.
 */
export const BOOKING_ORIGIN = "https://bookself.app";
