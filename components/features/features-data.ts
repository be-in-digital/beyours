/* ═══════════════════════════════════════════════
   Features Data — 10 fonctionnalités organisées en 4 piliers
   ═══════════════════════════════════════════════ */

export type Pillar = "attirer" | "vendre" | "gerer" | "fideliser";

export interface Feature {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  longDescription: string;
  benefits: [string, string, string];
  pillar: Pillar;
  /** "dashboard" | "mobile" | "integration" — determines which mockup pattern to use */
  mockupPattern: "dashboard" | "mobile" | "integration";
  /** Whether this feature gets a full deep-dive section */
  deepDive: boolean;
}

export const pillars: Record<Pillar, { label: string; description: string }> = {
  attirer: {
    label: "Attirer",
    description: "Développez votre visibilité et attirez de nouveaux clients",
  },
  vendre: {
    label: "Vendre",
    description: "Convertissez vos visiteurs en commandes directes",
  },
  gerer: {
    label: "Gérer",
    description: "Centralisez et simplifiez vos opérations quotidiennes",
  },
  fideliser: {
    label: "Fidéliser & Optimiser",
    description: "Engagez vos clients et pilotez votre croissance",
  },
};

export const pillarOrder: Pillar[] = ["attirer", "vendre", "gerer", "fideliser"];

