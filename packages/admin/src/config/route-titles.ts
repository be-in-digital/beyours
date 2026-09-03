import { adminRoutes } from "./admin-routes"

/** Top-level route segment to French title mapping */
export const titles: Record<string, string> = {
  dashboard: "Vue d'ensemble",
  orders: "Commandes",
  products: "Menu & Produits",
  customers: "Clients",
  messages: "Messages",
  inventory: "Inventaire",
  promotions: "Promotions",
  games: "Gamification",
  email: "Email Marketing",
  content: "Contenu",
  stores: "Établissements",
  team: "Équipe & Rôles",
  settings: "Paramètres",
  system: "Système & Mises à jour",
  languages: "Langues",
  subscription: "Abonnement",
  categories: "Catégories",
}

/** Two-level sub-page paths to French title mapping */
export const subTitles: Record<string, string> = {
  "orders/kitchen": "Cuisine (KDS)",
  "games/catalog": "Jeux",
  "games/qr-codes": "QR Codes",
  "games/actions": "Actions",
  "games/winners": "Gagnants",
  "games/settings": "Paramètres",
  "email/campaigns": "Campagnes",
  "email/templates": "Modèles",
  "email/subscribers": "Abonnés",
  "email/segments": "Segments",
  "email/config": "Configuration",
  "content/pages": "Pages",
  "content/components": "Composants",
  "content/blog": "Blog",
  "content/media": "Médiathèque",
  "content/blog/auto-config": "Auto Blog",
  "products/new": "Nouveau produit",
  "products/from-image": "Depuis une image",
}

/** Parent route href mapping for breadcrumb links */
export const parentHrefs: Record<string, string> = {
  orders: adminRoutes.orders,
  games: adminRoutes.games,
  email: adminRoutes.email,
  content: adminRoutes.contentPages,
  products: adminRoutes.products,
}

// ─── Breadcrumb data builder ────────────────────────────────────────────────────

interface BreadcrumbData {
  parentLabel: string | null
  parentHref: string | null
  currentLabel: string
}

/**
 * Build breadcrumb data from the current pathname.
 * Returns a parent + current label pair for two-level breadcrumbs,
 * or just a current label for top-level pages.
 *
 * Automatically strips the leading `/dashboard` segment so title maps
 * stay clean and readable.
 */
export function getBreadcrumbData(pathname: string): BreadcrumbData {
  const segments = pathname.split("/").filter(Boolean)

  // Strip the /dashboard prefix — all admin routes live under it
  if (segments[0] === "dashboard") segments.shift()

  if (segments.length === 0) {
    return { parentLabel: null, parentHref: null, currentLabel: "Vue d'ensemble" }
  }

  const firstSegment = segments[0] as string
  const secondSegment = segments[1] as string | undefined
  const thirdSegment = segments[2] as string | undefined

  // Check for a three-segment sub-page match (e.g. "content/blog/auto-config")
  if (secondSegment && thirdSegment) {
    const tripleKey = `${firstSegment}/${secondSegment}/${thirdSegment}`
    const tripleTitle = subTitles[tripleKey]

    if (tripleTitle) {
      const parentKey = `${firstSegment}/${secondSegment}`
      const parentLabel = subTitles[parentKey] ?? secondSegment
      const parentHref = `/dashboard/${firstSegment}/${secondSegment}`

      return {
        parentLabel,
        parentHref,
        currentLabel: tripleTitle,
      }
    }
  }

  // Check for a two-segment sub-page match (e.g. "games/catalog")
  if (secondSegment) {
    const subKey = `${firstSegment}/${secondSegment}`
    const subTitle = subTitles[subKey]

    if (subTitle) {
      const parentLabel = titles[firstSegment] ?? firstSegment
      const parentHref = parentHrefs[firstSegment] ?? `/dashboard/${firstSegment}`

      return {
        parentLabel,
        parentHref,
        currentLabel: subTitle,
      }
    }
  }

  // Top-level page (single segment or unrecognized sub-page)
  const label =
    titles[firstSegment] ??
    firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)

  return { parentLabel: null, parentHref: null, currentLabel: label }
}
