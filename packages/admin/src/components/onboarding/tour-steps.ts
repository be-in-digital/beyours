import type { StepType } from "@reactour/tour"
import { adminRoutes } from "../../config/admin-routes"
import { navTourId } from "../../config/nav-config"

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

// ─── Step specs ─────────────────────────────────────────────────────
/**
 * The tour is declared as data, then compiled into `@reactour/tour` steps.
 *
 * WHY A SPEC AND NOT StepType DIRECTLY: the highlight and the destination are
 * the two things that rot, and they used to be a hand-typed
 * `[data-tour="nav-orders"]` next to a hand-typed `"/orders"` buried in an
 * opaque `action` closure — unreadable to a test, and both wrong. When the
 * admin moved under `/dashboard` the sidebar's ids followed the hrefs and the
 * tour's copies did not: 19 of 20 highlights resolved to nothing. Here they are
 * `navFor` and `route`, plain strings drawn from `adminRoutes`, which
 * `onboarding-tour.test.ts` measures against the sidebar and against the pages
 * both apps actually ship.
 *
 * ONE SPOTLIGHT PER STEP, and never `highlightedSelectors`. In
 * `@reactour/tour@3.8.0`, `bypassElem` defaults to `true`, and
 * `getHighlightedRect` (dist/index.js:153-211) then builds its rect from the
 * highlighted selectors ALONE and discards the target's. So a step that
 * highlighted the sidebar entry while describing the page content spotlit the
 * menu item and nothing else — which is what the first repair of this file
 * accidentally switched on, by making those ids resolve for the first time.
 * `bypassElem: false` is no better: it unions the two, and the union of a
 * sidebar entry and the content pane is the whole window.
 *
 * WHICH ELEMENT: a step that navigates spotlights the SIDEBAR ENTRY for its
 * page, not an element on the page. Reactour measures when the step becomes
 * current, `router.push` has not painted yet, and a missing target measures as
 * a 0x0 rect in the top-left corner. (`mutationObservables` does not rescue
 * this: `@reactour/utils`'s observer matches `addedNodes` only, and React
 * commits a page as one subtree insertion whose root is not the anchor.) The
 * sidebar is mounted throughout, so the spotlight always lands — and on a first
 * run it teaches the menu, which is the thing a new owner has to learn anyway.
 * A step that does NOT navigate stays on a page the previous step opened, so it
 * can safely spotlight an element on it.
 */
export interface TourStepSpec {
  /** Route opened before the step is shown. Omit to stay on the current page. */
  route?: string
  /** The nav entry this step is about. Spotlit whenever `anchor` is absent. */
  navFor?: string
  /**
   * A `data-tour` name to spotlight instead of the nav entry. Only legal on a
   * step that does not navigate, or for an anchor that is mounted at all times.
   */
  anchor?: string
  /** Customer-facing copy — French, and true of what ships. */
  content: string
  position?: StepType["position"]
}

/**
 * Anchors rendered by the admin chrome rather than by a page, so they are in
 * the DOM whatever the route and whatever the account owns.
 *
 * `main-content` used to be in here and is deliberately gone: it wraps the
 * whole content pane, so a mask cut around it covers the viewport and
 * spotlights nothing. Membership of this list exempts an anchor from the
 * "not on a navigating step" and "lives on this page" checks, so it is
 * verified against the layouts rather than trusted.
 */
export const ALWAYS_MOUNTED_ANCHORS = ["sidebar-brand"] as const

