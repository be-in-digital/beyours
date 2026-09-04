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
  messages: "/dashboard/messages",

  /**
   * Transactions and refunds. `PaymentsPage` carries the only working refund
   * dialog in the admin, and until this route existed nothing rendered it —
   * the page was exported from the package and mounted by neither app, so a
   * refund could not be issued from anywhere. The Settings > Paiements tab is
   * provider *configuration* and is a different screen.
   */
  payments: "/dashboard/payments",

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
  /**
   * Colours, typography and logo of the storefront — `store.branding`.
   *
   * Its own route rather than a Settings tab, for the same reason the payments
   * route is not the Settings > Paiements tab: this screen edits ONE
   * establishment, resolved from `useAdminStoreId()`, while Settings is headed
   * "Paramètres Globaux — valeurs par défaut héritées par tous les
   * établissements". A per-store editor under that heading would tell an owner
   * with three restaurants that they had just restyled all three.
   *
   * `DesignPage` was exported from the package and mounted by neither app
   * before this route existed, so its three save buttons were unreachable even
   * after the mutation behind them landed.
   */
  design: "/dashboard/design",

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
