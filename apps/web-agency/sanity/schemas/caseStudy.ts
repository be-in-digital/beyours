import { defineField, defineType } from "sanity";

/**
 * caseStudy — collection qui regroupe les 8 études de cas + les produits
 * studio (Jokko, Wedilly Bird) repérés via `isStudioVenture`.
 */
export const caseStudy = defineType({
  name: "caseStudy",
  title: "Étude de cas",
  type: "document",
  groups: [
    { name: "intro", title: "Présentation" },
    { name: "media", title: "Visuels" },
    { name: "meta", title: "Métadonnées" },
    { name: "body", title: "Contenu" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      group: "intro",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (URL)",
      type: "slug",
      group: "intro",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "client",
      title: "Client",
      type: "string",
      group: "intro",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "category",
      title: "Catégorie",
      type: "string",
      group: "intro",
      description: "Ex. 'SaaS · Restauration', 'B2B · Distribution alimentaire'.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "year",
      title: "Année",
      type: "string",
      group: "intro",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "blurb",
      title: "Pitch court (4-5 lignes)",
      type: "text",
      group: "intro",
      rows: 5,
      validation: (r) => r.required().max(500),
    }),
    defineField({
      name: "cover",
      title: "Capture cover",
      type: "image",
      group: "media",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Texte alternatif",
          type: "string",
        }),
      ],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "liveUrl",
      title: "URL du site live",
      type: "url",
      group: "meta",
    }),
    defineField({
      name: "services",
      title: "Services rendus",
      type: "array",
      group: "meta",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "size",
      title: "Taille de la card sur /work",
      type: "string",
      group: "meta",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
        ],
        layout: "radio",
      },
      initialValue: "md",
    }),
    defineField({
      name: "order",
      title: "Ordre d'affichage",
      type: "number",
      group: "meta",
      description: "Plus petit = affiché en premier. 1, 2, 3, ...",
      validation: (r) => r.required().integer().min(1),
    }),
    defineField({
      name: "isStudioVenture",
      title: "Produit interne du studio ?",
      type: "boolean",
      group: "meta",
      description:
        "Si activé, l'étude apparaît aussi sur /products dans la section 'Studio ventures'.",
      initialValue: false,
    }),
    defineField({
      name: "studioStatus",
      title: "Pill de statut (si Studio venture)",
      type: "string",
      group: "meta",
      description:
        "Ex. 'Live · 2026', 'Beta · 2025'. Affiché en pill mint sur la card produit.",
      hidden: ({ document }) => !document?.isStudioVenture,
    }),
    defineField({
      name: "body",
      title: "Contenu narratif (Portable Text)",
      type: "array",
      group: "body",
      of: [
        {
          type: "block",
          styles: [
            { title: "Paragraphe", value: "normal" },
            { title: "Titre H2", value: "h2" },
            { title: "Titre H3", value: "h3" },
            { title: "Citation", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Gras", value: "strong" },
              { title: "Italique", value: "em" },
              { title: "Code", value: "code" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Lien",
                fields: [
                  defineField({
                    name: "href",
                    type: "url",
                    validation: (r) =>
                      r.uri({ scheme: ["http", "https", "mailto", "tel"] }),
                  }),
                ],
              },
            ],
          },
          lists: [
            { title: "Bullet", value: "bullet" },
            { title: "Numbered", value: "number" },
          ],
        },
      ],
    }),
  ],
  orderings: [
    {
      title: "Ordre d'affichage",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "category",
      media: "cover",
    },
  },
});
