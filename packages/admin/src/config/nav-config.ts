import {
  ChefHat,
  ChevronRight,
  CreditCard,
  FileText,
  Gamepad2,
  Globe,
  Image,
  LayoutDashboard,
  LayoutList,
  Mail,
  PenSquare,
  RefreshCw,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  UserCog,
  UtensilsCrossed,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@be-in-digital/core"
import { adminRoutes } from "./admin-routes"

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Standard navigation item (no children) */
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: Permission
}

/** Sub-menu item displayed inside a collapsible section */
export interface SubNavItem {
  label: string
  href: string
}

/** Collapsible navigation item with a sub-menu */
export interface CollapsibleNavItem {
  label: string
  icon: LucideIcon
  basePath: string
  children: SubNavItem[]
  requiredPermission?: Permission
}

/** A navigation entry can be either a standard item or a collapsible one */
export type NavEntry = NavItem | CollapsibleNavItem

/** Navigation group that holds a set of entries */
export interface NavGroup {
  label: string
  items: NavEntry[]
}

// ─── Type guard ─────────────────────────────────────────────────────────────────

/** Check whether a nav entry is collapsible (has children) */
export function isCollapsible(entry: NavEntry): entry is CollapsibleNavItem {
  return "children" in entry
}

// ─── Navigation structure ───────────────────────────────────────────────────────

export const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Vue d'ensemble", href: adminRoutes.dashboard, icon: LayoutDashboard },
    ],
  },
  {
    label: "Opérations",
    items: [
      {
        label: "Commandes",
        href: adminRoutes.orders,
        icon: ShoppingCart,
        requiredPermission: "orders:read",
      },
      {
        label: "Cuisine (KDS)",
        href: adminRoutes.kitchen,
        icon: ChefHat,
        requiredPermission: "orders:read",
      },
      {
        label: "Menu & Produits",
        href: adminRoutes.products,
        icon: UtensilsCrossed,
        requiredPermission: "products:read",
      },
      {
        label: "Catégories",
        href: adminRoutes.categories,
        icon: LayoutList,
        requiredPermission: "products:read",
      },
      // "Clients" volontairement absent de la nav tant que la page n'est pas
      // construite (la route /dashboard/customers reste accessible).
      {
        label: "Inventaire",
        href: adminRoutes.inventory,
        icon: Warehouse,
        requiredPermission: "products:read",
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        label: "Promotions",
        href: adminRoutes.promotions,
        icon: Tag,
        requiredPermission: "games:read",
      },
      {
        label: "Gamification",
        icon: Gamepad2,
        basePath: adminRoutes.games,
        requiredPermission: "games:read",
        children: [
          { label: "Tableau de bord", href: adminRoutes.games },
          { label: "Jeux & Lots", href: adminRoutes.gamesCatalog },
          { label: "Codes QR", href: adminRoutes.gamesQrCodes },
          { label: "Actions", href: adminRoutes.gamesActions },
          { label: "Gagnants", href: adminRoutes.gamesWinners },
        ],
      },
      {
        label: "Email Marketing",
        icon: Mail,
        basePath: adminRoutes.email,
        requiredPermission: "settings:read",
        children: [
          { label: "Tableau de bord", href: adminRoutes.email },
          { label: "Campagnes", href: adminRoutes.emailCampaigns },
          { label: "Modèles", href: adminRoutes.emailTemplates },
          { label: "Abonnés", href: adminRoutes.emailSubscribers },
          { label: "Segments", href: adminRoutes.emailSegments },
          { label: "Configuration", href: adminRoutes.emailConfig },
        ],
      },
    ],
  },
  {
    label: "Contenu",
    items: [
      {
        label: "Pages",
        href: adminRoutes.contentPages,
        icon: FileText,
        requiredPermission: "settings:read",
      },
      // "Composants" volontairement absent tant que l'éditeur n'existe pas.
      {
        label: "Blog",
        icon: PenSquare,
        basePath: adminRoutes.contentBlog,
        requiredPermission: "settings:read",
        children: [
          { label: "Articles", href: adminRoutes.contentBlog },
          { label: "Auto Blog", href: adminRoutes.contentBlogAutoConfig },
        ],
      },
      {
        label: "Médiathèque",
        href: adminRoutes.contentMedia,
        icon: Image,
        requiredPermission: "settings:read",
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      {
        label: "Établissements",
        href: adminRoutes.stores,
        icon: Store,
        requiredPermission: "stores:read",
      },
      {
        label: "Équipe & Rôles",
        href: adminRoutes.team,
        icon: UserCog,
        requiredPermission: "team:read",
      },
      {
        label: "Langues",
        href: adminRoutes.languages,
        icon: Globe,
        requiredPermission: "settings:read",
      },
      {
        label: "Abonnement",
        href: adminRoutes.subscription,
        icon: CreditCard,
        requiredPermission: "settings:read",
      },
      {
        label: "Paramètres",
        href: adminRoutes.settings,
        icon: Settings,
        requiredPermission: "settings:read",
      },
      {
        label: "Système & Mises à jour",
        href: adminRoutes.system,
        icon: RefreshCw,
        requiredPermission: "system:read",
      },
    ],
  },
]

export { ChevronRight }
