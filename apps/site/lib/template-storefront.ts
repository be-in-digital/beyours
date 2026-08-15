// Thème de storefront démo — dérive un vrai mini-site de commande, visitable et
// utilisable en plein écran, à partir d'un template du catalogue
// (lib/templates-data.ts).
//
// Un template porte son identité couleur (accent / accentDark) ; l'univers
// (pizzeria, fast-food, …) porte l'ambiance : humeur de fond, police, arrondi,
// carte complète, infos établissement. Les deux se combinent ici en un thème
// complet, appliqué au runtime via des variables CSS scopées sur le storefront.

import { Pizza, Beef, Sandwich, Drumstick, Soup, type LucideIcon } from "lucide-react";
import type { Category, Template } from "./templates-data";

/** Humeur de base : détermine fond, surfaces, encre, bordures. */
export type StorefrontMood = "paper" | "night" | "ink";

export interface MenuItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag?: string;
}

export interface MenuCategory {
  id: string;
  label: string;
  items: MenuItem[];
}

export interface StorefrontPalette {
  bg: string;
  surface: string;
  surface2: string;
  surfaceHi: string;
  ink: string;
  muted: string;
  border: string;
  /** voile posé sur la photo d'en-tête pour lisibilité du titre */
  headerOverlay: string;
}

interface UniversePreset {
  mood: StorefrontMood;
  /** variable CSS de police d'affichage (déclarée dans app/layout.tsx) */
  fontVar: string;
  radius: string;
  cuisine: string;
  city: string;
  tagline: string;
  address: string;
  hours: string;
  promises: string[];
  heroImage: string;
  icon: LucideIcon;
  menu: MenuCategory[];
}

export interface StorefrontTheme {
  // Établissement (fictif, dérivé du template)
  name: string;
  cuisine: string;
  city: string;
  slug: string;
  rating: string;
  tagline: string;
  address: string;
  hours: string;
  promises: string[];
  heroImage: string;
  // Apparence
  mood: StorefrontMood;
  fontVar: string;
  radius: string;
  accent: string;
  accentInk: string;
  palette: StorefrontPalette;
  // Contenu
  menu: MenuCategory[];
  icon: LucideIcon;
}

/** Palettes de base par humeur (le reste est teinté par l'accent du template). */
const MOODS: Record<StorefrontMood, StorefrontPalette> = {
  paper: {
    bg: "#faf5ee",
    surface: "#fffdf9",
    surface2: "#f3ead9",
    surfaceHi: "#e4d6bf",
    ink: "#221c15",
    muted: "#6f6456",
    border: "#e6d8c4",
    headerOverlay: "rgba(24, 16, 8, 0.55)",
  },
  night: {
    bg: "#16120c",
    surface: "#201a12",
    surface2: "#2b2318",
    surfaceHi: "#3b3021",
    ink: "#f6efe2",
    muted: "#aea28a",
    border: "rgba(255, 246, 232, 0.12)",
    headerOverlay: "rgba(0, 0, 0, 0.6)",
  },
  ink: {
    bg: "#f4f2ec",
    surface: "#ffffff",
    surface2: "#eae6dd",
    surfaceHi: "#dbd6ca",
    ink: "#181712",
    muted: "#6a665d",
    border: "#e2ded3",
    headerOverlay: "rgba(14, 14, 12, 0.55)",
  },
};

