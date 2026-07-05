export interface Template {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  hero: {
    title: string;
    subtitle: string;
  };
  menu: {
    categories: {
      name: string;
      items: { name: string; description: string; price: string }[];
    }[];
  };
  accent: string;
}

export interface Category {
  id: string;
  label: string;
  iconPath: string;
  description: string;
  color: string;
  templates: Template[];
}

export const categories: Category[] = [
  {
    id: "pizzeria",
    label: "Pizzeria",
    iconPath:
      "M15 11h.01M11 15h.01M16 16h.01 M2 16l20-12-6 18-4-4-10-2Z",
    description: "Sites chaleureux avec l'ambiance italienne authentique",
    color: "rgba(239, 108, 77, 0.8)",
    templates: [
      {
        name: "Napoli",
        slug: "pizzeria-napoli",
        description: "Design chaleureux, four a bois, tradition italienne",
        tags: ["Menu interactif", "Reservation", "Livraison"],
        hero: {
          title: "La vraie pizza napolitaine",
          subtitle:
            "Decouvrez nos pizzas artisanales cuites au feu de bois, preparees avec des ingredients importes d'Italie.",
        },
        menu: {
          categories: [
            {
              name: "Pizzas Classiques",
              items: [
                { name: "Margherita", description: "Tomate San Marzano, mozzarella di bufala, basilic frais", price: "12,90" },
                { name: "Diavola", description: "Tomate, mozzarella, salami piquant, piment", price: "14,50" },
                { name: "Quattro Formaggi", description: "Mozzarella, gorgonzola, parmesan, taleggio", price: "15,90" },
              ],
            },
            {
              name: "Pizzas Gourmandes",
              items: [
                { name: "Truffe & Burrata", description: "Creme de truffe, burrata, roquette, parmesan", price: "18,90" },
                { name: "Calzone Ricotta", description: "Ricotta, jambon cuit, champignons, mozzarella", price: "16,50" },
              ],
            },
          ],
        },
        accent: "#EF6C4D",
      },
      {
        name: "Romana",
        slug: "pizzeria-romana",
        description: "Style contemporain, pizza gourmet, raffinement",
        tags: ["Carte en ligne", "Click & Collect", "Fidelite"],
        hero: {
          title: "Pizza gourmet, esprit moderne",
          subtitle:
            "Une cuisine italienne revisitee avec des produits d'exception, dans un cadre contemporain.",
        },
        menu: {
          categories: [
            {
              name: "Antipasti",
              items: [
                { name: "Bruschetta al Pomodoro", description: "Pain grille, tomates cerises, ail, basilic", price: "8,90" },
                { name: "Carpaccio di Manzo", description: "Boeuf, roquette, copeaux de parmesan, huile de truffe", price: "14,90" },
              ],
            },
            {
              name: "Pizzas Signature",
              items: [
                { name: "La Romana", description: "Creme d'artichaut, prosciutto di Parma, roquette", price: "17,50" },
                { name: "Tartufo Nero", description: "Creme de truffe noire, champignons, stracchino", price: "19,90" },
                { name: "Vegetariana", description: "Courgettes grillees, aubergine, poivrons, mozzarella", price: "15,90" },
              ],
            },
          ],
        },
        accent: "#D4845A",
      },
      {
        name: "Margherita",
        slug: "pizzeria-margherita",
        description: "Esprit trattoria familiale, convivialite",
        tags: ["Menu du jour", "Avis clients", "Galerie"],
        hero: {
          title: "La trattoria du quartier",
          subtitle:
            "Un lieu de partage ou la generosite italienne rencontre la chaleur familiale.",
        },
        menu: {
          categories: [
            {
              name: "Entrees",
              items: [
                { name: "Minestrone", description: "Soupe de legumes a l'italienne, parmesan", price: "7,50" },
                { name: "Arancini", description: "Boulettes de risotto frites, sauce tomate", price: "9,90" },
              ],
            },
            {
              name: "Pizzas Famille",
              items: [
                { name: "Regina", description: "Tomate, mozzarella, jambon, champignons, olives", price: "13,90" },
                { name: "Capricciosa", description: "Artichaut, jambon, champignons, olives, mozzarella", price: "14,90" },
                { name: "Bambino", description: "Tomate, mozzarella — pour les enfants", price: "8,90" },
              ],
            },
          ],
        },
        accent: "#E8A15E",
      },
    ],
  },
  {
    id: "fast-food",
    label: "Fast Food",
    iconPath:
      "M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z M6 17h12",
    description: "Templates rapides et punchy pour la restauration rapide",
    color: "rgba(251, 191, 36, 0.8)",
    templates: [
      {
        name: "Express",
        slug: "fast-food-express",
        description: "Commande rapide, interface dynamique et coloree",
        tags: ["Commande en ligne", "Panier", "Promo"],
        hero: {
          title: "Commandez en 30 secondes",
          subtitle: "Des burgers genereux, des frites croustillantes et un service ultra-rapide.",
        },
        menu: {
          categories: [
            {
              name: "Burgers",
              items: [
                { name: "Classic Burger", description: "Steak hache, cheddar, salade, tomate, sauce maison", price: "9,90" },
                { name: "Double Smash", description: "Double steak, double cheddar, oignons caramelises", price: "12,90" },
                { name: "Chicken Crispy", description: "Poulet pane, coleslaw, sauce epicee", price: "10,90" },
              ],
            },
            {
              name: "Sides",
              items: [
                { name: "Frites Maison", description: "Fraiches, croustillantes, sel de Guerande", price: "3,90" },
                { name: "Nuggets x6", description: "Poulet pane, sauce au choix", price: "5,90" },
              ],
            },
          ],
        },
        accent: "#FBBF24",
      },
      {
        name: "Street",
        slug: "fast-food-street",
        description: "Vibes urbaines, street food attitude",
        tags: ["Menu visuel", "Livraison", "Combos"],
        hero: {
          title: "Street food sans limites",
          subtitle: "L'energie de la rue dans votre assiette. Bold, genereux, addictif.",
        },
        menu: {
          categories: [
            {
              name: "Street Bowls",
              items: [
                { name: "Loaded Fries", description: "Frites, cheddar fondu, bacon, jalapenos", price: "11,90" },
                { name: "Rice Bowl BBQ", description: "Riz, poulet BBQ, mais grille, coriandre", price: "12,90" },
              ],
            },
            {
              name: "Wraps & Tacos",
              items: [
                { name: "Wrap Crispy", description: "Poulet croustillant, avocat, sauce ranch", price: "10,50" },
                { name: "Tacos x3", description: "Boeuf marine, pico de gallo, creme fraiche", price: "11,90" },
                { name: "Quesadilla", description: "Fromage, poulet, poivrons grilles", price: "10,90" },
              ],
            },
          ],
        },
        accent: "#FB923C",
      },
      {
        name: "Smash",
        slug: "fast-food-smash",
        description: "Design bold, smash burgers & sides premium",
        tags: ["Personnalisation", "Loyalty", "QR code"],
        hero: {
          title: "Le smash burger premium",
          subtitle: "Viande ecrasee sur la plancha, croute caramelisee, gout intense.",
        },
        menu: {
          categories: [
            {
              name: "Smash Burgers",
              items: [
                { name: "Single Smash", description: "Steak smashe, american cheese, pickles, sauce smash", price: "10,90" },
                { name: "Double Smash", description: "Double steak smashe, double cheese, oignons crispy", price: "13,90" },
                { name: "Truffle Smash", description: "Steak smashe, comte, mayo truffe, roquette", price: "15,90" },
              ],
            },
            {
              name: "Desserts",
              items: [
                { name: "Cookie Dough Shake", description: "Milkshake vanille, pate a cookie, chantilly", price: "6,90" },
                { name: "Brownie", description: "Chocolat noir fondant, noix de pecan", price: "4,90" },
              ],
            },
          ],
        },
        accent: "#EF4444",
      },
    ],
  },
  {
    id: "asiatique",
    label: "Asiatique",
    iconPath: "M9 2L4 22 M15 2L10 22",
    description: "Elegance et zen pour la cuisine asiatique",
    color: "rgba(244, 114, 182, 0.8)",
    templates: [
      {
        name: "Sakura",
        slug: "asiatique-sakura",
        description: "Esthetique japonaise epuree, sushi bar",
        tags: ["Menu illustre", "Reservation", "Takeaway"],
        hero: {
          title: "L'art du sushi authentique",
          subtitle: "Des poissons selectionnes chaque matin au marche, prepares devant vous par nos maitres sushi.",
        },
        menu: {
          categories: [
            {
              name: "Sushi & Sashimi",
              items: [
                { name: "Assortiment 12 pieces", description: "Saumon, thon, crevette, daurade — nigiri & maki", price: "18,90" },
                { name: "Sashimi Premium", description: "Thon rouge, saumon sauvage, hamachi — 15 pieces", price: "24,90" },
                { name: "California Roll", description: "Avocat, surimi, concombre, sesame", price: "12,90" },
              ],
            },
            {
              name: "Plats Chauds",
              items: [
                { name: "Ramen Tonkotsu", description: "Bouillon porc 12h, chashu, oeuf mollet, nori", price: "15,90" },
                { name: "Gyoza x6", description: "Raviolis porc et ciboulette, sauce ponzu", price: "8,90" },
              ],
            },
          ],
        },
        accent: "#F472B6",
      },
      {
        name: "Wok",
        slug: "asiatique-wok",
        description: "Energie du wok, noodles & stir-fry",
        tags: ["Commande rapide", "Formules", "Livraison"],
        hero: {
          title: "Le feu du wok",
          subtitle: "Des saveurs intenses, sautees a haute temperature, servies en un eclair.",
        },
        menu: {
          categories: [
            {
              name: "Wok Signature",
              items: [
                { name: "Pad Thai", description: "Nouilles de riz, crevettes, cacahuetes, citron vert", price: "14,90" },
                { name: "Boeuf Saute Basilic Thai", description: "Boeuf, basilic sacre, piment, haricots verts", price: "15,90" },
                { name: "Nouilles Sautees Legumes", description: "Nouilles egg, brocoli, champignons, sauce soja", price: "12,90" },
              ],
            },
            {
              name: "Entrees",
              items: [
                { name: "Rouleaux de Printemps x4", description: "Crevette, menthe, vermicelles, sauce nuoc-mam", price: "8,90" },
                { name: "Soupe Tom Yum", description: "Crevettes, citronnelle, galanga, kaffir", price: "9,90" },
              ],
            },
          ],
        },
        accent: "#FB7185",
      },
      {
        name: "Dragon",
        slug: "asiatique-dragon",
        description: "Design premium, dim sum & gastronomie chinoise",
        tags: ["Menu degustation", "Banquet", "Carte des thes"],
        hero: {
          title: "Gastronomie du Dragon",
          subtitle: "Dim sum d'exception, canard laque et thes rares dans un cadre imperial.",
        },
        menu: {
          categories: [
            {
              name: "Dim Sum",
              items: [
                { name: "Ha Gow", description: "Raviolis crevette cristal — 4 pieces", price: "9,90" },
                { name: "Siu Mai", description: "Bouchees porc & crevette — 4 pieces", price: "8,90" },
                { name: "Char Siu Bao", description: "Brioche vapeur au porc laque — 3 pieces", price: "7,90" },
              ],
            },
            {
              name: "Plats Imperiaux",
              items: [
                { name: "Canard Laque Pekinois", description: "Canard roti 24h, crepes, ciboule, sauce hoisin", price: "32,90" },
                { name: "Boeuf aux Oignons", description: "Boeuf saute, oignons, sauce aux huitres", price: "16,90" },
              ],
            },
          ],
        },
        accent: "#E11D48",
      },
    ],
  },
  {
    id: "healthy",
    label: "Healthy",
    iconPath:
      "M7 21h10 M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.13 1.33l-12.4 6.84Z",
    description: "Frais, vert et naturel pour les concepts healthy",
    color: "rgba(74, 222, 128, 0.8)",
    templates: [
      {
        name: "Green",
        slug: "healthy-green",
        description: "Design frais et naturel, bowls & smoothies",
        tags: ["Nutri-score", "Allergenes", "Click & Collect"],
        hero: {
          title: "Fresh, green, delicious",
          subtitle: "Des bowls colores, des smoothies vitamines et des ingredients 100% naturels.",
        },
        menu: {
          categories: [
            {
              name: "Bowls",
              items: [
                { name: "Buddha Bowl", description: "Quinoa, avocat, edamame, carotte, sauce tahini", price: "13,90" },
                { name: "Acai Bowl", description: "Acai, granola, banane, fruits rouges, miel", price: "11,90" },
                { name: "Poke Saumon", description: "Riz, saumon, mangue, concombre, sesame", price: "14,90" },
              ],
            },
            {
              name: "Smoothies",
              items: [
                { name: "Green Detox", description: "Epinard, pomme, gingembre, citron", price: "6,90" },
                { name: "Berry Blast", description: "Myrtille, framboise, banane, lait d'amande", price: "7,50" },
              ],
            },
          ],
        },
        accent: "#4ADE80",
      },
      {
        name: "Detox",
        slug: "healthy-detox",
        description: "Minimaliste et epure, juice bar vibes",
        tags: ["Abonnements", "Programme detox", "Livraison"],
        hero: {
          title: "Purifiez votre quotidien",
          subtitle: "Jus presses a froid, programmes detox et bien-etre au quotidien.",
        },
        menu: {
          categories: [
            {
              name: "Jus Presses a Froid",
              items: [
                { name: "Pure Green", description: "Concombre, celeri, epinard, pomme, menthe", price: "7,90" },
                { name: "Sunrise", description: "Carotte, orange, gingembre, curcuma", price: "7,90" },
                { name: "Beetroot Boost", description: "Betterave, pomme, citron, gingembre", price: "7,90" },
              ],
            },
            {
              name: "Programmes",
              items: [
                { name: "Cure 1 jour — 6 jus", description: "Selection equilibree pour une journee detox", price: "39,90" },
                { name: "Cure 3 jours — 18 jus", description: "Programme complet reset & energie", price: "109,90" },
              ],
            },
          ],
        },
        accent: "#22D3EE",
      },
      {
        name: "Harvest",
        slug: "healthy-harvest",
        description: "Farm-to-table, local et de saison",
        tags: ["Producteurs", "Menu de saison", "Bio"],
        hero: {
          title: "Du champ a l'assiette",
          subtitle: "Des produits locaux, de saison, cultives par nos producteurs partenaires.",
        },
        menu: {
          categories: [
            {
              name: "Entrees de Saison",
              items: [
                { name: "Veloute du Moment", description: "Legumes de saison, huile d'olive, croutons", price: "8,90" },
                { name: "Salade du Potager", description: "Mesclun, radis, feta, graines, vinaigrette miel", price: "10,90" },
              ],
            },
            {
              name: "Plats",
              items: [
                { name: "Bowl Cereales & Roti", description: "Epeautre, legumes rotis, houmous, graines", price: "14,90" },
                { name: "Filet de Lieu Jaune", description: "Puree de petits pois, beurre citronne", price: "17,90" },
                { name: "Risotto Champignons", description: "Champignons de saison, parmesan, truffe", price: "16,90" },
              ],
            },
          ],
        },
        accent: "#A3E635",
      },
    ],
  },
  {
    id: "food-truck",
    label: "Food Truck",
    iconPath:
      "M10 17h4V5H2v12h3 M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1",
    description: "Nomade, fun et mobile pour les food trucks",
    color: "rgba(168, 85, 247, 0.8)",
    templates: [
      {
        name: "Wheels",
        slug: "food-truck-wheels",
        description: "Geolocalisation en temps reel, planning mobile",
        tags: ["Carte live", "Planning", "Pre-commande"],
        hero: {
          title: "On roule vers vous",
          subtitle: "Retrouvez-nous en temps reel, commandez a l'avance et savourez sans attendre.",
        },
        menu: {
          categories: [
            {
              name: "Burgers du Truck",
              items: [
                { name: "Le Classique", description: "Steak, cheddar, salade, tomate, sauce secrete", price: "10,90" },
                { name: "Le Veggie", description: "Galette de legumes, avocat, sauce yaourt", price: "11,90" },
              ],
            },
            {
              name: "Sides & Boissons",
              items: [
                { name: "Frites Cajun", description: "Epices cajun, mayo chipotle", price: "4,90" },
                { name: "Limonade Maison", description: "Citron, menthe, sucre de canne", price: "3,90" },
                { name: "Cookie Geant", description: "Pepites de chocolat, fleur de sel", price: "3,50" },
              ],
            },
          ],
        },
        accent: "#A855F7",
      },
      {
        name: "Festival",
        slug: "food-truck-festival",
        description: "Ambiance festival, street food & events",
        tags: ["Evenements", "Menu du jour", "Reseaux sociaux"],
        hero: {
          title: "L'esprit festival",
          subtitle: "Street food festive, ambiance musicale et saveurs du monde entier.",
        },
        menu: {
          categories: [
            {
              name: "World Food",
              items: [
                { name: "Tacos Mexicain", description: "Boeuf marine, guacamole, pico de gallo", price: "10,90" },
                { name: "Bao Bun", description: "Brioche vapeur, porc effiloche, pickles", price: "9,90" },
                { name: "Falafel Wrap", description: "Falafels, houmous, taboule, sauce tahini", price: "10,50" },
              ],
            },
            {
              name: "Douceurs",
              items: [
                { name: "Churros x5", description: "Cannelle, sauce chocolat", price: "5,90" },
                { name: "Bubble Waffle", description: "Glace vanille, fruits frais, coulis", price: "7,90" },
              ],
            },
          ],
        },
        accent: "#C084FC",
      },
      {
        name: "Nomad",
        slug: "food-truck-nomad",
        description: "Design aventurier, itinerant et audacieux",
        tags: ["Geoloc", "Notifications", "Menu compact"],
        hero: {
          title: "L'aventure a chaque bouchee",
          subtitle: "Un food truck nomade qui vous surprend avec des creations audacieuses a chaque etape.",
        },
        menu: {
          categories: [
            {
              name: "Creations du Chef",
              items: [
                { name: "Sandwich Nomad", description: "Pain focaccia, poulet roti, pesto, tomate sechee", price: "11,90" },
                { name: "Bowl Voyageur", description: "Riz, saumon fume, avocat, edamame, sriracha", price: "13,90" },
              ],
            },
            {
              name: "Snacks",
              items: [
                { name: "Empanadas x3", description: "Boeuf, oignon, cumin, chimichurri", price: "8,90" },
                { name: "Chips de Patate Douce", description: "Croustillantes, sel fume", price: "4,50" },
                { name: "Brownie Nomad", description: "Chocolat, noisette, caramel sale", price: "4,90" },
              ],
            },
          ],
        },
        accent: "#8B5CF6",
      },
    ],
  },
];

export const categoryCircles: Record<string, { cx: string; cy: string; r: string }[]> = {
  "food-truck": [
    { cx: "7.5", cy: "17.5", r: "2.5" },
    { cx: "17.5", cy: "17.5", r: "2.5" },
  ],
};

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
