/* ═══════════════════════════════════════════════
   Pricing Data — Plans, comparatif, maintenance, FAQ
   ═══════════════════════════════════════════════ */

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
    creation: 3500,
    maintenanceMonthly: 100,
    maintenanceYearly: 1000,
    featured: false,
    features: [
      "Site vitrine premium à votre image",
      "Optimisé mobile, tablette & desktop",
      "Menu digital consultable en ligne",
      "Hébergement sécurisé & nom de domaine inclus",
      "Commande en ligne & click and collect",
      "Programme de fidélité intégré",
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
      "L'offre complète pour les restaurants qui veulent une présence digitale totale : site web professionnel et application mobile native.",
    creation: 7500,
    maintenanceMonthly: 200,
    maintenanceYearly: 2000,
    featured: true,
    comingSoon: true,
    features: [
      "Tout ce qui est inclus dans l'Essentielle",
      "Application mobile native iOS & Android",
      "Notifications push pour vos clients",
      "Dashboard analytics & suivi des performances",
      "Expérience de marque unifiée web + mobile",
      "Mises à jour prioritaires & support dédié",
    ],
  },
];

/* ── Comparison table ── */

export interface ComparisonCategory {
  name: string;
  features: { label: string; essentielle: boolean; premium: boolean }[];
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
      { label: "Programme de fidélité & gamification", essentielle: true, premium: true },
      { label: "Campagnes email marketing", essentielle: true, premium: true },
    ],
  },
  {
    name: "Gestion & pilotage",
    features: [
      { label: "Dashboard administrateur", essentielle: true, premium: true },
      { label: "Centralisation des commandes", essentielle: true, premium: true },
      { label: "Intégration Uber Eats & Deliveroo", essentielle: true, premium: true },
      { label: "Analytics & suivi des performances", essentielle: false, premium: true },
    ],
  },
  {
    name: "Mobile",
    features: [
      { label: "Application native iOS & Android", essentielle: false, premium: true },
      { label: "Notifications push personnalisées", essentielle: false, premium: true },
      { label: "Expérience de marque unifiée web + mobile", essentielle: false, premium: true },
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
  {
    title: "Monitoring 24/7",
    description: "Surveillance continue de la disponibilité et des performances.",
    icon: "activity",
  },
  {
    title: "Sauvegardes",
    description: "Sauvegardes automatiques quotidiennes de vos données et contenus.",
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
      "Vous sélectionnez un thème premium personnalisé à l'image de votre établissement, ou vous optez pour une création sur mesure (à partir de 500 €).",
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
    question: "La maintenance est-elle obligatoire ?",
    answer:
      "Oui, la première année de maintenance est obligatoire. Elle garantit un lancement réussi, un suivi technique de qualité et un accompagnement dans la prise en main de votre solution. Au-delà de la première année, la maintenance reste fortement recommandée mais n'est plus obligatoire.",
  },
  {
    question: "Que comprend exactement la maintenance ?",
    answer:
      "La maintenance inclut l'hébergement sécurisé, les mises à jour techniques et de sécurité, le monitoring 24/7, les sauvegardes quotidiennes, le support technique par email et les évolutions mineures (ajustements de contenu, corrections). Les refontes complètes, nouvelles fonctionnalités majeures et créations graphiques avancées ne sont pas incluses et font l'objet d'un devis séparé.",
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
    question: "Y a-t-il des frais cachés ?",
    answer:
      "Aucun. Le prix affiché est le prix réel. Les frais de création couvrent l'intégralité de la conception et du développement. La maintenance couvre l'hébergement, le support et les mises à jour. Si un besoin dépasse le périmètre de la maintenance, nous vous proposons un devis avant toute intervention.",
  },
  {
    question: "Puis-je demander des modifications après la mise en ligne ?",
    answer:
      "Bien sûr. Les évolutions mineures (textes, images, ajustements de mise en page) sont incluses dans la maintenance. Pour des modifications plus conséquentes — nouvelles fonctionnalités, refonte d'une section — nous établissons un devis personnalisé.",
  },
  {
    question: "L'application mobile est-elle déjà disponible ?",
    answer:
      "L'application mobile fait partie de l'offre Premium. Elle est développée en natif pour iOS et Android, avec votre branding, votre programme de fidélité intégré et les notifications push. Le développement est réalisé en même temps que le site web.",
  },
  {
    question: "Puis-je commencer avec Essentielle puis passer à Premium ?",
    answer:
      "Absolument. Vous pouvez démarrer avec l'offre Essentielle et évoluer vers Premium à tout moment. La migration est pensée pour être fluide : votre site reste en ligne et l'application mobile vient s'ajouter à votre écosystème existant.",
  },
  {
    question: "Le design personnalisé est-il obligatoire ?",
    answer:
      "Non, c'est une option. Chaque offre inclut déjà un design premium de qualité. L'option design personnalisé s'adresse aux restaurants qui souhaitent une identité visuelle encore plus poussée et un travail graphique approfondi.",
  },
  {
    question: "Combien de temps prend le lancement ?",
    answer:
      "En moyenne, comptez 4 à 6 semaines entre le premier échange et la mise en ligne. Ce délai varie selon la complexité du projet et la réactivité dans les échanges. L'offre Premium peut nécessiter 2 à 3 semaines supplémentaires pour l'application mobile.",
  },
  {
    question: "Les intégrations Uber Eats & Deliveroo sont-elles incluses ?",
    answer:
      "Oui, les intégrations avec Uber Eats et Deliveroo sont incluses dans les deux offres. Vos commandes de toutes les plateformes arrivent dans un flux unique sur votre dashboard. La livraison via Uber Direct depuis votre propre site est également disponible.",
  },
];

/* ── Helpers ── */

export function formatPrice(n: number) {
  return n.toLocaleString("fr-FR");
}
