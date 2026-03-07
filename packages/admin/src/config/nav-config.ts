import {
  ChevronRight,
  CreditCard,
  FileText,
  Gamepad2,
  Globe,
  Image,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  PenSquare,
  RefreshCw,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  UserCog,
  Users,
  UtensilsCrossed,
  Warehouse,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@beindigital-engine/core"

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
      { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Op\u00e9rations",
    items: [
      {
        label: "Commandes",
        href: "/orders",
        icon: ShoppingCart,
        requiredPermission: "orders:read",
      },
      {
        label: "Menu & Produits",
        href: "/products",
        icon: UtensilsCrossed,
        requiredPermission: "products:read",
      },
      {
        label: "Clients",
        href: "/customers",
        icon: Users,
        requiredPermission: "customers:read",
      },
      {
        label: "Inventaire",
        href: "/inventory",
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
        href: "/promotions",
        icon: Tag,
        requiredPermission: "games:read",
      },
      {
        label: "Gamification",
        icon: Gamepad2,
        basePath: "/games",
        requiredPermission: "games:read",
        children: [
          { label: "Tableau de bord", href: "/games" },
          { label: "Jeux", href: "/games/catalog" },
          { label: "QR Codes", href: "/games/qr-codes" },
          { label: "Actions", href: "/games/actions" },
          { label: "Gagnants", href: "/games/winners" },
          { label: "Param\u00e8tres", href: "/games/settings" },
        ],
      },
      {
        label: "Email Marketing",
        icon: Mail,
        basePath: "/email",
        requiredPermission: "settings:read",
        children: [
          { label: "Tableau de bord", href: "/email" },
          { label: "Campagnes", href: "/email/campaigns" },
          { label: "Mod\u00e8les", href: "/email/templates" },
          { label: "Abonn\u00e9s", href: "/email/subscribers" },
          { label: "Segments", href: "/email/segments" },
          { label: "Configuration", href: "/email/config" },
        ],
      },
    ],
  },
  {
    label: "Contenu",
    items: [
      {
        label: "Pages",
        href: "/content/pages",
        icon: FileText,
        requiredPermission: "settings:read",
      },
      {
        label: "Composants",
        href: "/content/components",
        icon: LayoutGrid,
        requiredPermission: "settings:read",
      },
      {
        label: "Blog",
        icon: PenSquare,
        basePath: "/content/blog",
        requiredPermission: "settings:read",
        children: [
          { label: "Articles", href: "/content/blog" },
          { label: "Auto Blog", href: "/content/blog/auto-config" },
        ],
      },
      {
        label: "M\u00e9diath\u00e8que",
        href: "/content/media",
        icon: Image,
        requiredPermission: "settings:read",
      },
    ],
  },
  {
    label: "Organisation",
    items: [
      {
        label: "\u00c9tablissements",
        href: "/stores",
        icon: Store,
        requiredPermission: "stores:read",
      },
      {
        label: "\u00c9quipe & R\u00f4les",
        href: "/team",
        icon: UserCog,
        requiredPermission: "team:read",
      },
      {
        label: "Langues",
        href: "/languages",
        icon: Globe,
        requiredPermission: "settings:read",
      },
      {
        label: "Abonnement",
        href: "/subscription",
        icon: CreditCard,
        requiredPermission: "settings:read",
      },
      {
        label: "Param\u00e8tres",
        href: "/settings",
        icon: Settings,
        requiredPermission: "settings:read",
      },
      {
        label: "Syst\u00e8me & Mises \u00e0 jour",
        href: "/system",
        icon: RefreshCw,
        requiredPermission: "stores:manage",
      },
    ],
  },
]

export { ChevronRight }
