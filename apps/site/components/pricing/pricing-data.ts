/* ═══════════════════════════════════════════════
   Pricing Data — Plans, comparatif, maintenance, FAQ
   ═══════════════════════════════════════════════ */

import { planPrices } from "@/convex/planPrices";
import { isPlanOpenForSale } from "@/convex/planAvailability";

/* Amounts shown here derive from convex/planPrices.ts (the single source, in
   cents) and are converted to euros for display. Never hard-code an amount
   back in: the pricing page would quote a price the checkout does not charge. */
const eur = (cents: number) => cents / 100;

export type BillingPeriod = "monthly" | "yearly";

export interface Plan {
  name: string;
  slug: "essentielle" | "premium";
  subtitle: string;
  description: string;
  creation: number;
  maintenanceMonthly: number;
  maintenanceYearly: number;
  featured: boolean;
  comingSoon?: boolean;
  features: string[];
}

export const plans: Plan[] = [
  {
    name: "Essentielle",
    slug: "essentielle",
    subtitle: "Site web restaurant",
    description:
      "Une solution complète pour disposer d'une présence digitale moderne, professionnelle et performante.",
    creation: eur(planPrices.essentielle.creation),
    maintenanceMonthly: eur(planPrices.essentielle.maintenanceMonthly),
    maintenanceYearly: eur(planPrices.essentielle.maintenanceYearly),
    featured: false,
    features: [
      "Site vitrine premium à votre image",
      "Optimisé mobile, tablette & desktop",
      "Menu digital consultable en ligne",
      "Hébergement sécurisé & nom de domaine inclus",
      "Commande en ligne & click and collect",
      "Suivi des ventes : chiffre d'affaires, commandes, panier moyen",
      "Jeu concours à table : roue ou carte à gratter",
      "Référencement local Google (SEO)",
      "Campagnes email marketing",
      "Formation à Google Business Profile",
    ],
  },
  {
    name: "Premium",
    slug: "premium",
    subtitle: "Site web + application mobile",
    description:
      "Tout ce que contient l'Essentielle, plus une application mobile native iOS & Android. L'offre ouvrira quand l'application sera disponible.",
    creation: eur(planPrices.premium.creation),
    maintenanceMonthly: eur(planPrices.premium.maintenanceMonthly),
    maintenanceYearly: eur(planPrices.premium.maintenanceYearly),
    featured: true,
    /* Derived, never hard-coded: the same constant refuses the plan at
       checkout (convex/stripe.ts). A badge that can drift from the guard
       is how /checkout?plan=premium stayed open behind an « À venir » card. */
    comingSoon: !isPlanOpenForSale("premium"),
    features: [
      "Tout ce qui est inclus dans l'Essentielle",
      "Application mobile native iOS & Android",
      "Notifications push pour vos clients",
      "Expérience de marque unifiée web + mobile",
      "Mises à jour prioritaires & support dédié",
    ],
  },
];

/* ── Comparison table ── */

/** true = included · false = not included · "soon" = built, awaiting a
    platform's certification · "planned" = announced and sold as part of a
    plan, not built yet. The two are not interchangeable: "soon" renders the
    Deliveroo/Uber wording, and a row that is neither included nor honestly
    marked is the defect this type exists to make impossible. */
export type ComparisonStatus = boolean | "soon" | "planned";

export interface ComparisonCategory {
  name: string;
  features: {
    label: string;
    essentielle: ComparisonStatus;
    premium: ComparisonStatus;
  }[];
}

export const comparisonCategories: ComparisonCategory[] = [
  {
    name: "Présence digitale",
    features: [
      { label: "Site web premium sur mesure", essentielle: true, premium: true },
      { label: "Référencement local Google (SEO)", essentielle: true, premium: true },
      { label: "Menu digital consultable en ligne", essentielle: true, premium: true },
      { label: "Hébergement sécurisé & nom de domaine", essentielle: true, premium: true },
    ],
  },
  {
    name: "Commande & conversion",
    features: [
      { label: "Commande en ligne directe", essentielle: true, premium: true },
      { label: "Click & collect intégré", essentielle: true, premium: true },
      { label: "Jeu concours par QR code (roue, carte à gratter)", essentielle: true, premium: true },
      { label: "Campagnes email marketing", essentielle: true, premium: true },
    ],
  },
  {
    name: "Gestion & pilotage",
    features: [
      { label: "Dashboard administrateur", essentielle: true, premium: true },
      { label: "Centralisation des commandes directes (site, click & collect, sur place)", essentielle: true, premium: true },
      { label: "Intégration Uber Eats & Deliveroo", essentielle: "soon", premium: "soon" },
      { label: "Suivi des ventes : chiffre d'affaires, commandes, panier moyen", essentielle: true, premium: true },
    ],
  },
  {
    name: "Mobile",
    features: [
      { label: "Application native iOS & Android", essentielle: false, premium: "planned" },
      { label: "Notifications push personnalisées", essentielle: false, premium: "planned" },
      { label: "Expérience de marque unifiée web + mobile", essentielle: false, premium: "planned" },
    ],
  },
  {
    name: "Accompagnement",
    features: [
      { label: "Formation Google Business Profile", essentielle: true, premium: true },
      { label: "Support technique par email", essentielle: true, premium: true },
      { label: "Mises à jour prioritaires", essentielle: false, premium: true },
      { label: "Support dédié", essentielle: false, premium: true },
    ],
  },
];

