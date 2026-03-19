import type { PageDefinition } from "@beindigital-engine/cms"
import { seoBlock } from "@beindigital-engine/cms"

export const storefrontLayoutPage: PageDefinition = {
  slug: "storefront-layout",
  label: "Layout du storefront",
  description: "En-tête et pied de page communs à toutes les pages du storefront",
  groupId: "storefront",
  blocks: [
    seoBlock,
    {
      key: "header",
      label: "En-tête du site",
      fields: {
        brandName: {
          type: "text",
          label: "Nom de la marque",
          required: true,
          maxLength: 50,
          hasCodeFallback: true,
        },
        menuLabel: {
          type: "text",
          label: "Texte lien menu",
          maxLength: 30,
          hasCodeFallback: true,
        },
        cartLabel: {
          type: "text",
          label: "Texte lien panier",
          maxLength: 30,
          hasCodeFallback: true,
        },
        accountLabel: {
          type: "text",
          label: "Texte lien mon compte",
          maxLength: 30,
          hasCodeFallback: true,
        },
        signinLabel: {
          type: "text",
          label: "Texte lien connexion",
          maxLength: 30,
          hasCodeFallback: true,
        },
      },
    },
    {
      key: "footer",
      label: "Pied de page",
      fields: {
        poweredBy: {
          type: "text",
          label: "Texte Powered by",
          maxLength: 100,
          hasCodeFallback: true,
        },
        copyrightText: {
          type: "text",
          label: "Texte de copyright",
          maxLength: 200,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
