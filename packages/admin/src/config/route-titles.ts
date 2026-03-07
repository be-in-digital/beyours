/** Top-level route segment to French title mapping */
export const titles: Record<string, string> = {
  dashboard: "Vue d'ensemble",
  orders: "Commandes",
  products: "Menu & Produits",
  customers: "Clients",
  inventory: "Inventaire",
  promotions: "Promotions",
  games: "Gamification",
  email: "Email Marketing",
  content: "Contenu",
  stores: "\u00c9tablissements",
  team: "\u00c9quipe & R\u00f4les",
  settings: "Param\u00e8tres",
  system: "Syst\u00e8me & Mises \u00e0 jour",
}

/** Two-level sub-page paths to French title mapping */
export const subTitles: Record<string, string> = {
  "games/catalog": "Jeux",
  "games/qr-codes": "QR Codes",
  "games/actions": "Actions",
  "games/winners": "Gagnants",
  "games/settings": "Param\u00e8tres",
  "email/campaigns": "Campagnes",
  "email/templates": "Mod\u00e8les",
  "email/subscribers": "Abonn\u00e9s",
  "email/segments": "Segments",
  "email/config": "Configuration",
  "content/pages": "Pages",
  "content/components": "Composants",
  "content/blog": "Blog",
  "content/media": "M\u00e9diath\u00e8que",
  "content/blog/auto-config": "Auto Blog",
}

/** Parent route href mapping for breadcrumb links */
export const parentHrefs: Record<string, string> = {
  games: "/games",
  email: "/email",
  content: "/content/pages",
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
 */
export function getBreadcrumbData(pathname: string): BreadcrumbData {
  const segments = pathname.split("/").filter(Boolean)

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
      const parentHref = `/${firstSegment}/${secondSegment}`

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
      const parentHref = parentHrefs[firstSegment] ?? `/${firstSegment}`

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
