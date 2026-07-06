import { defineField, defineType } from "sanity";

export const contactPage = defineType({
  name: "contactPage",
  title: "Page Contact",
  type: "document",
  fields: [
    defineField({
      name: "hero",
      type: "object",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Contact" }),
        defineField({ name: "titleLine1", type: "string" }),
        defineField({ name: "titleLine2", type: "string", description: "Italique." }),
        defineField({ name: "intro", type: "text", rows: 4 }),
      ],
    }),
    defineField({
      name: "sidebar",
      type: "object",
      fields: [
        defineField({ name: "fastChannelsTitle", type: "string", initialValue: "Plus rapide" }),
        defineField({
          name: "channels",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "label", type: "string" }),
                defineField({ name: "value", type: "string" }),
                defineField({ name: "href", type: "string" }),
              ],
              preview: { select: { title: "label", subtitle: "value" } },
            },
          ],
        }),
        defineField({ name: "locationTitle", type: "string", initialValue: "Studio" }),
        defineField({ name: "locationValue", type: "string", initialValue: "Paris, France" }),
      ],
    }),
    defineField({
      name: "form",
      type: "object",
      fields: [
        defineField({ name: "title", type: "string", initialValue: "Parlons de votre projet" }),
        defineField({ name: "submitLabel", type: "string", initialValue: "Envoyer le message" }),
        defineField({ name: "successMessage", type: "string", initialValue: "Message envoyé. Réponse sous 24-48h." }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Page Contact" }) },
});
