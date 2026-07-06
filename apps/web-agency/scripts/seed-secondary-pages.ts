/**
 * Seed des singletons aboutPage / productsPage / contactPage et de la
 * collection legalPage (mentions, confidentialité, cookies). Reflète
 * l'état actuel du code TSX.
 *
 * Run : pnpm tsx scripts/seed-secondary-pages.ts (depuis apps/agency).
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
  style: "normal" | "h2" | "h3" = "normal",
  markDefs: Array<{ _type: string; _key: string; href?: string }> = [],
) => ({
  _type: "block" as const,
  _key: k(),
  style,
  markDefs,
  children,
});

const listItem = (
  children: ReturnType<typeof span>[],
  markDefs: Array<{ _type: string; _key: string; href?: string }> = [],
) => ({
  _type: "block" as const,
  _key: k(),
  style: "normal",
  listItem: "bullet" as const,
  level: 1,
  markDefs,
  children,
});

async function seedAbout() {
  const doc = {
    _id: "aboutPage",
    _type: "aboutPage",
    hero: {
      eyebrow: "À propos",
      titleLine1: "On code des produits",
      titleLine2: "qu'on aimerait utiliser.",
      intro:
        "Be in Digital est un studio digital indépendant basé à Paris. On accompagne les startups Series A/B et les scale-ups qui veulent un produit qui ne ressemble à aucun autre — du brief stratégique à la mise en ligne, sans rien externaliser.",
      coverCaseStudySlug: "be-in-digital-restaurant",
    },
    manifesto: {
      eyebrow: "Manifeste",
      titleLine1: "Du design qui pense, du code qui dure,",
      titleLine2: "du business qui scale.",
      paragraphs: [
        block([
          span("On ne livre pas un site, on conçoit un produit.", ["strong"]),
          span(
            " Chaque pixel et chaque ligne de code servent un objectif business mesurable : croissance, conversion, marque, position de marché. Sinon ils n'existent pas.",
          ),
        ]),
        block([
          span("On choisit nos projets.", ["strong"]),
          span(
            " On préfère livrer trois projets ambitieux par an plutôt que dix briefs templates. C'est ce qui nous permet de garder une qualité constante et de rester profondément investis dans chaque produit.",
          ),
        ]),
        block([
          span("On reste impliqués après le launch.", ["strong"]),
          span(
            " Un produit qui ne grandit pas, c'est une dépense, pas un investissement. On accompagne nos clients dans la durée — perf, SEO, itérations, monitoring.",
          ),
        ]),
      ],
    },
    recentWork: {
      eyebrow: "Travaux récents",
      titleLine1: "Ce qu'on a livré,",
      titleLine2: "pour de vrais clients.",
      viewAllLabel: "Voir toutes les études →",
      viewAllHref: "/work",
    },
    team: {
      eyebrow: "L'équipe",
      titleLine1: "Une équipe,",
      titleLine2: "une seule responsabilité.",
      members: [
        {
          _key: "m1",
          role: "Direction & Stratégie",
          title: "Comprendre l'enjeu business",
          body: "Cadrage produit, identification du levier, priorisation. Avant de cadrer un projet, on cadre l'ambition.",
        },
        {
          _key: "m2",
          role: "Design produit",
          title: "Direction artistique & système",
          body: "Direction artistique, UX research, design système, prototypes interactifs validés sur device réel.",
        },
        {
          _key: "m3",
          role: "Ingénierie",
          title: "Code propre & performant",
          body: "Next.js, React, Convex, WebGL, intégrations payment & data. Code typé, testé, accessible, durable.",
        },
      ],
    },
    cta: {
      eyebrow: "On en parle ?",
      title: "Prêt à passer un cap ?",
      paragraph:
        "Un échange de quinze minutes, un avis honnête, une proposition s'il y a lieu.",
      buttonLabel: "Démarrer un projet",
      buttonHref: "/contact",
    },
  };

  const res = await client.createOrReplace(doc);
  console.log(`✓ aboutPage → ${res._id}`);
}

async function seedProducts() {
  const doc = {
    _id: "productsPage",
    _type: "productsPage",
    hero: {
      eyebrow: "Nos produits",
      titleLine1: "On code aussi",
      titleLine2: "pour nous.",
      intro:
        "Trois SaaS qu'on a conçus, codés et lancés à notre nom. La meilleure preuve qu'on sait passer du brief au produit en prod — et qu'on vit chaque jour les enjeux qu'on adresse pour nos clients.",
    },
    ventures: {
      eyebrow: "Studio ventures",
      titleLine1: "Deux autres produits,",
      titleLine2: "déjà en prod.",
    },
    roadmap: {
      eyebrow: "Roadmap",
      titleLine1: "Ce qui arrive",
      titleLine2: "prochainement.",
      items: [
        {
          _key: "r1",
          status: "In development",
          eta: "2026",
          category: "B2B · Onboarding",
          title: "Produit n°4",
          body: "Un outil pour fluidifier l'onboarding de nouvelles équipes — design en cours, prototype interne en test.",
        },
        {
          _key: "r2",
          status: "Concept",
          eta: "2027",
          category: "Creative tools",
          title: "Produit n°5",
          body: "Un produit créatif qu'on garde sous le coude pour l'instant. Annonce prévue avec le bon partenaire.",
        },
      ],
    },
    cta: {
      eyebrow: "On en parle ?",
      titleLine1: "Un produit en tête ?",
      titleLine2: "On le code avec vous.",
      buttonLabel: "Démarrer un projet",
      buttonHref: "/contact",
    },
  };

  const res = await client.createOrReplace(doc);
  console.log(`✓ productsPage → ${res._id}`);
}

async function seedContact() {
  const doc = {
    _id: "contactPage",
    _type: "contactPage",
    hero: {
      eyebrow: "Contact",
      titleLine1: "Parlons de",
      titleLine2: "votre projet.",
      intro:
        "Quinze minutes pour qu'on comprenne votre besoin. Vingt-quatre à quarante-huit heures pour vous répondre. On revient toujours, même quand le projet n'est pas pour nous.",
    },
    sidebar: {
      fastChannelsTitle: "Plus rapide",
      channels: [
        {
          _key: "ch1",
          label: "Email",
          value: "hello@beindigital.fr",
          href: "mailto:hello@beindigital.fr",
        },
        {
          _key: "ch2",
          label: "LinkedIn",
          value: "@beindigital-fr",
          href: "https://www.linkedin.com/company/beindigital-fr",
        },
      ],
      locationTitle: "Studio",
      locationValue: "Paris, France",
    },
    form: {
      title: "Parlons de votre projet",
      submitLabel: "Envoyer le message",
      successMessage: "Message envoyé. Réponse sous 24-48h.",
    },
  };

  const res = await client.createOrReplace(doc);
  console.log(`✓ contactPage → ${res._id}`);
}

async function seedLegal() {
  // Mentions légales
  const mentions = {
    _id: "legal-mentions-legales",
    _type: "legalPage",
    title: "Mentions légales",
    slug: { _type: "slug" as const, current: "mentions-legales" },
    eyebrow: "Légal",
    lastUpdated: "Dernière mise à jour : 27 avril 2026",
    body: [
      block([span("Éditeur du site")], "h2"),
      block([
        span("Be in Digital", ["strong"]),
        span(" — studio digital indépendant. Représenté par "),
        span("[À compléter]", ["strong"]),
        span(", en sa qualité de "),
        span("[À compléter]", ["strong"]),
        span("."),
      ]),
      block([
        span("Adresse : "),
        span("[À compléter]", ["strong"]),
        span(", Paris, France. Contact : "),
        span("hello@beindigital.fr", ["__link_hello"]),
        span(". SIREN / SIRET : "),
        span("[À compléter]", ["strong"]),
        span(". Numéro de TVA intracommunautaire : "),
        span("[À compléter]", ["strong"]),
        span("."),
      ], "normal", [{ _type: "link", _key: "__link_hello", href: "mailto:hello@beindigital.fr" }]),
      block([span("Directeur de la publication")], "h2"),
      block([
        span("[À compléter]", ["strong"]),
        span(", contact via "),
        span("hello@beindigital.fr", ["__link_hello2"]),
        span("."),
      ], "normal", [{ _type: "link", _key: "__link_hello2", href: "mailto:hello@beindigital.fr" }]),
      block([span("Hébergeur")], "h2"),
      block([
        span("Vercel Inc.", ["strong"]),
        span(" — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Site : "),
        span("vercel.com", ["__link_vercel"]),
        span("."),
      ], "normal", [{ _type: "link", _key: "__link_vercel", href: "https://vercel.com" }]),
      block([span("Propriété intellectuelle")], "h2"),
      block([
        span(
          "L'ensemble des contenus présents sur ce site (textes, images, code, design, marques, logos) sont la propriété exclusive de Be in Digital ou de ses partenaires, sauf mention contraire. Toute reproduction, représentation, modification ou diffusion, totale ou partielle, sans autorisation écrite préalable, est interdite et constituerait une contrefaçon sanctionnée par les articles L.335-2 et suivants du Code de la propriété intellectuelle.",
        ),
      ]),
      block([span("Crédits")], "h2"),
      block([
        span("Conception, design et développement : Be in Digital. Polices : Fraunces, Inter Tight, JetBrains Mono (Google Fonts, Open Font License)."),
      ]),
      block([span("Limitation de responsabilité")], "h2"),
      block([
        span(
          "Be in Digital met tout en œuvre pour assurer l'exactitude des informations diffusées sur ce site, mais ne peut garantir l'absence d'erreurs, d'omissions ou la disponibilité permanente du service.",
        ),
      ]),
      block([span("Droit applicable")], "h2"),
      block([
        span(
          "Le présent site et ses mentions légales sont régis par le droit français. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence exclusive des tribunaux de Paris, sauf disposition légale impérative contraire.",
        ),
      ]),
    ],
  };

  // Politique de confidentialité
  const confid = {
    _id: "legal-confidentialite",
    _type: "legalPage",
    title: "Politique de confidentialité",
    slug: { _type: "slug" as const, current: "confidentialite" },
    eyebrow: "Légal",
    intro:
      "Be in Digital protège vos données personnelles. Cette page explique ce qu'on collecte, pourquoi, combien de temps on les conserve et comment vous pouvez exercer vos droits.",
    lastUpdated: "Dernière mise à jour : 27 avril 2026",
    body: [
      block([span("Responsable du traitement")], "h2"),
      block([
        span(
          "Le responsable du traitement de vos données est Be in Digital, joignable à l'adresse hello@beindigital.fr. Les coordonnées détaillées figurent dans nos mentions légales.",
        ),
      ]),
      block([span("Données que nous collectons")], "h2"),
      block([
        span(
          "Nous ne collectons que les données strictement nécessaires à la communication avec vous. Formulaire de contact : nom, email, contenu du message. Logs techniques : IP, user-agent, horodatage (sécurité, éphémères).",
        ),
      ]),
      block([
        span(
          "Nous n'utilisons aucun cookie de suivi marketing ni outil d'analytics tiers.",
        ),
      ]),
      block([span("Finalités du traitement")], "h2"),
      listItem([span("Répondre à vos demandes envoyées via le formulaire.")]),
      listItem([span("Évaluer la pertinence d'un projet ensemble.")]),
      listItem([span("Garantir la sécurité technique et la disponibilité du site.")]),
      block([span("Base légale")], "h2"),
      block([
        span(
          "Le traitement repose sur votre consentement (envoi volontaire d'un message) et sur l'intérêt légitime de Be in Digital à sécuriser son site et à répondre à ses prospects.",
        ),
      ]),
      block([span("Destinataires & sous-traitants")], "h2"),
      block([
        span(
          "Vos données ne sont jamais vendues, louées ou partagées à des tiers à des fins commerciales. Sous-traitants : Vercel (hébergement, États-Unis, clauses contractuelles types) et Convex (DB du formulaire, États-Unis, clauses contractuelles types).",
        ),
      ]),
      block([span("Durée de conservation")], "h2"),
      block([
        span(
          "Messages du formulaire : 3 ans à compter du dernier échange. Logs techniques : 30 jours maximum.",
        ),
      ]),
      block([span("Vos droits")], "h2"),
      listItem([span("Droit d'accès et de copie de vos données.")]),
      listItem([span("Droit de rectification.")]),
      listItem([span("Droit à l'effacement.")]),
      listItem([span("Droit à la portabilité.")]),
      listItem([span("Droit d'opposition au traitement.")]),
      listItem([span("Droit à la limitation du traitement.")]),
      block([
        span(
          "Pour exercer un de ces droits, écrivez à hello@beindigital.fr. Nous répondrons sous un mois maximum. Vous pouvez aussi déposer une réclamation auprès de la CNIL.",
        ),
      ]),
      block([span("Sécurité")], "h2"),
      block([
        span(
          "HTTPS (HSTS, TLS) sur tous les échanges. Honeypot anti-bot et token de session anti-rejeu sur le formulaire. Données protégées par les pratiques standard chez nos sous-traitants.",
        ),
      ]),
    ],
  };

  // Cookies
  const cookies = {
    _id: "legal-cookies",
    _type: "legalPage",
    title: "Cookies",
    slug: { _type: "slug" as const, current: "cookies" },
    eyebrow: "Légal",
    intro:
      "Be in Digital n'utilise aucun cookie de suivi ni outil d'analytics tiers (Google Analytics, Meta Pixel, etc.). On préfère mesurer ce qui compte côté serveur, sans tracer nos visiteurs.",
    lastUpdated: "Dernière mise à jour : 27 avril 2026",
    body: [
      block([span("Cookies utilisés")], "h2"),
      block([
        span(
          "Le site dépose uniquement les cookies suivants, strictement nécessaires à son fonctionnement :",
        ),
      ]),
      listItem([
        span("Cookies techniques", ["strong"]),
        span(
          " — gérés par notre hébergeur (Vercel) pour acheminer le trafic et protéger contre les attaques. Durée : la session de navigation.",
        ),
      ]),
      listItem([
        span("Cookies de session du formulaire", ["strong"]),
        span(
          " — token anti-bot créé puis supprimé immédiatement après l'envoi.",
        ),
      ]),
      block([span("Pourquoi pas de tracker ?")], "h2"),
      block([
        span(
          "Les outils analytics classiques demandent un consentement RGPD, ralentissent le site et tracent vos visiteurs sur l'ensemble du web. Aucun de ces compromis ne nous semble justifié pour un site de studio. On regarde l'usage réel via les logs serveur agrégés (sans IP, sans empreinte navigateur).",
        ),
      ]),
      block([span("Comment supprimer ces cookies ?")], "h2"),
      block([
        span(
          "Tous les navigateurs permettent de bloquer ou supprimer les cookies depuis leurs paramètres. Cela n'empêchera pas la navigation mais peut empêcher l'envoi du formulaire.",
        ),
      ]),
    ],
  };

  await Promise.all([
    client.createOrReplace(mentions),
    client.createOrReplace(confid),
    client.createOrReplace(cookies),
  ]);
  console.log("✓ legalPage × 3 → mentions-legales, confidentialite, cookies");
}

async function main() {
  await seedAbout();
  await seedProducts();
  await seedContact();
  await seedLegal();
  console.log("\nDone — secondary pages seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
