import type { PageDefinition } from "../types"
import { seoBlock } from "../blocks/seoBlock"

export const homepagePage: PageDefinition = {
  slug: "homepage",
  label: "Page d'accueil",
  blocks: [
    seoBlock,
    {
      key: "hero",
      label: "Section hero",
      fields: {
        title: {
          type: "text",
          label: "Titre principal",
          required: true,
          maxLength: 120,
          hasCodeFallback: true,
        },
        subtitle: {
          type: "richtext",
          label: "Sous-titre",
          maxLength: 300,
          hasCodeFallback: true,
        },
        image: {
          type: "image",
          label: "Image de fond",
          translatable: false,
          hasCodeFallback: true,
        },
      },
    },
    {
      key: "cta",
      label: "Boutons d'action",
      fields: {
        menuButtonLabel: {
          type: "text",
          label: "Texte bouton menu",
          maxLength: 50,
          hasCodeFallback: true,
        },
        signinButtonLabel: {
          type: "text",
          label: "Texte bouton connexion",
          maxLength: 50,
          hasCodeFallback: true,
        },
        dashboardButtonLabel: {
          type: "text",
          label: "Texte bouton dashboard",
          maxLength: 50,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