export const TOUR_STEP_SPECS: TourStepSpec[] = [
  // ── Welcome ────────────────────────────────────────────────────────
  {
    anchor: "sidebar-brand",
    content:
      "Bienvenue dans votre cuisine digitale ! " +
      "Ce menu à gauche regroupe toutes les pages de votre tableau de bord. " +
      "On va les parcourir une par une. C'est parti !",
    position: "right",
  },

  // ── Dashboard ──────────────────────────────────────────────────────
  {
    route: adminRoutes.dashboard,
    navFor: adminRoutes.dashboard,
    content:
      "Vue d'ensemble — Vos indicateurs du jour, en 4 cartes : chiffre d'affaires, " +
      "nombre de commandes, panier moyen et « À traiter (24h) ». " +
      "Les trois premières se comparent à hier pour vous donner la tendance.",
  },
  {
    navFor: adminRoutes.dashboard,
    anchor: "dashboard-charts",
    content:
      "Graphiques — Le chiffre d'affaires des 7 derniers jours en barres, " +
      "plus deux camemberts : répartition par type (sur place, livraison, à emporter) " +
      "et par source (site web, Uber Eats, Deliveroo, caisse).",
  },
  {
    navFor: adminRoutes.dashboard,
    anchor: "dashboard-actions",
    content:
      "Actions rapides — Trois raccourcis vers les écrans du quotidien : " +
      "les commandes, l'ajout d'un produit et la vue cuisine. " +
      "Juste au-dessus, les dernières commandes reçues.",
  },

  // ── Orders ─────────────────────────────────────────────────────────
  {
    route: adminRoutes.orders,
    navFor: adminRoutes.orders,
    content:
      "Commandes — Toutes vos commandes, quel que soit le canal. " +
      "Cherchez par numéro de commande ou par nom de client dans la barre " +
      "en haut : pratique quand un client appelle.",
  },
  {
    navFor: adminRoutes.orders,
    anchor: "orders-tabs",
    content:
      "Filtrez par statut en un clic : en attente, confirmées, " +
      "en préparation, prêtes, en livraison, livrées, terminées ou annulées. " +
      "Le tableau affiche le n° de commande, le client, le type, le total " +
      "et le statut de paiement. Cliquez sur une commande pour voir le détail complet.",
  },

  // ── Kitchen KDS ────────────────────────────────────────────────────
  {
    route: adminRoutes.kitchen,
    navFor: adminRoutes.kitchen,
    content:
      "Cuisine (KDS) — L'écran de votre cuisine ! " +
      "Trois colonnes qui suivent le service : En attente → En cours → Prêt. " +
      "Chaque ticket affiche le n° de commande, les articles et un chrono, " +
      "et vous filtrez par poste (entrées, grillades, desserts…) en haut. " +
      "Les commandes terminées passent sur leur propre onglet. " +
      "Activez l'impression dans les réglages de l'établissement et " +
      "chaque commande payée sort toute seule sur l'imprimante du poste.",
  },

  // ── Products ───────────────────────────────────────────────────────
  {
    route: adminRoutes.products,
    navFor: adminRoutes.products,
    content:
      "Menu & Produits — Le bouton « Ajouter un produit » ouvre un formulaire complet : " +
      "nom, description, prix, images, catégorie, options (suppléments, tailles, cuissons…), " +
      "planification horaire et intégrations Uber Eats/Deliveroo. " +
      "Deux onglets : Produits individuels et Menus/Formules.",
  },
  {
    navFor: adminRoutes.products,
    anchor: "products-filters",
    content:
      "Filtres — Recherchez par nom, filtrez par catégorie, " +
      "statut (actif/inactif) ou source (manuel, Uber Eats, Deliveroo). " +
      "Basculez entre vue liste et vue grille avec les boutons à droite. " +
      "La pagination gère les gros catalogues.",
  },

  // ── Categories ─────────────────────────────────────────────────────
  {
    route: adminRoutes.categories,
    navFor: adminRoutes.categories,
    content:
      "Catégories — Organisez vos plats par famille : entrées, plats, desserts, boissons… " +
      "Chaque catégorie a un nom, une image, un statut (actif/inactif) et un slug. " +
      "Réordonnez-les avec les flèches haut/bas, modifiez ou supprimez en un clic.",
  },

  // ── Customers ──────────────────────────────────────────────────────
  //
  // Restored with the page (#364). #363 deleted this step because
  // `/dashboard/customers` was `<ComingSoon/>`, and a guided tour that walks a
  // new owner into an empty screen is worse than a tour that is one step
  // shorter. The copy below describes what the screen now does rather than
  // what it was sold as: it says where the list comes from, and it does not
  // promise "préférences", which nothing computes.
  {
    route: adminRoutes.customers,
    navFor: adminRoutes.customers,
    content:
      "Clients — Les personnes qui ont commandé chez vous, avec leur nombre de " +
      "commandes, leur total dépensé et leur panier moyen. La liste se remplit " +
      "toute seule : chaque commande confirmée qui porte une adresse e-mail y " +
      "ajoute la personne. Triez par « Récents » ou « Meilleurs clients », et " +
      "exportez tout en CSV — ces données sont les vôtres. " +
      "Une commande sans e-mail n'y figure pas : la page vous dit combien.",
  },

  // ── Inventory ──────────────────────────────────────────────────────
  {
    route: adminRoutes.inventory,
    navFor: adminRoutes.inventory,
    content:
      "Inventaire — Quatre cartes de résumé cliquables : En stock (vert), " +
      "Stock faible (orange), Rupture (rouge), Non suivi (gris). " +
      "Cliquez sur une carte pour filtrer la liste. " +
      "Sur chaque produit : ajuster la quantité avec +/−, définir un seuil " +
      "d'alerte, et activer la désactivation automatique — le produit " +
      "disparaît du site dès que le stock atteint 0.",
  },
  // ── Messages ───────────────────────────────────────────────────────
  {
    route: adminRoutes.messages,
    navFor: adminRoutes.messages,
    content:
      "Messages — Ce que vos clients vous écrivent depuis le formulaire de contact " +
      "de votre site. Expéditeur, sujet, date et statut : cliquez sur une ligne " +
      "pour lire le message en entier. " +
      "La pastille dans le menu compte ceux que personne n'a encore ouverts.",
  },

  // ── Payments ───────────────────────────────────────────────────────
  {
    route: adminRoutes.payments,
    navFor: adminRoutes.payments,
    content:
      "Paiements — Toutes vos transactions, filtrables par statut " +
      "(réussi, en attente, échoué, remboursé) et par fournisseur. " +
      "C'est ici que se fait un remboursement, total ou partiel, " +
      "sur le moyen de paiement d'origine — Stripe, SumUp ou PayPal. " +
      "Un paiement en espèces se rend au comptoir, pas depuis cet écran.",
  },

  // ── Promotions ─────────────────────────────────────────────────────
  {
    route: adminRoutes.promotions,
    navFor: adminRoutes.promotions,
    content:
      "Promotions — Deux types : Codes promo (le client saisit un code) " +
      "et Offres automatiques (appliquées sans code). " +
      "Pour chaque promo : nom, code, type de réduction (%, fixe, livraison offerte…), " +
      "période de validité, horaires, compteur d'utilisation " +
      "et un interrupteur pour activer/désactiver.",
  },

  // ── Gamification ───────────────────────────────────────────────────
  {
    route: adminRoutes.games,
    navFor: adminRoutes.games,
    content:
      "Gamification — Cette page vous donne le pouls : parties jouées, victoires, " +
      "scans de QR codes et lots à valider. " +
      "Le reste se règle sur les pages juste en dessous dans le menu : " +
      "Jeux & Lots (roue de la fortune ou carte à gratter, avec le curseur " +
      "de ratio de victoire de 0 à 100 %), Codes QR à imprimer sur vos tables, " +
      "Actions demandées au client, et Gagnants pour valider un lot au comptoir.",
  },

  // ── Email Marketing ────────────────────────────────────────────────
  {
    route: adminRoutes.email,
    navFor: adminRoutes.email,
    content:
      "Email Marketing — Tableau de bord avec vos KPIs (envois, ouvertures, clics). " +
      "Sous-pages : Campagnes (créer/planifier), Modèles (éditeur visuel par blocs), " +
      "Abonnés (import CSV, détail client), Segments (groupes ciblés) " +
      "et Configuration (expéditeur, domaine, DKIM).",
  },

  // ── CMS Pages ──────────────────────────────────────────────────────
  {
    route: adminRoutes.contentPages,
    navFor: adminRoutes.contentPages,
    content:
      "Pages — Créez et éditez les pages de votre site : accueil, à propos, " +
      "mentions légales, CGV… Un éditeur visuel simple, " +
      "sans aucune ligne de code à écrire. Publiez ou dépubliez en un clic.",
  },

  // ── Blog ───────────────────────────────────────────────────────────
  {
    route: adminRoutes.contentBlog,
    navFor: adminRoutes.contentBlog,
    content:
      "Blog — Publiez des articles pour attirer du trafic : recettes, coulisses, événements. " +
      "L'éditeur accepte le texte enrichi et les images. " +
      "L'option Auto Blog, qui rédige les articles pour vous, " +
      "fait partie des abonnements — l'écran vous dira si le vôtre l'inclut.",
  },

  // ── Media Library ──────────────────────────────────────────────────
  {
    route: adminRoutes.contentMedia,
    navFor: adminRoutes.contentMedia,
    content:
      "Médiathèque — Toutes vos images au même endroit ! " +
      "Photos de plats, logo, bannières… Glissez-déposez pour ajouter. " +
      "Les fichiers sont stockés sur votre espace AWS S3 privé, " +
      "et servis à vos visiteurs par votre site.",
  },

  // ── Design ─────────────────────────────────────────────────────────
  {
    route: adminRoutes.design,
    navFor: adminRoutes.design,
    content:
      "Design — Trois onglets : Couleurs, Typographie et Logo. " +
      "Vos couleurs et vos polices s'appliquent à votre site public — " +
      "l'aperçu montre le rendu avant d'enregistrer, et ce que vous laissez " +
      "tel quel garde l'apparence de votre modèle de design. " +
      "Une police ne s'affiche que si l'appareil du visiteur la possède ; " +
      "Inter et Poppins sont fournies et fonctionnent partout. " +
      "Le logo, lui, se règle dans Contenu › Pages, sur « Layout du " +
      "storefront ». Seul le propriétaire peut enregistrer ces réglages.",
  },

  // ── Stores ─────────────────────────────────────────────────────────
  {
    route: adminRoutes.stores,
    navFor: adminRoutes.stores,
    content:
      "Établissements — Créez et gérez un ou plusieurs restaurants. " +
      "Pour chaque établissement : nom, adresse (avec autocomplétion), " +
      "téléphone, email, statut. Sélection et actions en masse. " +
      "Basculez entre vos restaurants avec le sélecteur en haut de page.",
  },

  // ── Team ───────────────────────────────────────────────────────────
  {
    route: adminRoutes.team,
    navFor: adminRoutes.team,
    content:
      "Équipe & Rôles — Invitez vos collaborateurs par email et donnez à chacun " +
      "son rôle : Manager, Cuisine, Serveur ou Livreur. " +
      "Chaque rôle ouvre les écrans qui le concernent, et rien d'autre. " +
      "Filtrez par nom, statut (actif, en attente) ou rôle, " +
      "renvoyez une invitation ou désactivez un membre.",
  },

  // ── Languages ──────────────────────────────────────────────────────
  {
    route: adminRoutes.languages,
    navFor: adminRoutes.languages,
    content:
      "Langues — Ajoutez autant de langues que vous voulez ! " +
      "Tableau avec drapeau, code, nom et nom natif. " +
      "Définissez une langue par défaut, activez/désactivez chaque langue. " +
      "La traduction automatique par IA traduit toute votre carte, " +
      "pour environ 0,001 $ par produit.",
  },

  // ── Subscription ───────────────────────────────────────────────────
  {
    route: adminRoutes.subscription,
    navFor: adminRoutes.subscription,
    content:
      "Abonnement — Votre formule en un coup d'œil. " +
      "Consultez votre plan actuel, gérez votre facturation, " +
      "découvrez les fonctionnalités incluses et les options de mise à niveau.",
  },

  // ── Personal data (RGPD) ───────────────────────────────────────────
  {
    route: adminRoutes.privacy,
    navFor: adminRoutes.privacy,
    content:
      "Données personnelles — L'écran RGPD. Un client demande ses données ou " +
      "leur effacement : retrouvez-le par e-mail, lisez l'aperçu, puis exportez " +
      "ou effacez. Une commande payée est anonymisée et non supprimée — elle " +
      "reste votre pièce comptable. Vous fixez ici la durée de conservation ; " +
      "au-delà, le ménage se fait chaque nuit tout seul.",
  },

  // ── Settings ───────────────────────────────────────────────────────
  {
    route: adminRoutes.settings,
    navFor: adminRoutes.settings,
    content:
      "Paramètres — Plusieurs onglets de configuration : " +
      "informations du restaurant, horaires, options de livraison, " +
      "moyens de paiement (Stripe, SumUp, PayPal, espèces — Square arrive) " +
      "et intégrations. Votre logo se règle dans Contenu › Pages, sur " +
      "« Layout du storefront » : c'est de là que votre site, l'icône de " +
      "l'onglet et cet écran tirent tous le leur.",
  },

  // ── System ─────────────────────────────────────────────────────────
  {
    route: adminRoutes.system,
    navFor: adminRoutes.system,
    content:
      "Système & Mises à jour — Le tableau de bord technique : " +
      "état de votre site, version actuelle, mises à jour disponibles " +
      "et informations système. Réservé aux administrateurs.",
  },

  // ── End ────────────────────────────────────────────────────────────
  {
    route: adminRoutes.dashboard,
    anchor: "sidebar-brand",
    content:
      "La visite est terminée ! Vous connaissez maintenant les pages " +
      "auxquelles votre compte donne accès — un cuisinier et un livreur en " +
      "voient moins qu'un propriétaire, c'est voulu. " +
      "Explorez à votre rythme, et relancez cette visite quand vous voulez " +
      'avec "Revoir la visite", en bas du menu.',
    position: "right",
  },
]