export const features: Feature[] = [
  // ── Attirer ──
  {
    id: "site-web-premium",
    tag: "01",
    title: "Site Web Premium",
    subtitle: "Votre vitrine digitale",
    shortDescription:
      "Un site élégant et performant à votre image, optimisé pour le mobile et conçu pour convertir.",
    longDescription:
      "Votre restaurant mérite une présence en ligne à la hauteur de votre cuisine. Nous créons un site web sur mesure, optimisé pour le référencement local et conçu pour transformer chaque visiteur en client. Design premium, chargement rapide, expérience mobile irréprochable.",
    benefits: [
      "Design sur mesure aligné sur votre identité de marque",
      "Optimisé SEO pour le référencement local Google",
      "Chargement ultra-rapide et responsive sur tous les écrans",
    ],
    pillar: "attirer",
    mockupPattern: "dashboard",
    deepDive: true,
  },
  {
    id: "formation-google-business",
    tag: "10",
    title: "Formation Google Business Profile",
    subtitle: "Accompagnement premium",
    shortDescription:
      "Maîtrisez votre fiche Google pour maximiser votre visibilité locale.",
    longDescription:
      "Google Business Profile est le premier point de contact entre votre restaurant et vos futurs clients. Nous vous formons aux bonnes pratiques pour optimiser votre fiche, gérer vos avis, publier du contenu régulier et dominer les résultats de recherche locaux.",
    benefits: [
      "Formation complète à la gestion de votre fiche Google",
      "Stratégies de gestion et réponse aux avis clients",
      "Techniques de publication pour booster votre visibilité locale",
    ],
    pillar: "attirer",
    mockupPattern: "dashboard",
    deepDive: false,
  },

  // ── Vendre ──
  {
    id: "commande-en-ligne",
    tag: "02",
    title: "Commande en Ligne & Click and Collect",
    subtitle: "Vos ventes, sans commission",
    shortDescription:
      "Recevez des commandes directes et proposez le retrait sur place, sans intermédiaire.",
    longDescription:
      "Libérez-vous des commissions des plateformes. Vos clients commandent directement depuis votre site — en livraison ou en click and collect. Paiement sécurisé, notifications en temps réel, et un parcours d'achat optimisé pour maximiser votre panier moyen.",
    benefits: [
      "Zéro commission sur les commandes directes",
      "Click and collect intégré avec créneaux horaires",
      "Parcours d'achat optimisé pour maximiser le panier moyen",
    ],
    pillar: "vendre",
    mockupPattern: "mobile",
    deepDive: true,
  },
  {
    id: "experience-mobile",
    tag: "09",
    title: "Expérience Mobile",
    subtitle: "Votre app, votre marque",
    shortDescription:
      "Une application native iOS & Android pour une expérience mobile-first.",
    longDescription:
      "Offrez à vos clients une application mobile à votre image. Commande rapide, programme de fidélité intégré, notifications push personnalisées et expérience de marque complète. Votre restaurant dans la poche de chaque client.",
    benefits: [
      "Application native iOS & Android à votre image",
      "Notifications push pour engager vos clients",
      "Commande express en un tap avec paiement enregistré",
    ],
    pillar: "vendre",
    mockupPattern: "mobile",
    deepDive: true,
  },

  // ── Gérer ──
  {
    id: "dashboard-administrateur",
    tag: "04",
    title: "Dashboard Administrateur",
    subtitle: "Pilotage global",
    shortDescription:
      "Pilotez toute votre activité digitale depuis une interface unique et intuitive.",
    longDescription:
      "Un centre de contrôle complet pour votre restaurant. Suivez votre activité en temps réel, gérez votre équipe, configurez vos paramètres et gardez une vue d'ensemble sur toutes vos opérations depuis un seul écran.",
    benefits: [
      "Vue d'ensemble en temps réel de toute votre activité",
      "Gestion d'équipe et de rôles centralisée",
      "Configuration et paramétrage sans compétence technique",
    ],
    pillar: "gerer",
    mockupPattern: "dashboard",
    deepDive: false,
  },
  {
    id: "gestion-menu",
    tag: "03",
    title: "Gestion du Menu",
    subtitle: "Opérations simplifiées",
    shortDescription:
      "Mettez à jour vos plats, prix et photos en temps réel depuis le dashboard.",
    longDescription:
      "Fini les menus PDF obsolètes. Modifiez vos plats, ajustez vos prix, changez vos photos et gérez la disponibilité en quelques clics. Les changements se reflètent instantanément sur votre site et votre application.",
    benefits: [
      "Mise à jour instantanée des plats, prix et visuels",
      "Gestion de la disponibilité en temps réel",
      "Catégories, options et suppléments personnalisables",
    ],
    pillar: "gerer",
    mockupPattern: "dashboard",
    deepDive: false,
  },
  {
    id: "centralisation-commandes",
    tag: "05",
    title: "Centralisation des Commandes",
    subtitle: "Un seul flux unifié",
    shortDescription:
      "Réunissez toutes vos commandes dans un seul flux en temps réel.",
    longDescription:
      "Site web, plateformes de livraison, sur place — toutes vos commandes convergent dans un flux unique et en temps réel. Plus de jonglage entre les écrans, plus de commandes manquées. Un seul endroit pour tout gérer, avec des alertes sonores et des notifications instantanées.",
    benefits: [
      "Toutes les sources de commandes dans un seul écran",
      "Alertes sonores et notifications push en temps réel",
      "Historique complet et traçabilité de chaque commande",
    ],
    pillar: "gerer",
    mockupPattern: "dashboard",
    deepDive: true,
  },
  {
    id: "integration-plateformes",
    tag: "06",
    title: "Intégration Uber Eats & Deliveroo",
    subtitle: "Certification en cours",
    shortDescription:
      "En cours de certification officielle auprès des plateformes. Offerte à tous les clients dès validation.",
    longDescription:
      "L'intégration est en cours de certification officielle auprès d'Uber et de Deliveroo. Dès validation, les commandes Uber Eats et Deliveroo arriveront directement dans votre dashboard, sans double saisie, et Uber Direct permettra la livraison depuis votre propre site sans flotte de livreurs. Offerte à tous les clients, sans surcoût, via la maintenance ; les clients existants sont activés en priorité. Nous ne promettons pas de date : elle dépend des plateformes.",
    benefits: [
      "Certification officielle Uber & Deliveroo en cours",
      "Offerte à tous les clients dès validation, sans surcoût",
      "Vos commandes plateformes rejoindront votre flux unique",
    ],
    pillar: "gerer",
    mockupPattern: "integration",
    deepDive: true,
  },

  // ── Fidéliser & Optimiser ──
  {
    id: "fidelisation-gamification",
    tag: "07",
    title: "Fidélisation & Gamification",
    subtitle: "Engagez vos clients",
    shortDescription:
      "Un programme de fidélité engageant avec des mécaniques de gamification.",
    longDescription:
      "Transformez vos clients occasionnels en habitués grâce à un programme de fidélité intelligent et gamifié. Points, niveaux, défis, récompenses exclusives — chaque interaction renforce l'engagement et incite à revenir. Personnalisable et intégré à votre site et votre application.",
    benefits: [
      "Système de points, niveaux et récompenses personnalisable",
      "Défis et challenges pour stimuler l'engagement",
      "Suivi et analyse du comportement de fidélisation",
    ],
    pillar: "fideliser",
    mockupPattern: "mobile",
    deepDive: true,
  },
  {
    id: "analytics",
    tag: "08",
    title: "Analytics",
    subtitle: "Décisions data-driven",
    shortDescription:
      "Comprenez vos performances avec des données claires et des insights actionnables.",
    longDescription:
      "Prenez des décisions éclairées grâce à des données précises sur votre activité. Chiffre d'affaires, panier moyen, plats populaires, heures de pointe, taux de retour — tout est visualisé dans des tableaux de bord clairs et actionnables. Identifiez les opportunités et optimisez votre stratégie.",
    benefits: [
      "Tableaux de bord visuels avec KPIs essentiels",
      "Analyse des tendances et des performances par période",
      "Insights actionnables pour optimiser votre offre",
    ],
    pillar: "fideliser",
    mockupPattern: "dashboard",
    deepDive: true,
  },
];

/** Features that get full deep-dive sections */
export const deepDiveFeatures = features.filter((f) => f.deepDive);

/** Features in the compact "Et aussi..." block */
export const compactFeatures = features.filter((f) => !f.deepDive);

/** Features grouped by pillar (preserving order) */
export function getFeaturesByPillar() {
  return pillarOrder.map((pillar) => ({
    pillar,
    ...pillars[pillar],
    features: features.filter((f) => f.pillar === pillar),
  }));
}