/* ── Maintenance details ── */

export const maintenanceIncluded = [
  {
    title: "Hébergement & SSL",
    description: "Hébergement sécurisé haute performance avec certificat SSL inclus.",
    icon: "server",
  },
  {
    title: "Mises à jour",
    description: "Mises à jour techniques, de sécurité et de compatibilité régulières.",
    icon: "refresh",
  },
  {
    title: "Support technique",
    description: "Assistance par email pour toutes vos questions et demandes.",
    icon: "headset",
  },
  /* Both of these were rewritten once to describe the mechanism that actually
     ran rather than the one that had been sold, and both are rewritten again
     here because that mechanism has changed — in the same commit, which is the
     rule that note left behind.

     Availability: the probe was already real (every ten minutes, the site and
     its backend, thirty days of history). What was missing was the half that
     makes it a guarantee — it wrote a row to an internal feed and alerted
     nobody, so a restaurant that went down on a Saturday evening paged no one.
     A health change now e-mails the team, in both directions.

     Backups: "Sauvegardes automatiques quotidiennes de vos données et
     contenus" was false on all three counts — the export was manual, it ran
     when an administrator asked, and it carried the configuration and
     catalogue rather than the order history. All three are true now: a cron at
     1 h 30 UTC, an off-site copy in the client's own bucket kept thirty days,
     and the pages, the translations and the orders in it. What it still does
     NOT carry is the media itself (references and URLs only) and, by law, a
     restorable copy of the numbered invoices — so the tile says the first and
     does not claim the second. Coverage:
     `packages/convex-functions/src/backupTables.ts`.

     Six tiles, not seven: the on-demand export is a sentence inside the backup
     tile rather than a tile of its own, because the grid is 3 columns and a
     seventh would sit alone on a third row. */
  {
    title: "Disponibilité surveillée",
    description:
      "Votre site et son serveur sont testés toutes les 10 minutes, 24 h/24. Toute interruption déclenche une alerte chez nous.",
    icon: "activity",
  },
  {
    title: "Sauvegardes quotidiennes",
    description:
      "Chaque nuit, une copie de vos établissements, de votre carte, de vos contenus et de vos commandes est archivée 30 jours. Export à la demande depuis votre tableau de bord.",
    icon: "database",
  },
  {
    title: "Évolutions mineures",
    description: "Ajustements de contenu, corrections et améliorations mineures.",
    icon: "settings",
  },
];

export const maintenanceExcluded = [
  "Refonte complète du site ou de l'application",
  "Nouvelles fonctionnalités majeures",
  "Créations graphiques avancées",
  "Intégrations spécifiques (sur devis)",
];

/* ── Process steps ── */

export const processSteps = [
  {
    number: "01",
    title: "Échange",
    description:
      "On discute de votre projet, de vos besoins et de vos objectifs pour définir la meilleure approche.",
  },
  {
    number: "02",
    title: "Design",
    description:
      "Vous sélectionnez un thème premium personnalisé à l'image de votre établissement, ou vous optez pour une création sur mesure (à partir de 500 € HT).",
  },
  {
    number: "03",
    title: "Développement",
    description:
      "On construit votre solution avec les dernières technologies, en vous impliquant à chaque étape clé.",
  },
  {
    number: "04",
    title: "Lancement & accompagnement",
    description:
      "On met en ligne, on forme votre équipe à la prise en main et on vous accompagne pour un démarrage réussi.",
  },
];

/* ── FAQ ── */

