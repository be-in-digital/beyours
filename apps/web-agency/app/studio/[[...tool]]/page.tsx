"use client";

/**
 * Studio Sanity embedded à /studio.
 * Catch-all dynamique nécessaire pour la routing interne du studio.
 *
 * Le composant doit être client-side : NextStudio utilise React.createContext
 * et l'API d'orchestration Sanity Studio qui n'est pas RSC-compatible.
 */
import { NextStudio } from "next-sanity/studio";

import config from "../../../sanity.config";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