// ─── Compilation ────────────────────────────────────────────────────

const at = (anchor: string): string => `[data-tour="${anchor}"]`

/** The single element a step spotlights. */
export function spotlightOf(spec: TourStepSpec): string {
  if (spec.anchor) return at(spec.anchor)
  if (spec.navFor) return at(navTourId(spec.navFor))
  throw new Error("a tour step must spotlight either an anchor or a nav entry")
}

function compile(spec: TourStepSpec): StepType {
  return {
    selector: spotlightOf(spec),
    content: spec.content,
    ...(spec.position ? { position: spec.position } : {}),
    ...(spec.route ? { action: goTo(spec.route) } : {}),
  }
}

export const TOUR_STEPS: StepType[] = TOUR_STEP_SPECS.map(compile)

/**
 * The steps a given role can actually be shown.
 *
 * The sidebar hides an entry whose `requiredPermission` the role lacks
 * (`app-sidebar.tsx`'s `canSeeEntry`), and every navigating step spotlights a
 * sidebar entry — so for a `kitchen` or `delivery` account, 18 of the 21
 * entries are absent and the tour would spend most of itself lighting up
 * nothing. Invitations hand out exactly those roles (`team-page.tsx`), so this
 * is not a hypothetical audience.
 */
export function tourStepsFor(canSee: (href: string) => boolean): StepType[] {
  return TOUR_STEP_SPECS.filter((spec) => !spec.navFor || canSee(spec.navFor)).map(compile)
}
