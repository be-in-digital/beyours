import { defineTable } from "convex/server"
import { v } from "convex/values"

// ─────────────────────────────────────────────────────────────────────────────
// Shared CMS validators
// ─────────────────────────────────────────────────────────────────────────────

/** Localized text: { fr: "Bonjour", en: "Hello", ... } */
export const localizedText = v.record(v.string(), v.string())

/** Localized rich text (HTML/markdown per locale) */
export const localizedRichText = v.record(v.string(), v.any())

/** Media asset */
export const media = v.object({
  type: v.union(
    v.literal("image"),
    v.literal("video"),
    v.literal("icon"),
    v.literal("lottie")
  ),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  alt: v.optional(localizedText),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
})

/** SEO metadata per locale */
export const localizedSeo = v.record(
  v.string(),
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    ogImage: v.optional(v.any()),
  })
)

/** Common page metadata */
export const pageMetadata = {
  version: v.number(),
  status: v.union(v.literal("draft"), v.literal("published")),
  publishedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS Global Config
// ─────────────────────────────────────────────────────────────────────────────

export const cmsTable = defineTable({
  name: v.string(),
  defaultLocale: v.string(),
  supportedLocales: v.array(v.string()),

  identity: v.optional(
    v.object({
      siteName: localizedText,
      description: localizedText,
      logo: v.optional(media),
      favicon: v.optional(media),
    })
  ),

  socials: v.optional(
    v.array(
      v.object({
        platform: v.string(),
        url: v.string(),
        active: v.boolean(),
      })
    )
  ),

  contactInfo: v.optional(
    v.object({
      address: v.optional(localizedText),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      openingHours: v.optional(localizedText),
    })
  ),

  footer: v.optional(
    v.object({
      description: localizedText,
      newsletterTitle: localizedText,
      newsletterDescription: localizedText,
      newsletterPlaceholder: v.optional(localizedText),
      newsletterButtonText: v.optional(localizedText),
      copyrightText: localizedText,
      sections: v.optional(
        v.array(
          v.object({
            title: localizedText,
            links: v.array(
              v.object({
                label: localizedText,
                href: v.string(),
              })
            ),
          })
        )
      ),
    })
  ),

  consent: v.optional(
    v.object({
      title: localizedText,
      description: localizedText,
      acceptButton: localizedText,
      declineButton: localizedText,
      privacyPolicyLabel: localizedText,
      privacyPolicyUrl: v.string(),
    })
  ),

  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_name", ["name"])

// ─────────────────────────────────────────────────────────────────────────────
// Homepage
// ─────────────────────────────────────────────────────────────────────────────

export const cmsHomeTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
    ctaText: localizedText,
    image: v.optional(media),
  }),
  features: v.object({
    sectionTitle: localizedText,
    items: v.array(
      v.object({
        icon: v.string(),
        title: localizedText,
        description: localizedText,
      })
    ),
  }),
  trendingMeals: v.optional(
    v.object({
      sectionTitle: v.optional(localizedText),
      description: v.optional(localizedText),
      viewAllText: v.optional(localizedText),
      isAutomated: v.optional(v.boolean()),
    })
  ),
  categories: v.optional(
    v.object({
      badge: v.optional(localizedText),
      sectionTitle: v.optional(localizedText),
      description: v.optional(localizedText),
    })
  ),
  testimonials: v.optional(
    v.object({
      badge: v.optional(localizedText),
      sectionTitle: localizedText,
      items: v.array(
        v.object({
          quote: localizedText,
          authorName: v.string(),
          authorImage: v.optional(v.string()),
          rating: v.optional(v.number()),
        })
      ),
    })
  ),
  cta: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
    buttonText: localizedText,
    buttonHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Menu Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsMenuTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: v.optional(localizedText),
    title: localizedText,
    subtitle: localizedText,
  }),
  ui: v.object({
    searchPlaceholder: localizedText,
    addToCartButton: localizedText,
    emptyStateText: localizedText,
    pricePrefix: localizedText,
    filterLabel: v.optional(localizedText),
    sortByLabel: v.optional(localizedText),
  }),
  deliveryApps: v.optional(
    v.object({
      badge: v.optional(localizedText),
      title: localizedText,
      apps: v.array(
        v.object({
          name: v.string(),
          title: localizedText,
          description: localizedText,
          buttonText: localizedText,
          href: v.string(),
          color: v.string(),
          type: v.string(),
        })
      ),
    })
  ),
  cta: v.optional(
    v.object({
      title: localizedText,
      subtitle: localizedText,
      buttonText: localizedText,
      buttonHref: v.string(),
    })
  ),
  blog: v.optional(
    v.object({
      title: localizedText,
      isAutomated: v.optional(v.boolean()),
      viewAllText: v.optional(localizedText),
    })
  ),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// About Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsAboutTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
  }),
  story: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
    image: v.optional(v.string()),
    features: v.array(localizedText),
  }),
  values: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
    items: v.array(
      v.object({
        icon: v.string(),
        title: localizedText,
        description: localizedText,
        color: v.optional(v.string()),
      })
    ),
  }),
  cta: v.object({
    title: localizedText,
    buttonText: localizedText,
    buttonHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Contact Page
// ─────────────────────────────────────────────────────────────────────────────

export const cmsContactTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    badge: localizedText,
    title: localizedText,
    description: localizedText,
  }),
  formHeader: v.object({
    badge: localizedText,
    title: localizedText,
  }),
  info: v.array(
    v.object({
      icon: v.string(),
      label: localizedText,
      value: v.string(),
      description: localizedText,
      href: v.string(),
      color: v.optional(v.string()),
    })
  ),
  social: v.object({
    title: localizedText,
    links: v.array(v.object({ platform: v.string(), href: v.string() })),
  }),
  chatCta: v.object({
    title: localizedText,
    description: localizedText,
    buttonText: localizedText,
    href: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Blog Posts
// ─────────────────────────────────────────────────────────────────────────────

export const cmsBlogPostsTable = defineTable({
  cmsId: v.id("cms"),
  slug: v.string(),
  title: localizedText,
  excerpt: v.optional(localizedText),
  content: localizedText,
  mainImage: v.optional(v.string()),
  author: v.optional(v.string()),
  category: v.optional(v.string()),
  ...pageMetadata,
})
  .index("by_cms", ["cmsId"])
  .index("by_slug", ["slug"])

// ─────────────────────────────────────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────────────────────────────────────

export const cmsCartTable = defineTable({
  cmsId: v.id("cms"),
  labels: v.object({
    title: localizedText,
    itemsSelected: localizedText,
    clearAll: localizedText,
    emptyStateTitle: localizedText,
    emptyStateDescription: localizedText,
    emptyStateAction: localizedText,
    subtotal: localizedText,
    delivery: localizedText,
    deliveryFree: localizedText,
    totalPrice: localizedText,
    checkoutBtn: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────────────────────

export const cmsCheckoutTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    backToMenu: localizedText,
    title: localizedText,
    guestNotice: localizedText,
  }),
  fulfillment: v.object({
    delivery: localizedText,
    pickup: localizedText,
  }),
  sections: v.object({
    contact: v.object({
      title: localizedText,
      description: localizedText,
      emailLabel: localizedText,
      phoneLabel: localizedText,
    }),
    delivery: v.object({
      title: localizedText,
      description: localizedText,
      firstNameLabel: localizedText,
      lastNameLabel: localizedText,
      addressLabel: localizedText,
      cityLabel: localizedText,
      postalCodeLabel: localizedText,
    }),
    payment: v.object({
      title: localizedText,
      description: localizedText,
      cardLabel: localizedText,
      cashLabel: localizedText,
      cashNotice: localizedText,
    }),
  }),
  summary: v.object({
    title: localizedText,
    subtotal: localizedText,
    delivery: localizedText,
    discount: localizedText,
    total: localizedText,
    submitBtn: localizedText,
    calculating: localizedText,
    freeLabel: localizedText,
    promoPlaceholder: localizedText,
    promoBtn: localizedText,
  }),
  success: v.object({
    title: localizedText,
    message: localizedText,
    orderLabel: localizedText,
    homeBtn: localizedText,
    menuBtn: localizedText,
  }),
  empty: v.object({
    title: localizedText,
    description: localizedText,
    action: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────────────────────

export const cmsTrackingTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    title: localizedText,
    titleHighlight: localizedText,
  }),
  steps: v.object({
    pending: v.object({ label: localizedText, description: localizedText }),
    preparing: v.object({ label: localizedText, description: localizedText }),
    ready: v.object({ label: localizedText, description: localizedText }),
    completed: v.object({ label: localizedText, description: localizedText }),
  }),
  cancelled: v.object({
    title: localizedText,
    description: localizedText,
  }),
  estimatedTime: v.object({ label: localizedText }),
  summary: v.object({
    title: localizedText,
    subtotalLabel: localizedText,
    deliveryLabel: localizedText,
    totalLabel: localizedText,
  }),
  contact: v.object({
    title: localizedText,
    buttonText: localizedText,
  }),
  footer: v.object({
    dateLabel: localizedText,
    backLinkText: localizedText,
  }),
  actions: v.object({
    cancelButton: localizedText,
    cancelConfirmMessage: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Auth pages (sign-in, sign-up)
// ─────────────────────────────────────────────────────────────────────────────

export const cmsSigninTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    title: localizedText,
    subtitle: localizedText,
  }),
  form: v.object({
    emailLabel: localizedText,
    emailPlaceholder: localizedText,
    passwordLabel: localizedText,
    submitButton: localizedText,
    forgotPasswordText: localizedText,
    forgotPasswordHref: v.string(),
  }),
  footer: v.object({
    text: localizedText,
    linkText: localizedText,
    linkHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsSignupTable = defineTable({
  cmsId: v.id("cms"),
  hero: v.object({
    titleLine1: localizedText,
    titleLine2: localizedText,
  }),
  form: v.object({
    nameLabel: localizedText,
    namePlaceholder: localizedText,
    emailLabel: localizedText,
    emailPlaceholder: localizedText,
    passwordLabel: localizedText,
    confirmLabel: localizedText,
    submitButton: localizedText,
  }),
  footer: v.object({
    text: localizedText,
    linkText: localizedText,
    linkHref: v.string(),
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Legal pages (privacy, terms)
// ─────────────────────────────────────────────────────────────────────────────

export const cmsPrivacyTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: localizedText,
    title: localizedText,
    lastUpdatedLabel: localizedText,
  }),
  intro: v.object({ text: localizedRichText }),
  sections: v.array(
    v.object({
      icon: v.string(),
      title: localizedText,
      content: localizedRichText,
    })
  ),
  footer: v.object({
    copyright: localizedText,
    legalNote: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsTermsTable = defineTable({
  cmsId: v.id("cms"),
  header: v.object({
    badge: localizedText,
    title: localizedText,
    lastUpdatedLabel: localizedText,
  }),
  intro: v.object({ text: localizedRichText }),
  sections: v.array(
    v.object({
      icon: v.string(),
      title: localizedText,
      content: localizedRichText,
    })
  ),
  footer: v.object({
    copyright: localizedText,
    legalNote: localizedText,
  }),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Error & Maintenance pages
// ─────────────────────────────────────────────────────────────────────────────

export const cms404Table = defineTable({
  cmsId: v.id("cms"),
  errorCode: localizedText,
  title: localizedText,
  description: localizedText,
  actionText: localizedText,
  actionLink: v.string(),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

export const cmsMaintenanceTable = defineTable({
  cmsId: v.id("cms"),
  enabled: v.boolean(),
  title: localizedText,
  description: localizedText,
  estimatedEndTime: v.optional(localizedText),
  seo: v.optional(localizedSeo),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])

// ─────────────────────────────────────────────────────────────────────────────
// Account pages
// ─────────────────────────────────────────────────────────────────────────────

export const cmsAccountTable = defineTable({
  cmsId: v.id("cms"),
  menu: v.object({
    profile: localizedText,
    orders: localizedText,
    favorites: localizedText,
    addresses: localizedText,
    logout: localizedText,
  }),
  profile: v.object({
    title: localizedText,
    description: localizedText,
    labels: v.object({
      fullName: localizedText,
      email: localizedText,
      phone: localizedText,
      saveBtn: localizedText,
    }),
  }),
  orders: v.object({
    title: localizedText,
    description: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
    emptyAction: localizedText,
    status: v.object({
      pending: localizedText,
      preparing: localizedText,
      ready: localizedText,
      completed: localizedText,
      cancelled: localizedText,
    }),
  }),
  addresses: v.object({
    title: localizedText,
    description: localizedText,
    addBtn: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
  }),
  favorites: v.object({
    title: localizedText,
    description: localizedText,
    emptyTitle: localizedText,
    emptyDesc: localizedText,
    emptyAction: localizedText,
  }),
  ...pageMetadata,
}).index("by_cms", ["cmsId"])