const UNIVERSES: Record<string, UniversePreset> = {
  pizzeria: {
    mood: "paper",
    fontVar: "--font-editorial",
    radius: "1rem",
    cuisine: "Pizza napolitaine",
    city: "Bordeaux",
    tagline: "Pâte maturée 48 h, four à bois, produits d'Italie.",
    address: "18 rue des Faussets, Bordeaux",
    hours: "Mar–Dim · 12h–14h30, 19h–22h30",
    promises: ["Livraison 30 min", "Click & Collect", "0 % commission"],
    heroImage: "/photos/salle-restaurant2.webp",
    icon: Pizza,
    menu: [
      {
        id: "pizze",
        label: "Pizze",
        items: [
          { id: "margherita", name: "Margherita DOP", desc: "San Marzano, fior di latte, basilic frais", price: 12.5, tag: "Signature" },
          { id: "regina", name: "Regina", desc: "Jambon cuit, champignons, mozzarella", price: 14 },
          { id: "diavola", name: "Diavola", desc: "Spianata piccante, miel, origan", price: 15, tag: "Épicé" },
          { id: "quattro", name: "Quattro Formaggi", desc: "Gorgonzola, parmesan, taleggio, mozzarella", price: 15.5 },
          { id: "burrata", name: "Burrata & San Daniele", desc: "Burrata des Pouilles, jambon 18 mois, roquette", price: 16.5, tag: "Signature" },
          { id: "ortolana", name: "Ortolana", desc: "Légumes grillés, pesto, sans viande", price: 13.5, tag: "Végé" },
        ],
      },
      {
        id: "antipasti",
        label: "Antipasti",
        items: [
          { id: "bruschetta", name: "Bruschetta pomodoro", desc: "Pain grillé, tomates, ail, basilic", price: 7 },
          { id: "arancini", name: "Arancini", desc: "Boulettes de risotto panées, cœur mozzarella", price: 8 },
          { id: "antipastimisti", name: "Antipasti misti", desc: "Charcuterie, fromages, légumes marinés", price: 12 },
        ],
      },
      {
        id: "dolci",
        label: "Dolci",
        items: [
          { id: "tiramisu", name: "Tiramisù maison", desc: "Mascarpone, café, cacao", price: 6.5, tag: "Signature" },
          { id: "pannacotta", name: "Panna cotta", desc: "Vanille, coulis fruits rouges", price: 6 },
          { id: "cannolo", name: "Cannolo sicilien", desc: "Ricotta, pistache, écorces d'orange", price: 5.5 },
        ],
      },
    ],
  },
  "fast-food": {
    mood: "night",
    fontVar: "--font-impact",
    radius: "0.5rem",
    cuisine: "Smash burgers",
    city: "Bordeaux",
    tagline: "Bœuf français smashé minute, jamais avant la commande.",
    address: "5 cours de l'Intendance, Bordeaux",
    hours: "Lun–Dim · 11h30–23h",
    promises: ["Livraison 30 min", "Click & Collect", "0 % commission"],
    heroImage: "/photos/burger-premium.webp",
    icon: Beef,
    menu: [
      {
        id: "burgers",
        label: "Burgers",
        items: [
          { id: "smash", name: "Smash simple", desc: "Bœuf smashé, cheddar, oignon, sauce maison", price: 9 },
          { id: "double", name: "Double smash", desc: "Deux galettes, double cheddar, pickles", price: 13, tag: "Signature" },
          { id: "fermier", name: "Le Fermier", desc: "Bœuf, comté, oignons confits, roquette", price: 14 },
          { id: "bacon", name: "Cheese Bacon", desc: "Cheddar, bacon fumé, sauce BBQ", price: 12 },
          { id: "crispy", name: "Chicken Crispy", desc: "Poulet pané, cheddar, coleslaw", price: 11 },
          { id: "vege", name: "Végé Smash", desc: "Galette végétale, cheddar, sauce herbes", price: 11, tag: "Végé" },
        ],
      },
      {
        id: "sides",
        label: "Sides",
        items: [
          { id: "frites", name: "Frites maison", desc: "Coupe fraîche, sel de céleri", price: 4.5 },
          { id: "cheesefries", name: "Frites cheddar", desc: "Cheddar fondu, oignons croustillants", price: 6 },
          { id: "onion", name: "Onion rings", desc: "Rondelles d'oignon panées", price: 5 },
          { id: "coleslaw", name: "Coleslaw", desc: "Chou croquant, sauce légère", price: 3.5 },
        ],
      },
      {
        id: "shakes",
        label: "Shakes",
        items: [
          { id: "vanille", name: "Milkshake vanille", desc: "Glace fermière, chantilly", price: 5.5 },
          { id: "choco", name: "Shake chocolat", desc: "Chocolat noir, éclats de cacao", price: 5.5 },
          { id: "caramel", name: "Shake caramel beurre salé", desc: "Caramel maison, fleur de sel", price: 6, tag: "Signature" },
        ],
      },
    ],
  },
  "food-truck": {
    mood: "ink",
    fontVar: "--font-condensed",
    radius: "0.65rem",
    cuisine: "Street food",
    city: "Bordeaux",
    tagline: "Carte courte qui bouge, produits frais du marché.",
    address: "Place des Quinconces, Bordeaux",
    hours: "Mer–Sam · 11h30–14h30, 18h–22h",
    promises: ["Click & Collect", "Sur place", "0 % commission"],
    heroImage: "/photos/chef-flammes.webp",
    icon: Sandwich,
    menu: [
      {
        id: "street",
        label: "Street",
        items: [
          { id: "tacos", name: "Tacos signature", desc: "Bœuf effiloché, cheddar, sauce fumée", price: 10, tag: "Signature" },
          { id: "burrito", name: "Burrito bœuf", desc: "Riz, haricots, bœuf mariné, guacamole", price: 11 },
          { id: "quesadilla", name: "Quesadilla", desc: "Poulet, cheddar, poivrons", price: 9 },
          { id: "bao", name: "Bao croustillant", desc: "Porc laqué, pickles, cacahuète", price: 8 },
        ],
      },
      {
        id: "bowls",
        label: "Bowls",
        items: [
          { id: "teriyaki", name: "Bowl poulet teriyaki", desc: "Riz, poulet grillé, edamame, sésame", price: 11 },
          { id: "poke", name: "Poke saumon", desc: "Saumon mariné, avocat, mangue", price: 13, tag: "Signature" },
          { id: "vegebowl", name: "Bowl végé", desc: "Céréales, légumes rôtis, houmous", price: 10, tag: "Végé" },
          { id: "dujour", name: "Bowl du jour", desc: "La création du chef, ardoise", price: 11 },
        ],
      },
      {
        id: "boissons",
        label: "Boissons",
        items: [
          { id: "limonade", name: "Limonade maison", desc: "Citron pressé, menthe fraîche", price: 4 },
          { id: "theglace", name: "Thé glacé", desc: "Infusion pêche-hibiscus", price: 3.5 },
          { id: "soda", name: "Soda artisanal", desc: "Gingembre ou cola bio", price: 3.5 },
        ],
      },
    ],
  },
  poulet: {
    mood: "paper",
    fontVar: "--font-display",
    radius: "1.2rem",
    cuisine: "Rôtisserie",
    city: "Bordeaux",
    tagline: "Poulet fermier Label Rouge rôti à la broche, toute la journée.",
    address: "24 rue Sainte-Catherine, Bordeaux",
    hours: "Mar–Dim · 11h–15h, 18h–22h",
    promises: ["Livraison 30 min", "Click & Collect", "0 % commission"],
    heroImage: "/photos/chef-flammes.webp",
    icon: Drumstick,
    menu: [
      {
        id: "poulet",
        label: "Poulet",
        items: [
          { id: "demipoulet", name: "Demi-poulet rôti", desc: "Fermier Label Rouge, jus corsé", price: 13, tag: "Signature" },
          { id: "quart", name: "Quart de poulet", desc: "Cuisse ou blanc, au choix", price: 8 },
          { id: "tenders", name: "Tenders croustillants", desc: "Panure maison, sauce ranch", price: 11 },
          { id: "wings", name: "Wings x8", desc: "Ailes marinées, sauce piquante", price: 10, tag: "Épicé" },
          { id: "grille", name: "Poulet grillé", desc: "Marinade citron-thym, salade", price: 12 },
        ],
      },
      {
        id: "partager",
        label: "À partager",
        items: [
          { id: "bucket", name: "Bucket famille", desc: "Poulet, frites, coleslaw pour 3", price: 24, tag: "Signature" },
          { id: "plateau", name: "Plateau mixte", desc: "Rôti, tenders, wings, sides", price: 28 },
          { id: "nuggets", name: "Nuggets x12", desc: "Poulet fermier pané, 2 sauces", price: 9 },
        ],
      },
      {
        id: "sides",
        label: "Sides",
        items: [
          { id: "frites", name: "Frites maison", desc: "Coupe fraîche, sel de céleri", price: 4 },
          { id: "puree", name: "Purée maison", desc: "Pommes de terre, beurre fermier", price: 4.5 },
          { id: "coleslaw", name: "Coleslaw", desc: "Chou croquant, sauce légère", price: 4 },
          { id: "mais", name: "Épi de maïs grillé", desc: "Beurre demi-sel", price: 3.5 },
        ],
      },
    ],
  },
  asiatique: {
    mood: "ink",
    fontVar: "--font-zen",
    radius: "0.35rem",
    cuisine: "Izakaya",
    city: "Bordeaux",
    tagline: "Comptoir contemporain — ramen, bouchées et petites assiettes.",
    address: "9 rue du Pas-Saint-Georges, Bordeaux",
    hours: "Mar–Sam · 12h–14h, 19h–22h30",
    promises: ["Livraison 30 min", "Click & Collect", "0 % commission"],
    heroImage: "/photos/plat-gastronomie.webp",
    icon: Soup,
    menu: [
      {
        id: "comptoir",
        label: "Comptoir",
        items: [
          { id: "gyoza", name: "Gyoza maison x6", desc: "Porc & gingembre, sauce ponzu", price: 7 },
          { id: "edamame", name: "Edamame", desc: "Fèves de soja, sel de mer", price: 5, tag: "Végé" },
          { id: "bao", name: "Bao porc croustillant", desc: "Porc laqué, pickles, cacahuète", price: 9, tag: "Signature" },
          { id: "tataki", name: "Tataki de thon", desc: "Thon mi-cuit, sésame, sauce yuzu", price: 12 },
          { id: "california", name: "California roll x8", desc: "Surimi, avocat, concombre", price: 10 },
        ],
      },
      {
        id: "ramen",
        label: "Ramen",
        items: [
          { id: "shoyu", name: "Ramen shoyu", desc: "Bouillon 12 h, chashu, œuf mariné", price: 14 },
          { id: "tonkotsu", name: "Ramen tonkotsu", desc: "Bouillon porc crémeux, chashu", price: 15, tag: "Signature" },
          { id: "vegeramen", name: "Ramen végé", desc: "Bouillon miso, tofu, légumes", price: 13, tag: "Végé" },
          { id: "udon", name: "Udon sauté", desc: "Nouilles épaisses, wok de légumes", price: 13 },
        ],
      },
      {
        id: "desserts",
        label: "Desserts",
        items: [
          { id: "mochi", name: "Mochi glacé x3", desc: "Matcha, mangue, sésame noir", price: 6 },
          { id: "cheesecake", name: "Cheesecake matcha", desc: "Thé vert, biscuit sablé", price: 6.5, tag: "Signature" },
          { id: "dorayaki", name: "Dorayaki", desc: "Pancake fourré à la pâte de haricot rouge", price: 5 },
        ],
      },
    ],
  },
};

