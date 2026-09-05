/* ═══════════════════════════════════════════════
   Features Data — 10 features organised into 4 pillars
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
  /** Set when a client cannot use this yet. `label` says what it waits on —
      the two current cases wait on different things, and a reader deserves to
      know which. Absent means it ships today; every renderer badges it. */
  notYetAvailable?: { label: string };
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
      "Click and collect intégré à votre site",
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
      "Une application native iOS & Android, au programme de l'offre Premium.",
    longDescription:
      "Une application à votre image : commande en quelques secondes, jeu et lots intégrés, notifications push. Elle fera l'offre Premium, qui ouvrira le jour de sa publication sur l'App Store et Google Play. Nous ne la vendons pas avant.",
    benefits: [
      "Application native iOS & Android à votre image",
      "Notifications push pour engager vos clients",
      "Commande express en un tap avec paiement enregistré",
    ],
    pillar: "vendre",
    mockupPattern: "mobile",
    deepDive: true,
    notYetAvailable: { label: "À venir" },
  },

  // ── Manage ──
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
      "Réunissez toutes vos commandes directes dans un seul flux en temps réel.",
    longDescription:
      "Vos commandes directes convergent dans un flux unique et en temps réel : celles de votre site, du click & collect et du sur place. Fini le jonglage entre les écrans et les commandes manquées ; tout se gère au même endroit, avec alertes sonores et notifications instantanées. Les commandes Deliveroo y arrivent déjà, notre application étant certifiée ; celles d'Uber Eats rejoindront le flux une fois la validation obtenue.",
    benefits: [
      "Toutes vos commandes directes dans un seul écran",
      "Alerte sonore à chaque commande, écran mis à jour en direct",
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
    subtitle: "Deliveroo certifié, Uber en attente",
    shortDescription:
      "Deliveroo a certifié notre application : les commandes arrivent dans votre dashboard. Uber Eats est en attente de validation. Offerte à tous les clients, sans surcoût.",
    longDescription:
      "Deliveroo a certifié notre application : les commandes Deliveroo arrivent directement dans votre dashboard, sans double saisie. Côté Uber Eats, la validation de la plateforme est en attente ; une fois obtenue, ces commandes rejoindront le même flux. L'unification de vos canaux est donc à 70 %. L'intégration est offerte à tous les clients, sans surcoût, via la maintenance ; les clients existants sont activés en priorité. Nous ne promettons pas de date pour Uber : elle dépend de la plateforme.",
    benefits: [
      "Deliveroo : application certifiée, commandes intégrées",
      "Uber Eats & Uber Direct : validation en attente, sans date annoncée",
      "Offerte à tous les clients, sans surcoût",
    ],
    pillar: "gerer",
    mockupPattern: "integration",
    deepDive: true,
    notYetAvailable: { label: "Uber en attente" },
  },

  // ── Retain & optimise ──
  {
    id: "fidelisation-gamification",
    tag: "07",
    title: "Fidélisation & Gamification",
    subtitle: "Engagez vos clients",
    shortDescription:
      "Un QR code sur vos tables, un avis ou un abonnement, une partie : vos clients jouent et repartent avec un lot.",
    longDescription:
      "Le client scanne le QR code posé sur sa table, laisse un avis Google ou vous suit sur Instagram, puis lance la roue de la fortune ou gratte sa carte. Vous fixez le taux de gain, de 0 à 100 %, et la liste des lots : réduction, produit offert, menu offert. Le gagnant reçoit son QR code par email et vient le retirer chez vous ; il attend 24 h avant de rejouer. Une partie par visite, et un avis ou un abonné de plus à chaque fois.",
    benefits: [
      "Roue de la fortune et carte à gratter, à vos couleurs",
      "Taux de gain réglé par vous, de 0 à 100 %",
      "Lot reçu par email en QR code, retiré au restaurant",
    ],
    pillar: "fideliser",
    mockupPattern: "mobile",
    deepDive: true,
  },
  {
    id: "analytics",
    tag: "08",
    title: "Suivi des ventes",
    subtitle: "Vos chiffres en direct",
    shortDescription:
      "Chiffre d'affaires, commandes et panier moyen du jour, comparés à la veille.",
    longDescription:
      "Votre tableau de bord ouvre sur les indicateurs du jour : chiffre d'affaires, nombre de commandes, panier moyen et commandes encore à traiter, chacun comparé à la veille. En dessous, le chiffre d'affaires des sept derniers jours en barres, la répartition de vos commandes par type et par canal de vente, puis vos dix dernières commandes. Tout se met à jour en direct, sans export ni tableur.",
    benefits: [
      "Chiffre d'affaires, commandes et panier moyen, comparés à la veille",
      "Le chiffre d'affaires des 7 derniers jours en graphique",
      "Répartition des commandes par type et par canal de vente",
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
