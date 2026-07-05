/**
 * Seed du singleton `homePage` — reflète l'état actuel de app/(site)/page.tsx.
 * Run : pnpm tsx scripts/seed-home-page.ts (depuis apps/agency).
 */
import { createClient } from "@sanity/client";

import { loadEnv } from "./lib/env";

const env = loadEnv();

const client = createClient({
  projectId: env.projectId,
  dataset: env.dataset,
  apiVersion: "2025-04-27",
  token: env.token,
  useCdn: false,
});

let counter = 0;
const k = () => `k${(++counter).toString(36)}`;

const span = (text: string, marks: string[] = []) => ({
  _type: "span" as const,
  _key: k(),
  text,
  marks,
});

const block = (
  children: ReturnType<typeof span>[],
  markDefs: Array<{
    _type: string;
    _key: string;
    href?: string;
  }> = [],
) => ({
  _type: "block" as const,
  _key: k(),
  style: "normal",
  markDefs,
  children,
});

async function main() {
  // Reset counter for stable keys
  counter = 0;

  // Approach paragraphs (Portable Text with strong + link)
  const linkRestaurantKey = "linkRestaurant";
  const approachParagraphs = [
    block([
      span("On ne livre pas un site, on conçoit un produit", ["strong"]),
      span(" qui sert votre business. Chez Be in Digital, chaque décision design ou technique est prise en regard d’un objectif mesurable : croissance, conversion, marque, position de marché."),
    ]),
    block([
      span("On n’externalise rien.", ["strong"]),
      span(" Design produit, ingénierie web et mobile, stratégie digitale — toute l’équipe Be in Digital travaille sous le même toit, du brief à la mise en ligne. Vos interlocuteurs sont ceux qui dessinent et qui codent."),
    ]),
    block(
      [
        span("On construit aussi nos propres produits.", ["strong"]),
        span(" "),
        span("Be in Digital Restaurant", [linkRestaurantKey]),
        span(" en est la preuve. On sait ce que c’est de mettre un SaaS en ligne, de le faire grandir et de le vendre : vos enjeux, on les vit au quotidien."),
      ],
      [
        {
          _type: "link",
          _key: linkRestaurantKey,
          href: "https://restaurant.beindigital.fr",
        },
      ],
    ),
  ];

  const heroDescription = [
    block([
      span("Be in Digital conçoit et code des sites premium, applications SaaS et expériences sur mesure pour les "),
      span("startups Series A/B", ["strong"]),
      span(" et "),
      span("scale-ups", ["strong"]),
      span(" qui ne veulent pas d’un site générique."),
    ]),
  ];

  const doc = {
    _id: "homePage",
    _type: "homePage",
    hero: {
      eyebrow: "Be in Digital · Studio digital · Paris",
      titlePrefix: "On code les produits digitaux qui",
      titleGradient: "font passer un cap.",
      description: heroDescription,
      ctaPrimaryLabel: "Démarrer un projet",
      ctaPrimaryHref: "/contact",
      ctaSecondaryLabel: "Découvrir notre approche",
      ctaSecondaryHref: "/about",
    },
    manifesto: {
      eyebrow: "Manifeste",
      line1: "Du design qui",
      line1Accent: "pense",
      line2: "Du code qui",
      line2Accent: "dure",
      line3: "Du business qui",
      line3Accent: "scale",
      paragraph:
        "Trois mots, une exigence : chaque pixel et chaque ligne de code servent un objectif business. Sinon ils n’existent pas.",
    },
    approach: {
      eyebrow: "Notre approche",
      title: "Be in Digital,",
      titleAccent: "pas une agence comme les autres.",
      paragraphs: approachParagraphs,
    },
    process: {
      eyebrow: "Notre process",
      titleLine1: "Quatre étapes,",
      titleLine2: "une seule responsabilité.",
      steps: [
        {
          _key: "s1",
          num: "01",
          tag: "Stratégie",
          title: "Comprendre l’enjeu",
          body: "Workshop initial, audit existant, identification du levier business. On cadre l’ambition avant de cadrer le projet.",
        },
        {
          _key: "s2",
          num: "02",
          tag: "Design",
          title: "Direction & système",
          body: "Direction artistique, UX research, design système, prototypes interactifs validés sur device réel — pas de Figma sans contexte.",
        },
        {
          _key: "s3",
          num: "03",
          tag: "Build",
          title: "Code & intégrations",
          body: "Next.js, React, Convex, WebGL, intégrations payment & data. Code typé, testé, performant, accessible — un produit, pas un livrable.",
        },
        {
          _key: "s4",
          num: "04",
          tag: "Scale",
          title: "Performance & suivi",
          body: "Mise en ligne, monitoring, SEO technique, itérations post-launch. On reste impliqué : un produit qui ne grandit pas est une dépense.",
        },
      ],
    },
    selectedWork: {
      eyebrow: "Selected work",
      titleLine1: "Ce qu’on a livré",
      titleLine2: "récemment.",
      viewAllLabel: "Voir toutes les études →",
      viewAllHref: "/work",
    },
    numbers: {
      eyebrow: "Trajectoire",
      titleLine1: "Les chiffres,",
      titleLine2: "simplement.",
      stats: [
        { _key: "st1", value: 12, suffix: "+", label: "Projets livrés", caption: "Sites, SaaS, marketplaces, plateformes." },
        { _key: "st2", value: 6, prefix: "0", label: "Industries", caption: "Restauration, mode, lifestyle, services, B2B, marketplace." },
        { _key: "st3", value: 99, label: "Score Lighthouse", caption: "Médiane des projets livrés en 2025-2026." },
        { _key: "st4", value: 2026, label: "Fondé en", caption: "Studio indépendant, 100% in-house, basé à Paris." },
      ],
    },
    products: {
      eyebrow: "Nos produits",
      titleLine1: "On code aussi",
      titleLine2: "pour nous.",
      intro:
        "Trois SaaS qu’on a conçus, codés et lancés à notre nom. La meilleure preuve qu’on sait passer du brief au produit en prod.",
    },
    cta: {
      eyebrow: "On en parle ?",
      titleLine1: "Vous avez une idée.",
      titleLine2: "On a une équipe.",
      paragraph:
        "Quinze minutes de discussion avec l’équipe Be in Digital. Un avis honnête sur la faisabilité, et une proposition s’il y a lieu. Aucun engagement.",
      buttonLabel: "Démarrer un projet",
      buttonHref: "/contact",
      fallbackLine: "ou écrivez-nous · hello@beindigital.fr",
    },
  };

  const res = await client.createOrReplace(doc);
  console.log(`✓ homePage → ${res._id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
