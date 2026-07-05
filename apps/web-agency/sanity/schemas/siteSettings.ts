import { defineField, defineType } from "sanity";

/**
 * siteSettings — singleton qui pilote la navbar, le footer et les
 * métadonnées globales. Un seul document de ce type, géré via la
 * structure builder (cf. sanity/structure.ts).
 */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Réglages globaux",
  type: "document",
  groups: [
    { name: "nav", title: "Navigation" },
    { name: "footer", title: "Pied de page" },
  ],
  fields: [
    defineField({
      name: "navItems",
      title: "Liens de navigation principale",
      type: "array",
      group: "nav",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "href",
              type: "string",
              description: "Chemin interne (ex. /work) ou URL absolue.",
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "href" },
          },
        },
      ],
      validation: (r) => r.min(1),
    }),
    defineField({
      name: "ctaLabel",
      title: "Texte du bouton CTA navbar",
      type: "string",
      group: "nav",
      initialValue: "Démarrer un projet",
    }),
    defineField({
      name: "ctaHref",
      title: "Lien du bouton CTA navbar",
      type: "string",
      group: "nav",
      initialValue: "/contact",
    }),
    defineField({
      name: "footer",
      title: "Pied de page",
      type: "object",
      group: "footer",
      fields: [
        defineField({
          name: "wordmarkText",
          title: "Wordmark XL",
          type: "string",
          initialValue: "Be in Digital",
        }),
        defineField({
          name: "columns",
          title: "Colonnes de liens",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "title", type: "string" }),
                defineField({
                  name: "links",
                  type: "array",
                  of: [
                    {
                      type: "object",
                      fields: [
                        defineField({ name: "label", type: "string" }),
                        defineField({ name: "href", type: "string" }),
                      ],
                      preview: {
                        select: { title: "label", subtitle: "href" },
                      },
                    },
                  ],
                }),
              ],
              preview: { select: { title: "title" } },
            },
          ],
        }),
        defineField({
          name: "copyright",
          title: "Copyright",
          type: "string",
          description:
            "L'année est ajoutée automatiquement. Ex : 'Be in Digital · Paris'.",
          initialValue: "Be in Digital · Paris",
        }),
        defineField({
          name: "signature",
          title: "Signature ligne basse",
          type: "string",
          initialValue: "Crafted in France · 100% in-house",
        }),
        defineField({
          name: "contactEmail",
          title: "Email de contact",
          type: "string",
          initialValue: "hello@beindigital.fr",
        }),
        defineField({
          name: "location",
          title: "Ville",
          type: "string",
          initialValue: "Paris",
        }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Réglages globaux" }),
  },
});
