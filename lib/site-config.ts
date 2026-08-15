/**
 * Site config — beyours.fr
 *
 * Centralisation des métadonnées SEO. Le SITE_URL est branché sur une
 * variable d'env publique (NEXT_PUBLIC_SITE_URL) avec un fallback prod.
 * Permet de switcher facilement entre prod / preview / dev.
 *
 * Le site tourne sur son domaine propre `beyours.fr` (apex ; le www
 * redirige en 308). L'agence conserve `beindigital.fr` — d'où STUDIO_URL
 * et SITE_EMAIL plus bas, qui pointent toujours vers l'apex agence.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://beyours.fr";

export const SITE_NAME = "BeYours";

export const SITE_DESCRIPTION =
  "Site web premium, commande en ligne directe, KDS en cuisine, fidélité : la plateforme tout-en-un pensée pour les restaurants. 0 % de commission sur vos ventes directes. Reprenez la main sur votre marge.";

/** URL apex du studio (pour cross-linking depuis le resto). */
export const STUDIO_URL = "https://beindigital.fr";

/** Email de contact (sur le domaine apex — inchangé). */
export const SITE_EMAIL = "hello@beindigital.fr";
