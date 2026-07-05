import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { apiVersion, dataset, projectId, studioUrl } from "./sanity/env";
import { schemaTypes } from "./sanity/schemas";
import { structure } from "./sanity/structure";

/**
 * Studio config — embedded à `/studio` dans l'app Next.js.
 *
 * `singletonActions` retire les actions duplicate / delete sur les
 * singletons (siteSettings, homePage) pour éviter des erreurs.
 */
const SINGLETONS = [
  "siteSettings",
  "homePage",
  "aboutPage",
  "productsPage",
  "contactPage",
];
const SINGLETON_ACTIONS = new Set([
  "publish",
  "discardChanges",
  "restore",
]);

export default defineConfig({
  basePath: studioUrl,
  projectId,
  dataset,
  title: "Be in Digital — Studio",
  schema: {
    types: schemaTypes,
  },
  plugins: [
    structureTool({ structure }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  document: {
    actions: (input, context) =>
      SINGLETONS.includes(context.schemaType)
        ? input.filter(({ action }) => action && SINGLETON_ACTIONS.has(action))
        : input,
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((item) => !SINGLETONS.includes(item.templateId))
        : prev,
  },
});
