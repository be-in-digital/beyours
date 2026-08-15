// ⚙️ Catalogue de templates — généré depuis le boilerplate
// (beindigital-boilerplate · demos/assets/themes.js). Captures : public/templates/shots/.

export interface Template {
  slug: string;
  name: string;
  tagline: string;
  /** couleur d'accent du template (thème clair) */
  accent: string;
  /** couleur d'accent du template (thème sombre) */
  accentDark: string;
  /** capture d'écran du template */
  shot: string;
}

export interface Category {
  id: string;
  label: string;
  description: string;
  /** couleur représentative de la catégorie */
  accent: string;
  templates: Template[];
}

export const categories: Category[] = [
  {
    id: "pizzeria",
    label: "Pizzeria",
    description: "Four à bois, terracotta et tradition napolitaine — de la trattoria familiale à l’éditorial contemporain.",
    accent: "#c5542c",
    templates: [
      { slug: "pizzeria-trattoria", name: "Trattoria", tagline: "Napolitaine au feu de bois", accent: "hsl(14 68% 44%)", accentDark: "hsl(15 74% 58%)", shot: "/templates/shots/pizzeria-trattoria.jpg" },
      { slug: "pizzeria-verace", name: "Verace", tagline: "Pizza napolitaine, basta", accent: "hsl(145 45% 26%)", accentDark: "hsl(140 35% 55%)", shot: "/templates/shots/pizzeria-verace.jpg" },
      { slug: "pizzeria-fornonero", name: "Forno Nero", tagline: "Braise, cendre et farine", accent: "hsl(24 90% 36%)", accentDark: "hsl(28 92% 54%)", shot: "/templates/shots/pizzeria-fornonero.jpg" },
      { slug: "pizzeria-milano", name: "Milano", tagline: "Éditoriale, comme un magazine", accent: "hsl(352 78% 40%)", accentDark: "hsl(352 75% 61%)", shot: "/templates/shots/pizzeria-milano.jpg" },
      { slug: "pizzeria-golfo", name: "Golfo", tagline: "La côte amalfitaine à table", accent: "hsl(210 65% 38%)", accentDark: "hsl(205 60% 55%)", shot: "/templates/shots/pizzeria-golfo.jpg" },
      { slug: "pizzeria-rustica", name: "Rustica", tagline: "Pizzeria de campagne", accent: "hsl(18 55% 38%)", accentDark: "hsl(20 60% 55%)", shot: "/templates/shots/pizzeria-rustica.jpg" },
      { slug: "pizzeria-doppiozero", name: "Doppio Zero", tagline: "Farine 00, design 0 fioriture", accent: "hsl(240 8% 12%)", accentDark: "hsl(4 78% 58%)", shot: "/templates/shots/pizzeria-doppiozero.jpg" },
      { slug: "pizzeria-vesuvio", name: "Vesuvio", tagline: "La pizza qui gronde", accent: "hsl(0 78% 44%)", accentDark: "hsl(0 80% 58%)", shot: "/templates/shots/pizzeria-vesuvio.jpg" },
      { slug: "pizzeria-basilico", name: "Basilico", tagline: "Verte, fraîche, végétale", accent: "hsl(120 40% 30%)", accentDark: "hsl(110 35% 52%)", shot: "/templates/shots/pizzeria-basilico.jpg" },
      { slug: "pizzeria-notte", name: "Notte", tagline: "La part de nuit", accent: "hsl(262 60% 45%)", accentDark: "hsl(265 70% 68%)", shot: "/templates/shots/pizzeria-notte.jpg" },
    ],
  },
  {
    id: "fast-food",
    label: "Fast-food",
    description: "Smash burgers et énergie brute — de la moutarde sur charbon au diner américain.",
    accent: "#d98324",
    templates: [
      { slug: "fast-food-smash", name: "Smash", tagline: "Smashé minute, jamais avant", accent: "hsl(40 18% 11%)", accentDark: "hsl(42 96% 54%)", shot: "/templates/shots/fast-food-smash.jpg" },
      { slug: "fast-food-dinerclassic", name: "Diner 56", tagline: "Le diner américain, version 2026", accent: "hsl(350 75% 45%)", accentDark: "hsl(350 80% 60%)", shot: "/templates/shots/fast-food-dinerclassic.jpg" },
      { slug: "fast-food-grill77", name: "Grill 77", tagline: "Charbon, flamme, point.", accent: "hsl(20 85% 36%)", accentDark: "hsl(22 88% 52%)", shot: "/templates/shots/fast-food-grill77.jpg" },
      { slug: "fast-food-verte", name: "La Verte", tagline: "Fast-food, bonne conscience", accent: "hsl(150 45% 30%)", accentDark: "hsl(140 40% 52%)", shot: "/templates/shots/fast-food-verte.jpg" },
      { slug: "fast-food-boxx", name: "BOXX", tagline: "Burgers en boîte, design en briques", accent: "hsl(0 0% 9%)", accentDark: "hsl(52 96% 56%)", shot: "/templates/shots/fast-food-boxx.jpg" },
      { slug: "fast-food-minuit", name: "Minuit", tagline: "Le burger d'après la fête", accent: "hsl(270 60% 48%)", accentDark: "hsl(275 75% 70%)", shot: "/templates/shots/fast-food-minuit.jpg" },
      { slug: "fast-food-fermier", name: "Le Fermier", tagline: "Du champ au bun", accent: "hsl(355 55% 40%)", accentDark: "hsl(355 60% 59%)", shot: "/templates/shots/fast-food-fermier.jpg" },
      { slug: "fast-food-stacked", name: "Stacked", tagline: "Le burger en une", accent: "hsl(220 90% 50%)", accentDark: "hsl(215 90% 62%)", shot: "/templates/shots/fast-food-stacked.jpg" },
      { slug: "fast-food-drivein", name: "Drive-In", tagline: "Commande roulante depuis 1987", accent: "hsl(205 80% 40%)", accentDark: "hsl(203 75% 55%)", shot: "/templates/shots/fast-food-drivein.jpg" },
      { slug: "fast-food-prime", name: "Prime", tagline: "Le burger de boucher", accent: "hsl(30 45% 32%)", accentDark: "hsl(38 55% 55%)", shot: "/templates/shots/fast-food-prime.jpg" },
    ],
  },
  {
    id: "food-truck",
    label: "Food truck",
    description: "Street craft nomade — pétrole émaillé, kraft et cartes courtes qui bougent avec vous.",
    accent: "#2f7d78",
    templates: [
      { slug: "food-truck-convoi", name: "Convoi", tagline: "Street craft, carte courte", accent: "hsl(192 62% 27%)", accentDark: "hsl(189 55% 47%)", shot: "/templates/shots/food-truck-convoi.jpg" },
      { slug: "food-truck-routier", name: "Le Routier", tagline: "Relais moderne, portions d'époque", accent: "hsl(215 60% 30%)", accentDark: "hsl(212 55% 52%)", shot: "/templates/shots/food-truck-routier.jpg" },
      { slug: "food-truck-tacoloco", name: "Taco Loco", tagline: "Street tacos, vraie salsa", accent: "hsl(325 75% 45%)", accentDark: "hsl(325 80% 60%)", shot: "/templates/shots/food-truck-tacoloco.jpg" },
      { slug: "food-truck-seoulstreet", name: "Seoul Street", tagline: "Corée de rue, feu doux et gochujang", accent: "hsl(350 85% 46%)", accentDark: "hsl(350 90% 60%)", shot: "/templates/shots/food-truck-seoulstreet.jpg" },
      { slug: "food-truck-greenwheels", name: "Green Wheels", tagline: "Camion 100 % végétal", accent: "hsl(15 72% 42%)", accentDark: "hsl(18 75% 62%)", shot: "/templates/shots/food-truck-greenwheels.jpg" },
      { slug: "food-truck-braisenroute", name: "Braise en Route", tagline: "BBQ fumé, remorque noire", accent: "hsl(15 70% 40%)", accentDark: "hsl(18 80% 52%)", shot: "/templates/shots/food-truck-braisenroute.jpg" },
      { slug: "food-truck-lamarina", name: "La Marina", tagline: "La mer au bord du trottoir", accent: "hsl(210 70% 35%)", accentDark: "hsl(200 65% 55%)", shot: "/templates/shots/food-truck-lamarina.jpg" },
      { slug: "food-truck-pitstop", name: "Pit Stop", tagline: "Ravitaillement express", accent: "hsl(0 85% 45%)", accentDark: "hsl(0 88% 55%)", shot: "/templates/shots/food-truck-pitstop.jpg" },
      { slug: "food-truck-boheme", name: "Bohème", tagline: "Le van qui suit le soleil", accent: "hsl(335 55% 44%)", accentDark: "hsl(335 60% 65%)", shot: "/templates/shots/food-truck-boheme.jpg" },
      { slug: "food-truck-nordique", name: "Nordique", tagline: "Camion scandinave, pain noir", accent: "hsl(170 35% 32%)", accentDark: "hsl(168 32% 52%)", shot: "/templates/shots/food-truck-nordique.jpg" },
    ],
  },
  {
    id: "poulet",
    label: "Poulet",
    description: "Rôtisserie urbaine — braise, piment et crème, du fermier chic au fried coréen.",
    accent: "#c0392b",
    templates: [
      { slug: "poulet-braise", name: "Braise", tagline: "Rôtisserie urbaine", accent: "hsl(355 70% 42%)", accentDark: "hsl(355 70% 50%)", shot: "/templates/shots/poulet-braise.jpg" },
      { slug: "poulet-coqdor", name: "Coq d'Or", tagline: "Rôtisserie de quartier depuis 1962", accent: "hsl(150 40% 26%)", accentDark: "hsl(45 60% 52%)", shot: "/templates/shots/poulet-coqdor.jpg" },
      { slug: "poulet-krispy", name: "Krispy Krush", tagline: "Croustillant niveau maximal", accent: "hsl(26 90% 38%)", accentDark: "hsl(35 95% 58%)", shot: "/templates/shots/poulet-krispy.jpg" },
      { slug: "poulet-seoulfried", name: "Seoul Fried", tagline: "K-chicken, double friture", accent: "hsl(348 80% 47%)", accentDark: "hsl(348 85% 60%)", shot: "/templates/shots/poulet-seoulfried.jpg" },
      { slug: "poulet-fermierchic", name: "Le Fermier", tagline: "Élevé dehors, rôti dedans", accent: "hsl(95 40% 30%)", accentDark: "hsl(90 35% 50%)", shot: "/templates/shots/poulet-fermierchic.jpg" },
      { slug: "poulet-piriwest", name: "Piri West", tagline: "Piri-piri braise et citron", accent: "hsl(8 80% 46%)", accentDark: "hsl(8 85% 55%)", shot: "/templates/shots/poulet-piriwest.jpg" },
      { slug: "poulet-bouillon", name: "Le Bouillon", tagline: "Poule au pot et volailles rôties", accent: "hsl(355 60% 34%)", accentDark: "hsl(355 55% 58%)", shot: "/templates/shots/poulet-bouillon.jpg" },
      { slug: "poulet-wingsclub", name: "Wings Club", tagline: "Le club des ailes, match compris", accent: "hsl(222 65% 35%)", accentDark: "hsl(38 90% 55%)", shot: "/templates/shots/poulet-wingsclub.jpg" },
      { slug: "poulet-hotcluck", name: "Hot Cluck", tagline: "Nashville hot, version béton", accent: "hsl(14 90% 38%)", accentDark: "hsl(14 92% 55%)", shot: "/templates/shots/poulet-hotcluck.jpg" },
      { slug: "poulet-dimanche", name: "Dimanche", tagline: "Le repas qui rassemble", accent: "hsl(340 45% 45%)", accentDark: "hsl(340 50% 62%)", shot: "/templates/shots/poulet-dimanche.jpg" },
    ],
  },
  {
    id: "asiatique",
    label: "Asiatique",
    description: "Izakaya contemporain — jade, encre et washi, du ramen au comptoir omakase.",
    accent: "#3f7d5c",
    templates: [
      { slug: "asiatique-izakaya", name: "Izakaya", tagline: "Izakaya contemporain", accent: "hsl(168 46% 27%)", accentDark: "hsl(166 42% 46%)", shot: "/templates/shots/asiatique-izakaya.jpg" },
      { slug: "asiatique-wokstreet", name: "Wok Street", tagline: "Feu vif, wok qui claque", accent: "hsl(16 85% 41%)", accentDark: "hsl(16 90% 58%)", shot: "/templates/shots/asiatique-wokstreet.jpg" },
      { slug: "asiatique-bambou", name: "Bambou", tagline: "Vapeur douce, bambou frais", accent: "hsl(140 45% 30%)", accentDark: "hsl(135 40% 50%)", shot: "/templates/shots/asiatique-bambou.jpg" },
      { slug: "asiatique-tokyonight", name: "Tokyo Night", tagline: "Ramen bar de minuit", accent: "hsl(355 85% 45%)", accentDark: "hsl(355 90% 62%)", shot: "/templates/shots/asiatique-tokyonight.jpg" },
      { slug: "asiatique-hanoi", name: "Hanoï", tagline: "Bols et baguettes d'Indochine", accent: "hsl(170 45% 28%)", accentDark: "hsl(168 40% 48%)", shot: "/templates/shots/asiatique-hanoi.jpg" },
      { slug: "asiatique-sichuan", name: "Sichuan", tagline: "Poivre qui engourdit, feu qui réveille", accent: "hsl(0 82% 45%)", accentDark: "hsl(0 85% 57%)", shot: "/templates/shots/asiatique-sichuan.jpg" },
      { slug: "asiatique-matcha", name: "Matcha", tagline: "Salon de thé et petites assiettes", accent: "hsl(88 30% 34%)", accentDark: "hsl(88 28% 52%)", shot: "/templates/shots/asiatique-matcha.jpg" },
      { slug: "asiatique-dragon", name: "Dragon", tagline: "Banquet cantonais, laque et or", accent: "hsl(42 70% 40%)", accentDark: "hsl(42 80% 55%)", shot: "/templates/shots/asiatique-dragon.jpg" },
      { slug: "asiatique-banhmi", name: "Bánh Mì Club", tagline: "Baguette croustillante, cœur vietnamien", accent: "hsl(95 55% 32%)", accentDark: "hsl(90 50% 48%)", shot: "/templates/shots/asiatique-banhmi.jpg" },
      { slug: "asiatique-omakase", name: "Omakase", tagline: "On vous laisse choisir pour vous", accent: "hsl(220 15% 14%)", accentDark: "hsl(36 45% 62%)", shot: "/templates/shots/asiatique-omakase.jpg" },
    ],
  },
];

export const totalTemplates = categories.reduce((n, c) => n + c.templates.length, 0);

export function findTemplateBySlug(slug: string): { category: Category; template: Template } | null {
  for (const category of categories) {
    const template = category.templates.find((t) => t.slug === slug);
    if (template) return { category, template };
  }
  return null;
}

export function getAllTemplateSlugs(): string[] {
  return categories.flatMap((c) => c.templates.map((t) => t.slug));
}