export const faqItems = [
  {
    question: "Qu'est-ce que l'offre fondateurs ?",
    answer:
      `Les 10 premiers restaurants ne paient pas la création, offerte au lieu de ${formatPrice(
        eur(planPrices.essentielle.creation),
      )}\u00a0€ HT : seule la maintenance annuelle reste due. En échange, des contreparties simples : une étude de cas chiffrée, un témoignage et la possibilité de vous citer en référence. Le nombre de places est limité par notre capacité de livraison. À l'épuisement des 10 places, le prix catalogue s'applique automatiquement. L'offre n'est pas cumulable avec un code de parrainage, et la maintenance reste au tarif normal.`,
  },
  {
    question: "La maintenance est-elle obligatoire ?",
    answer:
      "Oui, la première année de maintenance est obligatoire. Elle garantit un lancement réussi, un suivi technique de qualité et un accompagnement dans la prise en main de votre solution. Au-delà de la première année, la maintenance reste fortement recommandée mais n'est plus obligatoire.",
  },
  /* The other half of the copy the nightly job pays for. This answer named the
     export and stopped there, because that was all that existed; it now names
     the nightly backup and its window, and says plainly what the backup does
     not carry. A client reading "sauvegardes" and discovering after an incident
     that their photographs were not in it is the failure the tile above and
     this answer exist to prevent. */
  {
    question: "Que comprend exactement la maintenance ?",
    answer:
      "La maintenance inclut l'hébergement sécurisé, les mises à jour techniques et de sécurité, la surveillance de la disponibilité de votre site avec alerte en cas d'interruption, une sauvegarde quotidienne de vos données conservée 30 jours, l'export de vos données à la demande depuis votre tableau de bord, le support technique par email et les évolutions mineures (ajustements de contenu, corrections). La sauvegarde couvre vos établissements, votre carte, vos contenus, vos traductions et vos commandes ; les images restent dans votre espace de stockage et ne sont pas dupliquées. Les refontes complètes, nouvelles fonctionnalités majeures et créations graphiques avancées ne sont pas incluses et font l'objet d'un devis séparé.",
  },
  {
    question: "Puis-je payer mensuellement ou annuellement ?",
    answer:
      "Oui, vous avez le choix. Le paiement annuel vous fait économiser l'équivalent de 2 mois de maintenance. Les frais de création sont quant à eux payés une seule fois au lancement du projet.",
  },
  {
    question: "Puis-je payer la création en plusieurs fois ?",
    answer:
      "Oui. Au moment du paiement, vous pouvez régler les frais de création en 3 ou 4 fois via Alma ou Klarna, directement intégrés à notre paiement sécurisé Stripe. Aucun dossier à monter : l'option s'affiche au moment de payer.",
  },
  {
    question: "Les prix affichés sont-ils HT ou TTC ?",
    answer:
      "Tous les prix s'affichent hors taxes (HT), comme il est d'usage entre professionnels. La TVA de 20 % est ajoutée au moment du paiement et figure sur votre facture : votre établissement la récupère. Côté comptabilité, la création s'enregistre généralement comme un investissement amortissable et la maintenance comme une charge déductible ; votre expert-comptable vous confirmera le traitement adapté à votre situation.",
  },
  {
    question: "Y a-t-il des frais cachés ?",
    answer:
      "Aucun. Le prix affiché est le prix réel. Les frais de création couvrent l'intégralité de la conception et du développement. La maintenance couvre l'hébergement, le support et les mises à jour. Si un besoin dépasse le périmètre de la maintenance, nous vous proposons un devis avant toute intervention.",
  },
  {
    question: "Puis-je demander des modifications après la mise en ligne ?",
    answer:
      "Bien sûr. Les évolutions mineures (textes, images, ajustements de mise en page) sont incluses dans la maintenance. Pour des modifications plus conséquentes (nouvelles fonctionnalités, refonte d'une section), nous établissons un devis personnalisé.",
  },
  {
    question: "L'application mobile est-elle déjà disponible ?",
    answer:
      "Non, pas encore, et c'est pour cette raison que l'offre Premium n'est pas ouverte à la commande. Elle est prévue en natif pour iOS et Android, avec votre identité, votre jeu concours et les notifications push. Nous n'annoncerons pas de date tant que la publication sur l'App Store et Google Play ne sera pas acquise : cette étape ne dépend pas que de nous. Laissez-nous vos coordonnées, vous serez prévenu au lancement.",
  },
  {
    question: "Puis-je commencer avec Essentielle puis passer à Premium ?",
    answer:
      "Oui, et c'est le chemin que nous recommandons aujourd'hui : démarrez sur l'Essentielle, vous basculerez vers Premium à l'ouverture de l'offre. Il n'y a rien à refaire, votre site reste en ligne et l'application viendra s'y ajouter.",
  },
  {
    question: "Le design personnalisé est-il obligatoire ?",
    answer:
      "Non, c'est une option. Chaque offre inclut déjà un design premium de qualité. L'option design personnalisé s'adresse aux restaurants qui souhaitent une identité visuelle encore plus poussée et un travail graphique approfondi.",
  },
  {
    question: "Combien de temps prend le lancement ?",
    answer:
      "En moyenne, comptez 4 à 6 semaines entre le premier échange et la mise en ligne. Ce délai varie selon la complexité du projet et la réactivité dans les échanges.",
  },
  {
    question: "Les intégrations Uber Eats & Deliveroo sont-elles incluses ?",
    answer:
      "Deliveroo a certifié notre application : les commandes y arrivent déjà. Uber Eats est en attente de validation par la plateforme ; nous ne promettons pas de date, elle ne dépend pas de nous. Dès obtention, les commandes rejoindront le même flux, sans surcoût, via la maintenance, et les clients existants seront activés en priorité. Votre site, la commande en ligne directe et le click & collect fonctionnent dès le premier jour et n'en dépendent pas.",
  },
];

/* ── Helpers ── */

export function formatPrice(n: number) {
  return n.toLocaleString("fr-FR");
}
