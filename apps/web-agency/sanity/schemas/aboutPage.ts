import { defineField, defineType } from "sanity";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "Page À propos",
  type: "document",
  groups: [
    { name: "hero", title: "Hero" },
    { name: "manifesto", title: "Manifeste" },
    { name: "work", title: "Travaux récents" },
    { name: "team", title: "Équipe" },
    { name: "cta", title: "CTA" },
  ],
  fields: [
    defineField({
      name: "hero",
      type: "object",
      group: "hero",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "À propos" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({ name: "intro", type: "text", rows: 4 }),
        defineField({
          name: "coverCaseStudySlug",
          type: "string",
          description:
            "Slug d'un caseStudy à utiliser comme cover laptop dans le hero (default : be-in-digital-restaurant).",
        }),
      ],
    }),
    defineField({
      name: "manifesto",
      type: "object",
      group: "manifesto",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Manifeste" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({
          name: "paragraphs",
          type: "array",
          of: [
            {
              type: "block",
              styles: [{ title: "Normal", value: "normal" }],
              marks: {
                decorators: [{ title: "Strong", value: "strong" }],
                annotations: [
                  {
                    name: "link",
                    type: "object",
                    fields: [defineField({ name: "href", type: "url" })],
                  },
                ],
              },
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "recentWork",
      type: "object",
      group: "work",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Travaux récents" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({ name: "viewAllLabel", type: "string", initialValue: "Voir toutes les études →" }),
        defineField({ name: "viewAllHref", type: "string", initialValue: "/work" }),
      ],
    }),
    defineField({
      name: "team",
      type: "object",
      group: "team",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "L'équipe" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({
          name: "members",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "role", type: "string" }),
                defineField({ name: "title", type: "string" }),
                defineField({ name: "body", type: "text", rows: 3 }),
              ],
              preview: { select: { title: "title", subtitle: "role" } },
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "cta",
      type: "object",
      group: "cta",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "On en parle ?" }),
        defineField({ name: "title", type: "string" }),
        defineField({ name: "paragraph", type: "text", rows: 3 }),
        defineField({ name: "buttonLabel", type: "string", initialValue: "Démarrer un projet" }),
        defineField({ name: "buttonHref", type: "string", initialValue: "/contact" }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Page À propos" }) },
});
