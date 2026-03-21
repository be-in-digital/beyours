import type { StepType } from "@reactour/tour"

// ─── Navigation bridge ──────────────────────────────────────────────
// Set by TourAutoLauncher with useRouter().push
let navigateFn: ((path: string) => void) | null = null

export function setTourNavigate(fn: ((path: string) => void) | null): void {
  navigateFn = fn
}

function goTo(path: string): () => void {
  return () => {
    if (navigateFn) navigateFn(path)
  }
}

// ─── Tour steps ─────────────────────────────────────────────────────
// Each page step navigates to the page, highlights main-content + sidebar item,
// and describes the features available on that page.

export const TOUR_STEPS: StepType[] = [
  // ── Bienvenue ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="sidebar-brand"]',
    content:
      "Bienvenue dans votre cuisine digitale ! " +
      "Ce menu à gauche, c'est votre carte : chaque section vous emmène vers une page dédiée. " +
      "On va visiter ensemble chaque recoin de votre tableau de bord. C'est parti !",
    position: "right",
  },

  // ── Principal ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-dashboard"]'],
    content:
      "Vue d'ensemble — Votre comptoir virtuel ! " +
      "D'un coup d'œil : chiffre d'affaires du jour, " +
      "commandes en cours, plats les plus vendus " +
      "et activité en temps réel de votre cuisine. " +
      "C'est votre point de départ chaque matin.",
    action: goTo("/dashboard"),
  },

  // ── Opérations ─────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-orders"]'],
    content:
      "Commandes — Toutes vos commandes en temps réel ! " +
      "Filtrez par statut (en attente, en préparation, prêtes, livrées), " +
      "par type (sur place, à emporter, livraison). " +
      "Remboursez, réimprimez un ticket ou modifiez une commande en un clic.",
    action: goTo("/orders"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-orders-kitchen"]'],
    content:
      "Cuisine (KDS) — L'écran de votre cuisine ! " +
      "Les tickets arrivent automatiquement, votre équipe voit quoi préparer en priorité. " +
      "Impression thermique automatique, multi-poste, " +
      "et bouton de réimpression pour l'équipe.",
    action: goTo("/orders/kitchen"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-products"]'],
    content:
      "Menu & Produits — Votre carte en version digitale ! " +
      "Ajoutez vos plats, modifiez les prix, gérez les options " +
      "(suppléments, tailles, cuissons…) et planifiez leur disponibilité. " +
      "Tout s'affiche instantanément sur votre site.",
    action: goTo("/products"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-categories"]'],
    content:
      "Catégories — Organisez vos plats par famille : " +
      "entrées, plats, desserts, boissons… " +
      "Réordonnez par glisser-déposer pour structurer " +
      "votre carte exactement comme vous le souhaitez.",
    action: goTo("/categories"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-customers"]'],
    content:
      "Clients — Votre carnet d'adresses intelligent ! " +
      "Retrouvez chaque client, son historique de commandes et ses préférences. " +
      "Parfait pour fidéliser vos habitués et personnaliser votre service.",
    action: goTo("/customers"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-inventory"]'],
    content:
      "Inventaire — Suivez vos stocks en temps réel. " +
      "Quand un produit est en rupture, il se désactive automatiquement sur votre site. " +
      "Alertes de stock bas incluses. " +
      "Plus jamais de commande impossible à honorer !",
    action: goTo("/inventory"),
  },

  // ── Marketing ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-promotions"]'],
    content:
      "Promotions — Créez des offres irrésistibles ! " +
      "-20% sur les pizzas le mardi, menu du jour à prix réduit, happy hour… " +
      "Définissez dates, conditions et produits concernés, " +
      "et laissez la magie opérer.",
    action: goTo("/promotions"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-games"]'],
    content:
      "Gamification — Le jeu, c'est sérieux ! " +
      "QR codes sur les tables → actions sociales (avis Google, follow Instagram) " +
      "→ roue de la fortune ou jeu à gratter. " +
      "Vous contrôlez le taux de gain, les lots et le cooldown entre les parties.",
    action: goTo("/games"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-email"]'],
    content:
      "Email Marketing — Gardez le lien avec vos clients ! " +
      "Créez des campagnes : nouveautés, promos, événements. " +
      "Modèles prêts à l'emploi, segmentation d'audience, " +
      "suivi des ouvertures et clics en temps réel.",
    action: goTo("/email"),
  },

  // ── Contenu ────────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-pages"]'],
    content:
      "Pages — Construisez votre site sur mesure ! " +
      "Éditez les pages : accueil, à propos, mentions légales… " +
      "Un éditeur visuel simple, sans aucune ligne de code à écrire.",
    action: goTo("/content/pages"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-components"]'],
    content:
      "Composants — Des blocs Lego pour votre site ! " +
      "Bannières, galeries photo, témoignages, cartes de menu… " +
      "Assemblez-les pour créer des pages uniques en quelques clics.",
    action: goTo("/content/components"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-blog"]'],
    content:
      "Blog — Attirez du monde avec du contenu ! " +
      "Publiez des articles : recettes, coulisses, événements. " +
      "Le mode Auto Blog génère même du contenu automatiquement grâce à l'IA.",
    action: goTo("/content/blog"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-media"]'],
    content:
      "Médiathèque — Toutes vos images au même endroit ! " +
      "Photos de plats, logo, bannières… Glissez-déposez pour ajouter, " +
      "et réutilisez-les partout sur votre site.",
    action: goTo("/content/media"),
  },

  // ── Organisation ───────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-stores"]'],
    content:
      "Établissements — Un restaurant ou cent, vous gérez ! " +
      "Chaque établissement a ses propres horaires, adresse, carte et commandes. " +
      "Basculez de l'un à l'autre depuis le sélecteur en haut de page.",
    action: goTo("/stores"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-team"]'],
    content:
      "Équipe & Rôles — Invitez votre brigade ! " +
      "Manager, cuisinier, serveur… chacun a un rôle avec des accès adaptés. " +
      "Le chef voit la cuisine, le manager voit les stats, chacun son domaine.",
    action: goTo("/team"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-languages"]'],
    content:
      "Langues — Parlez toutes les langues ! " +
      "Ajoutez autant de langues que vous voulez. " +
      "La traduction automatique par IA traduit toute votre carte en un clic. " +
      "Coût ridicule : environ 0.001€ par produit traduit.",
    action: goTo("/languages"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-subscription"]'],
    content:
      "Abonnement — Votre formule en un coup d'œil. " +
      "Consultez votre plan, gérez votre facturation " +
      "et découvrez les fonctionnalités incluses dans votre offre.",
    action: goTo("/subscription"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-settings"]'],
    content:
      "Paramètres — Les coulisses de votre restaurant ! " +
      "Infos générales, moyens de paiement (Stripe, SumUp, PayPal, Square), " +
      "options de livraison, notifications et personnalisation.",
    action: goTo("/settings"),
  },
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-system"]'],
    content:
      "Système & Mises à jour — Le tableau de bord technique. " +
      "État de votre site, mises à jour disponibles " +
      "et informations système. Réservé aux administrateurs.",
    action: goTo("/system"),
  },

  // ── Fin ────────────────────────────────────────────────────────────
  {
    selector: '[data-tour="sidebar-brand"]',
    content:
      "La visite est terminée ! Vous connaissez maintenant " +
      "tous les outils à votre disposition. " +
      "Commencez par ajouter vos produits, puis explorez à votre rythme. " +
      'Relancez cette visite à tout moment via "Revoir la visite" en bas du menu.',
    position: "right",
    action: goTo("/dashboard"),
  },
]
