import type { BlockDefinition } from "../types"

/**
 * Shared SEO block definition.
 * Added to indexable pages: homepage, menu, category-menu, product-detail, storefront-layout.
 */
export const seoBlock: BlockDefinition = {
  key: "seo",
  label: "SEO",
  description: "Meta tags pour le référencement (titre, description, image OG, directives robots)",
  fields: {
    metaTitle: {
      type: "text",
      label: "Meta title",
      description: "Titre affiché dans les résultats Google (max 70 caractères)",
      translatable: true,
      maxLength: 70,
      hasCodeFallback: true,
    },
    metaDescription: {
      type: "text",
      label: "Meta description",
      description: "Description affichée dans les résultats Google (max 160 caractères)",
      translatable: true,
      maxLength: 160,
      hasCodeFallback: true,
    },
    ogImage: {
      type: "image",
      label: "Image Open Graph",
      description: "Image affichée lors du partage sur les réseaux sociaux",
      translatable: false,
      hasCodeFallback: true,
    },
    robots: {
      type: "select",
      label: "Directives robots",
      description: "Contrôle l'indexation par les moteurs de recherche",
      translatable: false,
      hasCodeFallback: true,
      options: [
        { value: "index, follow", label: "Index, Follow (par défaut)" },
        { value: "noindex, follow", label: "Noindex, Follow" },
        { value: "index, nofollow", label: "Index, Nofollow" },
        { value: "noindex, nofollow", label: "Noindex, Nofollow" },
      ],
    },
  },
}
