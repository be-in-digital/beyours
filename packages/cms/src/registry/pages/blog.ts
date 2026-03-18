import type { PageDefinition } from "../types"
import { seoBlock } from "../blocks/seoBlock"

export const blogPage: PageDefinition = {
  slug: "blog",
  label: "Blog",
  blocks: [
    seoBlock,
    {
      key: "hero",
      label: "Section hero",
      fields: {
        badge: {
          type: "text",
          label: "Badge en-tête",
          maxLength: 50,
          hasCodeFallback: true,
        },
        title: {
          type: "text",
          label: "Titre principal",
          maxLength: 120,
          hasCodeFallback: true,
        },
        subtitle: {
          type: "text",
          label: "Sous-titre",
          maxLength: 300,
          hasCodeFallback: true,
        },
      },
    },
    {
      key: "emptyState",
      label: "État vide",
      fields: {
        title: {
          type: "text",
          label: "Titre",
          maxLength: 120,
          hasCodeFallback: true,
        },
        subtitle: {
          type: "text",
          label: "Sous-titre",
          maxLength: 300,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
