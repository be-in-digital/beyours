/**
 * Site config — restaurant.beindigital.fr
 *
 * Centralisation des métadonnées SEO. Le SITE_URL est branché sur une
 * variable d'env publique (NEXT_PUBLIC_SITE_URL) avec un fallback prod.
 * Permet de switcher facilement entre prod / preview / dev.
 *
 * Phase 0.5 (Decision Log #20) : le restaurant migre vers le sous-domaine
 * restaurant.beindigital.fr ; l'agence prend l'apex beindigital.fr.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://restaurant.beindigital.fr";

export const SITE_NAME = "Be in Digital";

export const SITE_DESCRIPTION =
  "Site web premium, commande en ligne directe, KDS en cuisine, intégrations Uber Eats & Deliveroo, fidélité : la plateforme tout-en-un pensée pour les restaurants. Reprenez la main sur votre marge.";

/** URL apex du studio (pour cross-linking depuis le resto). */
export const STUDIO_URL = "https://beindigital.fr";

/** Email de contact (sur le domaine apex — inchangé). */
export const SITE_EMAIL = "hello@beindigital.fr";
