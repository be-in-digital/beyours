/**
 * Charge les variables d'environnement depuis .env.local pour les scripts
 * Node (qui ne sont pas pris en charge par Next.js).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

export function loadEnv(): { projectId: string; dataset: string; token: string } {
  // dotenv côté script — Next.js charge déjà .env.local en dev/prod
  // mais ce script tourne hors du runtime Next.
  loadDotenv({ path: path.resolve(__dirname, "../../.env.local") });

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_TOKEN;

  if (!projectId || !dataset || !token) {
    throw new Error(
      "Variables manquantes : NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN. Vérifie apps/agency/.env.local.",
    );
  }

  return { projectId, dataset, token };
}

// Async file read kept here in case future scripts need to inspect env presence.
export async function envLocalExists(): Promise<boolean> {
  try {
    await fs.access(path.resolve(__dirname, "../../.env.local"));
    return true;
  } catch {
    return false;
  }
}
