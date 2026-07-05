import { defineField, defineType } from "sanity";

export const productsPage = defineType({
  name: "productsPage",
  title: "Page Produits",
  type: "document",
  groups: [
    { name: "hero", title: "Hero" },
    { name: "ventures", title: "Studio ventures" },
    { name: "roadmap", title: "Roadmap" },
    { name: "cta", title: "CTA" },
  ],
  fields: [
    defineField({
      name: "hero",
      type: "object",
      group: "hero",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Nos produits" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({ name: "intro", type: "text", rows: 4 }),
      ],
    }),
    defineField({
      name: "ventures",
      type: "object",
      group: "ventures",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Studio ventures" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
      ],
    }),
    defineField({
      name: "roadmap",
      type: "object",
      group: "roadmap",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Roadmap" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({
          name: "items",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "status", type: "string", description: "Ex. 'In development', 'Concept'." }),
                defineField({ name: "eta", type: "string", description: "Ex. '2026', '2027'." }),
                defineField({ name: "category", type: "string" }),
                defineField({ name: "title", type: "string" }),
                defineField({ name: "body", type: "text", rows: 3 }),
              ],
              preview: { select: { title: "title", subtitle: "status" } },
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
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({ name: "buttonLabel", type: "string", initialValue: "Démarrer un projet" }),
        defineField({ name: "buttonHref", type: "string", initialValue: "/contact" }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Page Produits" }) },
});
