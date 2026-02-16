"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// ─── Route title mappings ───────────────────────────────────────────────────────

/** Top-level route segment to French title mapping */
const titles: Record<string, string> = {
  dashboard: "Vue d'ensemble",
  orders: "Commandes",
  products: "Menu & Produits",
  customers: "Clients",
  inventory: "Inventaire",
  promotions: "Promotions",
  games: "Gamification",
  email: "Email Marketing",
  content: "Contenu",
  stores: "Établissements",
  team: "Équipe & Rôles",
  settings: "Paramètres",
  system: "Système & Mises à jour",
}

/** Two-level sub-page paths to French title mapping */
const subTitles: Record<string, string> = {
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
}

/** Parent route href mapping for breadcrumb links */
const parentHrefs: Record<string, string> = {
  games: "/games",
  email: "/email",
  content: "/content/pages",
}

// ─── Breadcrumb data builder ────────────────────────────────────────────────────

interface BreadcrumbData {
  /** The parent label when on a sub-page (null if top-level) */
  parentLabel: string | null
  /** The href for the parent breadcrumb link */
  parentHref: string | null
  /** The current page label */
  currentLabel: string
}

/**
 * Build breadcrumb data from the current pathname.
 * Returns a parent + current label pair for two-level breadcrumbs,
 * or just a current label for top-level pages.
 */
function getBreadcrumbData(pathname: string): BreadcrumbData {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return { parentLabel: null, parentHref: null, currentLabel: "Vue d'ensemble" }
  }

  const firstSegment = segments[0] as string
  const secondSegment = segments[1] as string | undefined

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
  const label = titles[firstSegment] ?? firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)

  return { parentLabel: null, parentHref: null, currentLabel: label }
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * Admin header component with sidebar trigger, breadcrumb, and user info.
 * Displays two-level breadcrumbs for sub-pages (e.g. "Gamification > QR Codes")
 * and single-level breadcrumbs for top-level pages.
 * Works in conjunction with the shadcn SidebarProvider.
 */
export function AdminHeader() {
  const pathname = usePathname()
  const { parentLabel, parentHref, currentLabel } = getBreadcrumbData(pathname)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {parentLabel && parentHref ? (
            <>
              {/* Parent breadcrumb with link */}
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={parentHref}>{parentLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {/* Current sub-page (no link) */}
              <BreadcrumbItem>
                <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            /* Top-level page (single breadcrumb, no link) */
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Admin</span>
      </div>
    </header>
  )
}
