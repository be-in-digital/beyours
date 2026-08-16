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
// Each page step navigates to the page, then highlights specific
// UI elements to walk the user through every feature.

export const TOUR_STEPS: StepType[] = [
  // ── Welcome ────────────────────────────────────────────────────────
  {
    selector: '[data-tour="sidebar-brand"]',
    content:
      "Bienvenue dans votre cuisine digitale ! " +
      "Ce menu à gauche regroupe toutes les pages de votre tableau de bord. " +
      "On va visiter chaque page et vous montrer tout ce que vous pouvez faire. C'est parti !",
    position: "right",
  },

  // ── Dashboard ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="dashboard-stats"]',
    highlightedSelectors: ['[data-tour="nav-dashboard"]'],
    content:
      "Vue d'ensemble — Vos indicateurs du jour ! " +
      "4 cartes : chiffre d'affaires, nombre de commandes, panier moyen " +
      "et commandes en cours. Chaque carte compare avec hier pour voir la tendance.",
    action: goTo("/dashboard"),
  },
  {
    selector: '[data-tour="dashboard-charts"]',
    content:
      "Graphiques — Le chiffre d'affaires des 7 derniers jours en barres, " +
      "plus deux camemberts : répartition par type (sur place, livraison, à emporter) " +
      "et par source (site web, Uber Eats, Deliveroo, caisse).",
  },
  {
    selector: '[data-tour="dashboard-actions"]',
    content:
      "Actions rapides — 3 raccourcis pour les tâches courantes : " +
      "créer une commande, ajouter un produit ou ouvrir la vue cuisine. " +
      "Un clic et c'est parti !",
  },

  // ── Orders ─────────────────────────────────────────────────────────
  {
    selector: '[data-tour="orders-search"]',
    highlightedSelectors: ['[data-tour="nav-orders"]'],
    content:
      "Commandes — La barre de recherche vous permet de trouver " +
      "une commande par son numéro ou par le nom du client. " +
      "Pratique quand un client appelle !",
    action: goTo("/orders"),
  },
  {
    selector: '[data-tour="orders-tabs"]',
    content:
      "Filtrez par statut en un clic : en attente, confirmées, " +
      "en préparation, prêtes, en livraison, livrées, terminées ou annulées. " +
      "Le tableau affiche le n° de commande, le client, le type, le total " +
      "et le statut de paiement. Cliquez sur une commande pour voir le détail complet.",
  },

  // ── Kitchen KDS ────────────────────────────────────────────────────
  {
    selector: '[data-tour="kitchen-board"]',
    highlightedSelectors: ['[data-tour="nav-orders-kitchen"]'],
    content:
      "Cuisine (KDS) — L'écran de votre cuisine ! " +
      "4 colonnes Kanban : En attente → En cours → Prêt → Terminé. " +
      "Chaque ticket affiche le n° de commande, les articles et un chrono. " +
      "Filtrez par poste (entrées, grillades, desserts…) en haut. " +
      "Impression thermique automatique à chaque nouvelle commande.",
    action: goTo("/orders/kitchen"),
  },

  // ── Products ───────────────────────────────────────────────────────
  {
    selector: '[data-tour="products-header"]',
    highlightedSelectors: ['[data-tour="nav-products"]'],
    content:
      "Menu & Produits — Le bouton « Ajouter un produit » ouvre un formulaire complet : " +
      "nom, description, prix, images, catégorie, options (suppléments, tailles, cuissons…), " +
      "planification horaire et intégrations Uber Eats/Deliveroo. " +
      "Deux onglets : Produits individuels et Menus/Formules.",
    action: goTo("/products"),
  },
  {
    selector: '[data-tour="products-filters"]',
    content:
      "Filtres — Recherchez par nom, filtrez par catégorie, " +
      "statut (actif/inactif) ou source (manuel, Uber Eats, Deliveroo). " +
      "Basculez entre vue liste et vue grille avec les boutons à droite. " +
      "La pagination gère les gros catalogues.",
  },

  // ── Categories ─────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-categories"]'],
    content:
      "Catégories — Organisez vos plats par famille : entrées, plats, desserts, boissons… " +
      "Chaque catégorie a un nom, une image, un statut (actif/inactif) et un slug. " +
      "Réordonnez-les avec les flèches haut/bas, modifiez ou supprimez en un clic.",
    action: goTo("/categories"),
  },

  // ── Customers ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-customers"]'],
    content:
      "Clients — Votre carnet d'adresses intelligent ! " +
      "Retrouvez chaque client, son historique de commandes, ses coordonnées " +
      "et ses préférences. Parfait pour fidéliser et personnaliser le service.",
    action: goTo("/customers"),
  },

  // ── Inventory ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="inventory-status"]',
    highlightedSelectors: ['[data-tour="nav-inventory"]'],
    content:
      "Inventaire — 4 cartes de résumé cliquables : En stock (vert), " +
      "Stock faible (orange), Rupture (rouge), Non suivi (gris). " +
      "Cliquez sur une carte pour filtrer instantanément la liste.",
    action: goTo("/inventory"),
  },
  {
    selector: '[data-tour="main-content"]',
    content:
      "Pour chaque produit, vous pouvez : ajuster la quantité avec +/−, " +
      "définir un seuil d'alerte de stock bas, activer la désactivation automatique " +
      "(le produit disparaît du site quand le stock atteint 0) " +
      "et activer/désactiver le suivi de stock.",
  },

  // ── Promotions ─────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-promotions"]'],
    content:
      "Promotions — Deux types : Codes promo (le client saisit un code) " +
      "et Offres automatiques (appliquées sans code). " +
      "Pour chaque promo : nom, code, type de réduction (%, fixe, livraison offerte…), " +
      "période de validité, horaires, compteur d'utilisation " +
      "et un interrupteur pour activer/désactiver.",
    action: goTo("/promotions"),
  },

  // ── Gamification ───────────────────────────────────────────────────
  {
    selector: '[data-tour="games-tabs"]',
    highlightedSelectors: ['[data-tour="nav-games"]'],
    content:
      "Gamification — 4 onglets : Configuration (créez vos jeux : roue de la fortune " +
      "ou carte à gratter, avec un curseur de taux de victoire de 0 à 100%), " +
      "Codes QR (à imprimer sur vos tables), " +
      "Prix (réductions, produits offerts, personnalisés) " +
      "et Historique des parties jouées.",
    action: goTo("/games"),
  },

  // ── Email Marketing ────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-email"]'],
    content:
      "Email Marketing — Tableau de bord avec KPIs (envois, ouvertures, clics). " +
      "Sous-pages : Campagnes (créer/planifier), Modèles (éditeur visuel par blocs), " +
      "Abonnés (import CSV, détail client), Segments (groupes ciblés) " +
      "et Configuration (expéditeur, domaine, DKIM).",
    action: goTo("/email"),
  },

  // ── CMS Pages ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-pages"]'],
    content:
      "Pages — Créez et éditez les pages de votre site : accueil, à propos, " +
      "mentions légales, CGV… Un éditeur visuel simple, " +
      "sans aucune ligne de code à écrire. Publiez ou dépubliez en un clic.",
    action: goTo("/content/pages"),
  },

  // ── Components ─────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-components"]'],
    content:
      "Composants — Des blocs réutilisables pour vos pages : " +
      "bannières, galeries photo, témoignages, cartes de menu, vidéos… " +
      "Assemblez-les comme des Lego pour créer des pages uniques.",
    action: goTo("/content/components"),
  },

  // ── Blog ───────────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-blog"]'],
    content:
      "Blog — Publiez des articles pour attirer du trafic : recettes, coulisses, événements. " +
      "Éditeur riche avec images, et le mode Auto Blog qui génère " +
      "du contenu automatiquement grâce à l'IA.",
    action: goTo("/content/blog"),
  },

  // ── Media Library ──────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-content-media"]'],
    content:
      "Médiathèque — Toutes vos images au même endroit ! " +
      "Photos de plats, logo, bannières… Glissez-déposez pour ajouter. " +
      "Les images sont stockées sur AWS S3 et optimisées automatiquement.",
    action: goTo("/content/media"),
  },

  // ── Stores ─────────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-stores"]'],
    content:
      "Établissements — Créez et gérez un ou plusieurs restaurants. " +
      "Pour chaque établissement : nom, adresse (avec autocomplétion), " +
      "téléphone, email, statut. Sélection et actions en masse. " +
      "Basculez entre vos restaurants avec le sélecteur en haut de page.",
    action: goTo("/stores"),
  },

  // ── Team ───────────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-team"]'],
    content:
      "Équipe & Rôles — Invitez vos collaborateurs par email et assignez un rôle : " +
      "admin, manager, cuisinier, serveur… Chacun a des permissions adaptées. " +
      "Filtrez par nom, statut (actif, en attente) ou rôle. " +
      "Modifiez les accès, renvoyez une invitation ou désactivez un membre.",
    action: goTo("/team"),
  },

  // ── Languages ──────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-languages"]'],
    content:
      "Langues — Ajoutez autant de langues que vous voulez ! " +
      "Tableau avec drapeau, code, nom et nom natif. " +
      "Définissez une langue par défaut, activez/désactivez chaque langue. " +
      "La traduction automatique par IA traduit toute votre carte : ~0.001€ par produit.",
    action: goTo("/languages"),
  },

  // ── Subscription ───────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-subscription"]'],
    content:
      "Abonnement — Votre formule en un coup d'œil. " +
      "Consultez votre plan actuel, gérez votre facturation, " +
      "découvrez les fonctionnalités incluses et les options de mise à niveau.",
    action: goTo("/subscription"),
  },

  // ── Settings ───────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-settings"]'],
    content:
      "Paramètres — Plusieurs onglets de configuration : " +
      "informations du restaurant, design et thème, moyens de paiement " +
      "(Stripe, SumUp, PayPal, Square), options de livraison, " +
      "langues du site et notifications.",
    action: goTo("/settings"),
  },

  // ── System ─────────────────────────────────────────────────────────
  {
    selector: '[data-tour="main-content"]',
    highlightedSelectors: ['[data-tour="nav-system"]'],
    content:
      "Système & Mises à jour — Le tableau de bord technique : " +
      "état de votre site, version actuelle, mises à jour disponibles " +
      "et informations système. Réservé aux administrateurs.",
    action: goTo("/system"),
  },

  // ── End ────────────────────────────────────────────────────────────
  {
    selector: '[data-tour="sidebar-brand"]',
    content:
      "La visite est terminée ! Vous connaissez maintenant " +
      "chaque page et chaque fonctionnalité de votre tableau de bord. " +
      "Commencez par ajouter vos produits, puis explorez à votre rythme. " +
      'Relancez cette visite à tout moment via "Revoir la visite" en bas du menu.',
    position: "right",
    action: goTo("/dashboard"),
  },
]
