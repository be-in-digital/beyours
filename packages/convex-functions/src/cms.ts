import { v } from "convex/values"

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get main CMS config ID
// ─────────────────────────────────────────────────────────────────────────────

async function getMainCmsId(ctx: any, cmsId?: string) {
  if (cmsId) return cmsId
  const config = await ctx.db
    .query("cms")
    .withIndex("by_name", (q: any) => q.eq("name", "main"))
    .first()
  return config?._id ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Config
// ─────────────────────────────────────────────────────────────────────────────

export const getGlobalConfig = {
  args: { name: v.optional(v.string()) },
  handler: async (ctx: any, args: { name?: string }) => {
    return await ctx.db
      .query("cms")
      .withIndex("by_name", (q: any) => q.eq("name", args.name ?? "main"))
      .first()
  },
}

export const updateGlobalConfig = {
  args: { id: v.id("cms"), data: v.any() },
  handler: async (ctx: any, args: { id: string; data: any }) => {
    await ctx.db.patch(args.id, { ...args.data, updatedAt: Date.now() })
    return args.id
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic page getters / updaters
// ─────────────────────────────────────────────────────────────────────────────

function makePageGetter(tableName: string) {
  return {
    args: { cmsId: v.optional(v.id("cms")) },
    handler: async (ctx: any, args: { cmsId?: string }) => {
      const id = await getMainCmsId(ctx, args.cmsId)
      if (!id) return null
      return await ctx.db
        .query(tableName)
        .withIndex("by_cms", (q: any) => q.eq("cmsId", id))
        .order("desc")
        .first()
    },
  }
}

function makePageUpdater(tableName: string) {
  return {
    args: { id: v.id(tableName), data: v.any() },
    handler: async (ctx: any, args: { id: string; data: any }) => {
      await ctx.db.patch(args.id, { ...args.data, updatedAt: Date.now() })
      return args.id
    },
  }
}

// Page queries
export const getHomePage = makePageGetter("cmsHome")
export const getMenuPage = makePageGetter("cmsMenu")
export const getAboutPage = makePageGetter("cmsAbout")
export const getContactPage = makePageGetter("cmsContact")
export const getCartConfig = makePageGetter("cmsCart")
export const getCheckoutPage = makePageGetter("cmsCheckout")
export const getTrackingPage = makePageGetter("cmsTracking")
export const getSigninPage = makePageGetter("cmsSignin")
export const getSignupPage = makePageGetter("cmsSignup")
export const getPrivacyPage = makePageGetter("cmsPrivacy")
export const getTermsPage = makePageGetter("cmsTerms")
export const get404Page = makePageGetter("cms404")
export const getMaintenancePage = makePageGetter("cmsMaintenance")
export const getAccountPage = makePageGetter("cmsAccount")

// Page mutations
export const updateHomePage = makePageUpdater("cmsHome")
export const updateMenuPage = makePageUpdater("cmsMenu")
export const updateAboutPage = makePageUpdater("cmsAbout")
export const updateContactPage = makePageUpdater("cmsContact")
export const updateCartConfig = makePageUpdater("cmsCart")
export const updateCheckoutPage = makePageUpdater("cmsCheckout")
export const updateTrackingPage = makePageUpdater("cmsTracking")
export const updateSigninPage = makePageUpdater("cmsSignin")
export const updateSignupPage = makePageUpdater("cmsSignup")
export const updatePrivacyPage = makePageUpdater("cmsPrivacy")
export const updateTermsPage = makePageUpdater("cmsTerms")
export const update404Page = makePageUpdater("cms404")
export const updateMaintenancePage = makePageUpdater("cmsMaintenance")
export const updateAccountPage = makePageUpdater("cmsAccount")

// ─────────────────────────────────────────────────────────────────────────────
// Blog Posts
// ─────────────────────────────────────────────────────────────────────────────

export const listBlogPosts = {
  args: {
    cmsId: v.optional(v.id("cms")),
    status: v.optional(v.string()),
  },
  handler: async (ctx: any, args: { cmsId?: string; status?: string }) => {
    const id = await getMainCmsId(ctx, args.cmsId)
    if (!id) return []
    let posts = await ctx.db
      .query("cmsBlogPosts")
      .withIndex("by_cms", (q: any) => q.eq("cmsId", id))
      .order("desc")
      .collect()
    if (args.status) {
      posts = posts.filter((p: any) => p.status === args.status)
    }
    return posts
  },
}

export const getBlogPost = {
  args: {
    id: v.optional(v.id("cmsBlogPosts")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx: any, args: { id?: string; slug?: string }) => {
    if (args.id) return await ctx.db.get(args.id)
    if (args.slug) {
      return await ctx.db
        .query("cmsBlogPosts")
        .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
        .first()
    }
    return null
  },
}

export const createBlogPost = {
  args: { cmsId: v.optional(v.id("cms")), data: v.any() },
  handler: async (ctx: any, args: { cmsId?: string; data: any }) => {
    const id = await getMainCmsId(ctx, args.cmsId)
    if (!id) throw new Error("CMS config not found")
    const now = Date.now()
    return await ctx.db.insert("cmsBlogPosts", {
      cmsId: id,
      ...args.data,
      version: 1,
      status: args.data.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const updateBlogPost = {
  args: { id: v.id("cmsBlogPosts"), data: v.any() },
  handler: async (ctx: any, args: { id: string; data: any }) => {
    await ctx.db.patch(args.id, { ...args.data, updatedAt: Date.now() })
    return args.id
  },
}

export const deleteBlogPost = {
  args: { id: v.id("cmsBlogPosts") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed: creates default CMS content for all pages
// ─────────────────────────────────────────────────────────────────────────────

export const seedInitialCMS = {
  args: {},
  handler: async (ctx: any) => {
    // Check if already seeded
    const existing = await ctx.db
      .query("cms")
      .withIndex("by_name", (q: any) => q.eq("name", "main"))
      .first()
    if (existing) return existing._id

    const now = Date.now()
    const meta = { version: 1, status: "published" as const, createdAt: now, updatedAt: now }

    // Create main CMS config
    const cmsId = await ctx.db.insert("cms", {
      name: "main",
      defaultLocale: "fr",
      supportedLocales: ["fr", "en"],
      createdAt: now,
      updatedAt: now,
    })

    // Homepage
    await ctx.db.insert("cmsHome", {
      cmsId,
      hero: {
        badge: { fr: "Bienvenue" },
        title: { fr: "Savourez chaque bouchée" },
        subtitle: { fr: "Commandez vos plats préférés en quelques clics" },
        ctaText: { fr: "Voir le menu" },
      },
      features: {
        sectionTitle: { fr: "Pourquoi nous choisir" },
        items: [
          { icon: "Truck", title: { fr: "Livraison rapide" }, description: { fr: "En 30 min ou moins" } },
          { icon: "ChefHat", title: { fr: "Fait maison" }, description: { fr: "Ingrédients frais et locaux" } },
          { icon: "Clock", title: { fr: "Click & Collect" }, description: { fr: "Prêt en 15 minutes" } },
        ],
      },
      cta: {
        title: { fr: "Prêt à commander ?" },
        subtitle: { fr: "Découvrez notre carte complète" },
        buttonText: { fr: "Commander maintenant" },
        buttonHref: "/menu",
      },
      ...meta,
    })

    // Menu page
    await ctx.db.insert("cmsMenu", {
      cmsId,
      header: {
        title: { fr: "Notre carte" },
        subtitle: { fr: "Découvrez nos plats préparés avec passion" },
      },
      ui: {
        searchPlaceholder: { fr: "Rechercher un plat..." },
        addToCartButton: { fr: "Ajouter" },
        emptyStateText: { fr: "Aucun plat trouvé" },
        pricePrefix: { fr: "" },
      },
      ...meta,
    })

    // About
    await ctx.db.insert("cmsAbout", {
      cmsId,
      hero: {
        badge: { fr: "Notre histoire" },
        title: { fr: "Depuis 2020" },
        description: { fr: "Une passion pour la cuisine authentique" },
      },
      story: {
        badge: { fr: "Notre parcours" },
        title: { fr: "De la passion à l'assiette" },
        description: { fr: "Notre aventure a commencé avec une idée simple : proposer une cuisine de qualité accessible à tous." },
        features: [
          { fr: "Ingrédients 100% frais" },
          { fr: "Recettes traditionnelles" },
          { fr: "Service rapide et soigné" },
        ],
      },
      values: {
        badge: { fr: "Nos valeurs" },
        title: { fr: "Ce qui nous anime" },
        description: { fr: "Chaque plat est une promesse de qualité" },
        items: [
          { icon: "Heart", title: { fr: "Passion" }, description: { fr: "L'amour de la bonne cuisine" } },
          { icon: "Leaf", title: { fr: "Fraîcheur" }, description: { fr: "Des produits frais chaque jour" } },
          { icon: "Users", title: { fr: "Convivialité" }, description: { fr: "Un accueil chaleureux" } },
        ],
      },
      cta: {
        title: { fr: "Venez nous rendre visite" },
        buttonText: { fr: "Voir le menu" },
        buttonHref: "/menu",
      },
      ...meta,
    })

    // Contact
    await ctx.db.insert("cmsContact", {
      cmsId,
      hero: {
        badge: { fr: "Contact" },
        title: { fr: "Parlons ensemble" },
        description: { fr: "Une question ? Nous sommes à votre écoute." },
      },
      formHeader: {
        badge: { fr: "Formulaire" },
        title: { fr: "Envoyez-nous un message" },
      },
      info: [],
      social: {
        title: { fr: "Suivez-nous sur les réseaux" },
        links: [],
      },
      chatCta: {
        title: { fr: "Chat en direct" },
        description: { fr: "Discutez avec nous pour une réponse instantanée" },
        buttonText: { fr: "Démarrer le chat" },
        href: "#",
      },
      ...meta,
    })

    // Cart
    await ctx.db.insert("cmsCart", {
      cmsId,
      labels: {
        title: { fr: "Votre panier" },
        itemsSelected: { fr: "articles sélectionnés" },
        clearAll: { fr: "Tout vider" },
        emptyStateTitle: { fr: "Votre panier est vide" },
        emptyStateDescription: { fr: "Ajoutez des plats depuis notre menu" },
        emptyStateAction: { fr: "Voir le menu" },
        subtotal: { fr: "Sous-total" },
        delivery: { fr: "Livraison" },
        deliveryFree: { fr: "Gratuite" },
        totalPrice: { fr: "Total" },
        checkoutBtn: { fr: "Passer commande" },
      },
      ...meta,
    })

    // Checkout
    await ctx.db.insert("cmsCheckout", {
      cmsId,
      header: {
        backToMenu: { fr: "Retour au menu" },
        title: { fr: "Finaliser la commande" },
        guestNotice: { fr: "Connectez-vous pour un suivi complet" },
      },
      fulfillment: {
        delivery: { fr: "Livraison" },
        pickup: { fr: "À emporter" },
      },
      sections: {
        contact: {
          title: { fr: "Contact" },
          description: { fr: "Pour vous contacter en cas de besoin" },
          emailLabel: { fr: "Email" },
          phoneLabel: { fr: "Téléphone" },
        },
        delivery: {
          title: { fr: "Adresse de livraison" },
          description: { fr: "Où souhaitez-vous être livré ?" },
          firstNameLabel: { fr: "Prénom" },
          lastNameLabel: { fr: "Nom" },
          addressLabel: { fr: "Adresse" },
          cityLabel: { fr: "Ville" },
          postalCodeLabel: { fr: "Code postal" },
        },
        payment: {
          title: { fr: "Paiement" },
          description: { fr: "Choisissez votre mode de paiement" },
          cardLabel: { fr: "Carte bancaire" },
          cashLabel: { fr: "Espèces" },
          cashNotice: { fr: "Paiement à la livraison" },
        },
      },
      summary: {
        title: { fr: "Récapitulatif" },
        subtotal: { fr: "Sous-total" },
        delivery: { fr: "Livraison" },
        discount: { fr: "Réduction" },
        total: { fr: "Total" },
        submitBtn: { fr: "Confirmer la commande" },
        calculating: { fr: "Calcul en cours..." },
        freeLabel: { fr: "Gratuit" },
        promoPlaceholder: { fr: "Code promo" },
        promoBtn: { fr: "Appliquer" },
      },
      success: {
        title: { fr: "Commande confirmée !" },
        message: { fr: "Votre commande a été prise en compte" },
        orderLabel: { fr: "Commande n°" },
        homeBtn: { fr: "Accueil" },
        menuBtn: { fr: "Retour au menu" },
      },
      empty: {
        title: { fr: "Panier vide" },
        description: { fr: "Ajoutez des articles avant de commander" },
        action: { fr: "Voir le menu" },
      },
      ...meta,
    })

    // Tracking
    await ctx.db.insert("cmsTracking", {
      cmsId,
      header: {
        title: { fr: "Suivi de" },
        titleHighlight: { fr: "commande" },
      },
      steps: {
        pending: { label: { fr: "En attente" }, description: { fr: "Commande reçue" } },
        preparing: { label: { fr: "En préparation" }, description: { fr: "Votre commande est en cuisine" } },
        ready: { label: { fr: "Prête" }, description: { fr: "Votre commande est prête" } },
        completed: { label: { fr: "Terminée" }, description: { fr: "Bon appétit !" } },
      },
      cancelled: {
        title: { fr: "Commande annulée" },
        description: { fr: "Cette commande a été annulée" },
      },
      estimatedTime: { label: { fr: "Temps estimé" } },
      summary: {
        title: { fr: "Récapitulatif" },
        subtotalLabel: { fr: "Sous-total" },
        deliveryLabel: { fr: "Livraison" },
        totalLabel: { fr: "Total" },
      },
      contact: {
        title: { fr: "Besoin d'aide ?" },
        buttonText: { fr: "Nous contacter" },
      },
      footer: {
        dateLabel: { fr: "Commande passée le" },
        backLinkText: { fr: "Retour au menu" },
      },
      actions: {
        cancelButton: { fr: "Annuler la commande" },
        cancelConfirmMessage: { fr: "Êtes-vous sûr de vouloir annuler ?" },
      },
      ...meta,
    })

    // Auth pages
    await ctx.db.insert("cmsSignin", {
      cmsId,
      hero: {
        title: { fr: "Bon retour" },
        subtitle: { fr: "parmi nous" },
      },
      form: {
        emailLabel: { fr: "Adresse email" },
        emailPlaceholder: { fr: "jean@exemple.com" },
        passwordLabel: { fr: "Mot de passe" },
        submitButton: { fr: "Se connecter" },
        forgotPasswordText: { fr: "Mot de passe oublié ?" },
        forgotPasswordHref: "/forgot-password",
      },
      footer: {
        text: { fr: "Pas encore de compte ?" },
        linkText: { fr: "Créer un compte" },
        linkHref: "/sign-up",
      },
      ...meta,
    })

    await ctx.db.insert("cmsSignup", {
      cmsId,
      hero: {
        titleLine1: { fr: "Créer un" },
        titleLine2: { fr: "compte" },
      },
      form: {
        nameLabel: { fr: "Nom complet" },
        namePlaceholder: { fr: "Jean Dupont" },
        emailLabel: { fr: "Adresse email" },
        emailPlaceholder: { fr: "jean@exemple.com" },
        passwordLabel: { fr: "Mot de passe" },
        confirmLabel: { fr: "Confirmer" },
        submitButton: { fr: "Créer mon compte" },
      },
      footer: {
        text: { fr: "Déjà un compte ?" },
        linkText: { fr: "Se connecter" },
        linkHref: "/sign-in",
      },
      ...meta,
    })

    // 404
    await ctx.db.insert("cms404", {
      cmsId,
      errorCode: { fr: "404" },
      title: { fr: "Page introuvable" },
      description: { fr: "La page que vous cherchez n'existe pas ou a été déplacée." },
      actionText: { fr: "Retour à l'accueil" },
      actionLink: "/",
      ...meta,
    })

    // Maintenance
    await ctx.db.insert("cmsMaintenance", {
      cmsId,
      enabled: false,
      title: { fr: "Maintenance en cours" },
      description: { fr: "Nous serons de retour très bientôt !" },
      ...meta,
    })

    // Account
    await ctx.db.insert("cmsAccount", {
      cmsId,
      menu: {
        profile: { fr: "Mon profil" },
        orders: { fr: "Mes commandes" },
        favorites: { fr: "Mes favoris" },
        addresses: { fr: "Mes adresses" },
        logout: { fr: "Se déconnecter" },
      },
      profile: {
        title: { fr: "Mon profil" },
        description: { fr: "Gérez vos informations personnelles" },
        labels: {
          fullName: { fr: "Nom complet" },
          email: { fr: "Email" },
          phone: { fr: "Téléphone" },
          saveBtn: { fr: "Enregistrer" },
        },
      },
      orders: {
        title: { fr: "Mes commandes" },
        description: { fr: "Historique de vos commandes" },
        emptyTitle: { fr: "Aucune commande" },
        emptyDesc: { fr: "Vous n'avez pas encore passé de commande" },
        emptyAction: { fr: "Voir le menu" },
        status: {
          pending: { fr: "En attente" },
          preparing: { fr: "En préparation" },
          ready: { fr: "Prête" },
          completed: { fr: "Terminée" },
          cancelled: { fr: "Annulée" },
        },
      },
      addresses: {
        title: { fr: "Mes adresses" },
        description: { fr: "Gérez vos adresses de livraison" },
        addBtn: { fr: "Ajouter une adresse" },
        emptyTitle: { fr: "Aucune adresse" },
        emptyDesc: { fr: "Ajoutez une adresse pour faciliter vos commandes" },
      },
      favorites: {
        title: { fr: "Mes favoris" },
        description: { fr: "Vos plats préférés" },
        emptyTitle: { fr: "Aucun favori" },
        emptyDesc: { fr: "Ajoutez des plats en favoris depuis le menu" },
        emptyAction: { fr: "Voir le menu" },
      },
      ...meta,
    })

    return cmsId
  },
}
