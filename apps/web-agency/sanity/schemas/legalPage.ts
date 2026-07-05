import { defineField, defineType } from "sanity";

/**
 * legalPage — collection pour les pages mentions/confidentialité/cookies.
 * Le slug détermine la route : /mentions-legales, /confidentialite, /cookies.
 */
export const legalPage = defineType({
  name: "legalPage",
  title: "Page légale",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      description:
        "Doit correspondre à la route : 'mentions-legales', 'confidentialite' ou 'cookies'.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "eyebrow",
      type: "string",
      initialValue: "Légal",
    }),
    defineField({
      name: "intro",
      type: "text",
      rows: 4,
      description: "Paragraphe d'introduction sous le H1 (optionnel).",
    }),
    defineField({
      name: "lastUpdated",
      type: "string",
      description: "Texte affiché 'Dernière mise à jour : 27 avril 2026'.",
    }),
    defineField({
      name: "body",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "Paragraphe", value: "normal" },
            { title: "Titre H2", value: "h2" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Em", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
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
          lists: [{ title: "Bullet", value: "bullet" }],
        },
      ],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
  },
});