const FALLBACK: UniversePreset = UNIVERSES.pizzeria!;

/**
 * Encre lisible sur une couleur d'accent : texte sombre si l'accent est clair,
 * blanc sinon. Parse la luminosité d'une chaîne `hsl(H S% L%)` ou renvoie blanc.
 */
function readableInk(color: string): string {
  const nums = color.match(/\d+(?:\.\d+)?/g);
  const lRaw = nums?.[2];
  if (!lRaw) return "#ffffff";
  const lightness = parseFloat(lRaw);
  return lightness >= 62 ? "#1b1712" : "#ffffff";
}

/**
 * Combine un template (identité couleur) et sa catégorie (univers) en un thème
 * complet, prêt à peindre le storefront démo.
 */
export function resolveStorefrontTheme(
  template: Template,
  category: Category,
): StorefrontTheme {
  const preset = UNIVERSES[category.id] ?? FALLBACK;
  // En humeur nuit, l'accent clair (accentDark) ressort mieux sur fond sombre.
  const accent = preset.mood === "night" ? template.accentDark : template.accent;

  return {
    name: template.name,
    cuisine: preset.cuisine,
    city: preset.city,
    slug: template.slug,
    rating: "4,9",
    tagline: preset.tagline,
    address: preset.address,
    hours: preset.hours,
    promises: preset.promises,
    heroImage: preset.heroImage,
    mood: preset.mood,
    fontVar: preset.fontVar,
    radius: preset.radius,
    accent,
    accentInk: readableInk(accent),
    palette: MOODS[preset.mood],
    menu: preset.menu,
    icon: preset.icon,
  };
}

/** Tous les plats à plat (utilitaire : mises en avant, recherche d'un item). */
export function flattenMenu(menu: MenuCategory[]): MenuItem[] {
  return menu.flatMap((c) => c.items);
}
