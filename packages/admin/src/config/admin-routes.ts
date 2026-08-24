/**
 * Single source of truth for all admin dashboard routes.
 * Every admin link, redirect, and navigation reference MUST use these constants.
 */
export const adminRoutes = {
  // ─── Main ───────────────────────────────────────────────────────────────────
  dashboard: "/dashboard",

  // ─── Operations ─────────────────────────────────────────────────────────────
  orders: "/dashboard/orders",
  orderDetail: (id: string) => `/dashboard/orders/${id}` as const,
  kitchen: "/dashboard/orders/kitchen",

  products: "/dashboard/products",
  newProduct: "/dashboard/products/new",
  editProduct: (id: string) => `/dashboard/products/${id}` as const,
  fromImage: "/dashboard/products/from-image",

  categories: "/dashboard/categories",
  customers: "/dashboard/customers",
  inventory: "/dashboard/inventory",

  // ─── Marketing ──────────────────────────────────────────────────────────────
  promotions: "/dashboard/promotions",

  games: "/dashboard/games",
  gamesCatalog: "/dashboard/games/catalog",
  gamesQrCodes: "/dashboard/games/qr-codes",
  gamesActions: "/dashboard/games/actions",
  gamesWinners: "/dashboard/games/winners",

  email: "/dashboard/email",
  emailCampaigns: "/dashboard/email/campaigns",
  emailTemplates: "/dashboard/email/templates",
  emailSubscribers: "/dashboard/email/subscribers",
  emailSegments: "/dashboard/email/segments",
  emailConfig: "/dashboard/email/config",

  // ─── Content ────────────────────────────────────────────────────────────────
  contentPages: "/dashboard/content/pages",
  contentPageEdit: (slug: string) => `/dashboard/content/pages/${slug}` as const,
  contentComponents: "/dashboard/content/components",
  contentBlog: "/dashboard/content/blog",
  contentBlogAutoConfig: "/dashboard/content/blog/auto-config",
  contentBlogArticle: (id: string) => `/dashboard/content/blog/${id}` as const,
  contentMedia: "/dashboard/content/media",

  // ─── Organization ───────────────────────────────────────────────────────────
  stores: "/dashboard/stores",
  storeDetail: (id: string) => `/dashboard/stores/${id}` as const,
  team: "/dashboard/team",
  languages: "/dashboard/languages",
  subscription: "/dashboard/subscription",
  settings: "/dashboard/settings",
  system: "/dashboard/system",
} as const
