import { defineField, defineType } from "sanity";

/**
 * homePage — singleton qui pilote toutes les sections de la home.
 * Chaque section a son propre objet pour permettre un édit ciblé dans
 * le studio.
 */
export const homePage = defineType({
  name: "homePage",
  title: "Page d'accueil",
  type: "document",
  groups: [
    { name: "hero", title: "Hero" },
    { name: "manifesto", title: "Manifeste" },
    { name: "approach", title: "Approche" },
    { name: "process", title: "Process" },
    { name: "work", title: "Selected work" },
    { name: "numbers", title: "Chiffres" },
    { name: "products", title: "Produits" },
    { name: "cta", title: "CTA final" },
  ],
  fields: [
    defineField({
      name: "hero",
      type: "object",
      group: "hero",
      fields: [
        defineField({
          name: "eyebrow",
          type: "string",
          initialValue: "Be in Digital · Studio digital · Paris",
        }),
        defineField({
          name: "titlePrefix",
          title: "Titre — préfixe (sans accent visuel)",
          type: "string",
          initialValue: "On code les produits digitaux qui",
        }),
        defineField({
          name: "titleGradient",
          title: "Titre — segment final (italique + gradient mint)",
          type: "string",
          initialValue: "font passer un cap.",
        }),
        defineField({
          name: "description",
          type: "array",
          of: [{ type: "block", styles: [{ title: "Normal", value: "normal" }], lists: [], marks: { decorators: [{ title: "Strong", value: "strong" }] } }],
        }),
        defineField({ name: "ctaPrimaryLabel", type: "string", initialValue: "Démarrer un projet" }),
        defineField({ name: "ctaPrimaryHref", type: "string", initialValue: "/contact" }),
        defineField({ name: "ctaSecondaryLabel", type: "string", initialValue: "Découvrir notre approche" }),
        defineField({ name: "ctaSecondaryHref", type: "string", initialValue: "/about" }),
      ],
    }),
    defineField({
      name: "manifesto",
      type: "object",
      group: "manifesto",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Manifeste" }),
        defineField({ name: "line1", type: "string", initialValue: "Du design qui" }),
        defineField({ name: "line1Accent", type: "string", initialValue: "pense" }),
        defineField({ name: "line2", type: "string", initialValue: "Du code qui" }),
        defineField({ name: "line2Accent", type: "string", initialValue: "dure" }),
        defineField({ name: "line3", type: "string", initialValue: "Du business qui" }),
        defineField({ name: "line3Accent", type: "string", initialValue: "scale" }),
        defineField({ name: "paragraph", type: "text", rows: 3 }),
      ],
    }),
    defineField({
      name: "approach",
      type: "object",
      group: "approach",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Notre approche" }),
        defineField({ name: "title", type: "string", initialValue: "Be in Digital," }),
        defineField({ name: "titleAccent", type: "string", initialValue: "pas une agence comme les autres." }),
        defineField({
          name: "paragraphs",
          type: "array",
          of: [{ type: "block", styles: [{ title: "Normal", value: "normal" }], marks: { decorators: [{ title: "Strong", value: "strong" }], annotations: [{ name: "link", type: "object", fields: [defineField({ name: "href", type: "url" })] }] } }],
        }),
      ],
    }),
    defineField({
      name: "process",
      type: "object",
      group: "process",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Notre process" }),
        defineField({ name: "titleLine1", type: "string", initialValue: "Quatre étapes," }),
        defineField({ name: "titleLine2", type: "string", initialValue: "une seule responsabilité." }),
        defineField({
          name: "steps",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "num", type: "string" }),
                defineField({ name: "tag", type: "string" }),
                defineField({ name: "title", type: "string" }),
                defineField({ name: "body", type: "text", rows: 3 }),
              ],
              preview: { select: { title: "title", subtitle: "tag" } },
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "selectedWork",
      type: "object",
      group: "work",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Selected work" }),
        defineField({ name: "titleLine1", type: "string", initialValue: "Ce qu’on a livré" }),
        defineField({ name: "titleLine2", type: "string", initialValue: "récemment." }),
        defineField({ name: "viewAllLabel", type: "string", initialValue: "Voir toutes les études →" }),
        defineField({ name: "viewAllHref", type: "string", initialValue: "/work" }),
      ],
    }),
    defineField({
      name: "numbers",
      type: "object",
      group: "numbers",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Trajectoire" }),
        defineField({ name: "titleLine1", type: "string", initialValue: "Les chiffres," }),
        defineField({ name: "titleLine2", type: "string", initialValue: "simplement." }),
        defineField({
          name: "stats",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                defineField({ name: "value", type: "number" }),
                defineField({ name: "prefix", type: "string" }),
                defineField({ name: "suffix", type: "string" }),
                defineField({ name: "label", type: "string" }),
                defineField({ name: "caption", type: "string" }),
              ],
              preview: { select: { title: "label", subtitle: "value" } },
            },
          ],
        }),
      ],
    }),
    defineField({
      name: "products",
      type: "object",
      group: "products",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "Nos produits" }),
        defineField({ name: "titleLine1", type: "string", initialValue: "On code aussi" }),
        defineField({ name: "titleLine2", type: "string", initialValue: "pour nous." }),
        defineField({ name: "intro", type: "text", rows: 2 }),
      ],
    }),
    defineField({
      name: "cta",
      type: "object",
      group: "cta",
      fields: [
        defineField({ name: "eyebrow", type: "string", initialValue: "On en parle ?" }),
        defineField({ name: "titleLine1", type: "string", initialValue: "Vous avez une idée." }),
        defineField({ name: "titleLine2", type: "string", initialValue: "On a une équipe." }),
        defineField({ name: "paragraph", type: "text", rows: 3 }),
        defineField({ name: "buttonLabel", type: "string", initialValue: "Démarrer un projet" }),
        defineField({ name: "buttonHref", type: "string", initialValue: "/contact" }),
        defineField({ name: "fallbackLine", type: "string", initialValue: "ou écrivez-nous · hello@beindigital.fr" }),
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Page d'accueil" }),
  },
});
