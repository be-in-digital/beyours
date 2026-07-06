/**
 * Sanity env helpers — strict, échouent à l'import si une var est manquante.
 *
 * Convention : les variables `NEXT_PUBLIC_*` sont safe à exposer côté client
 * (elles servent au studio + au client de lecture). Le token API serveur
 * est strictement côté Node (script de seed, mutations server-side).
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Ajoutez-la dans .env.local et dans les env vars Vercel.`,
    );
  }
  return value;
}

export const projectId = required(
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
);

export const dataset = required(
  "NEXT_PUBLIC_SANITY_DATASET",
  process.env.NEXT_PUBLIC_SANITY_DATASET,
);

/** Version de l'API Sanity. À bumper si on utilise des features récentes. */
export const apiVersion = "2025-04-27";

/** Token serveur — UNIQUEMENT côté Node (scripts, server actions). */
export const apiToken = process.env.SANITY_API_TOKEN ?? "";

/**
 * Tag de revalidation utilisé par les pages publiques. Ajoute `cache: 'force-cache'`
 * + `next: { tags: [...] }` pour ISR contrôlée par le webhook revalidate.
 */
export const studioUrl = "/studio";
