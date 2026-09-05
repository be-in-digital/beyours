import {
  ChefHat,
  ChevronRight,
  CreditCard,
  FileText,
  Gamepad2,
  Globe,
  Image,
  Inbox,
  LayoutDashboard,
  LayoutList,
  Mail,
  Palette,
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
import { hasPermission, type Permission, type Role } from "@be-in-digital/core"
import { profileAllowsPermission } from "@be-in-digital/convex-functions/teamAccess"
import { adminRoutes } from "./admin-routes"

// ─── Types ──────────────────────────────────────────────────────────────────────

/**
 * A live count the sidebar renders next to an entry.
 *
 * One value today. It is named rather than passed as a number because the
 * count is a subscription — the sidebar has to run the query itself, and
 * `navGroups` is plain data.
 */
export type NavBadge = "unreadMessages"

/** Standard navigation item (no children) */
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  requiredPermission?: Permission
  badge?: NavBadge
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

// ─── Tour anchors ───────────────────────────────────────────────────────────────

/**
 * The `data-tour` id the sidebar puts on the entry for `href`.
 *
 * WHY THIS IS A FUNCTION: it used to be an inline template literal in
 * `app-sidebar.tsx`, written twice (flat branch and collapsible branch), while
 * the onboarding tour carried its own hand-typed copies of the results. When
 * the admin moved under `/dashboard`, the sidebar's ids followed the hrefs and
 * the tour's did not — `nav-orders` against an emitted `nav-dashboard-orders`,
 * 19 of 20 highlights pointing at nothing. Both the sidebar and the tour now
 * call this, so an href change cannot desynchronise them again.
 */
export function navTourId(href: string): string {
  return `nav-${href.replace(/^\//, "").replace(/\//g, "-")}`
}

/** The `data-tour` id of every entry the sidebar renders, flat and collapsible. */
export function navTourIds(): string[] {
  return navGroups.flatMap((group) =>
    group.items.map((entry) =>
      navTourId(isCollapsible(entry) ? entry.basePath : entry.href)
    )
  )
}

/**
 * Whether this operator is shown the entry that leads to `href`.
 *
 * The same question `app-sidebar.tsx`'s `canSeeEntry` answers, asked by href
 * rather than by entry, because the onboarding tour knows a route and needs to
 * find out whether there is a menu item to point at. A `kitchen` account is
 * shown 3 of the 21 entries; without this the tour would spend most of itself
 * spotlighting elements that account never renders.
 *
 * BOTH of the server's gates, in the server's order
 * (`convex-functions/src/auth.ts`, `requireStorePermission`): the RBAC role
 * check, then `profileAllowsPermission`, which narrows the role to the modules
 * the owner actually ticked in the invite dialog. Running only the first is
 * what showed a member every entry their role permits and let the server refuse
 * half of them with `module_denied` — a link that opens an error page is worse
 * than no link, because the operator cannot tell a missing right from a broken
 * product.
 *
 * `profileAllowsPermission` is imported rather than reimplemented: it is the
 * function the server calls, and a second copy of a policy is a second copy to
 * drift. It reads an empty module list as unrestricted, which is what every
 * existing deployment carries.
 */
export function canRoleSeeNavHref(
  role: Role,
  href: string,
  modules: string[] = []
): boolean {
  for (const group of navGroups) {
    for (const entry of group.items) {
      const entryHref = isCollapsible(entry) ? entry.basePath : entry.href
      if (entryHref !== href) continue
      const permission = entry.requiredPermission
      if (!permission) return true
      if (!hasPermission(role, permission as Permission)) return false
      return profileAllowsPermission({ role, permissions: modules }, permission)
    }
  }
  return false
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
      /**
       * Gated on the permission the KDS screen's own queries enforce, not on
       * the one that merely sounds adjacent.
       *
       * This read `orders:read`, and `waiter` and `delivery` hold that while
       * holding no `kitchen:read` — so every server and every driver the owner
       * added from the Team screen was shown a "Cuisine (KDS)" link, clicked
       * it, and landed on an error page. Convex rethrows a refusal out of
       * `useQuery` during render, so the screen never got as far as drawing an
       * empty state; it unwound. `kitchenTickets.getByStore`, `getPrintQueue`,
       * `getOverdueCount` and `getPrintStuckCount` all require `kitchen:read`.
       */
      {
        label: "Cuisine (KDS)",
        href: adminRoutes.kitchen,
        icon: ChefHat,
        requiredPermission: "kitchen:read",
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
      // "Clients" is deliberately kept out of the nav until the page is
      // built (the /dashboard/customers route stays reachable).
      {
        label: "Inventaire",
        href: adminRoutes.inventory,
        icon: Warehouse,
        requiredPermission: "products:read",
      },
      {
        label: "Messages",
        href: adminRoutes.messages,
        icon: Inbox,
        requiredPermission: "customers:read",
        badge: "unreadMessages",
      },
      {
        label: "Paiements",
        href: adminRoutes.payments,
        icon: CreditCard,
        requiredPermission: "payments:read",
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      /**
       * `promotions.list` enforces `marketing:read`, not `games:read`.
       *
       * Both resolve to the same three roles today, so nothing was visibly
       * broken — but the resource NAME is load-bearing on its own. The server
       * runs a second gate after the role check, `profileAllowsPermission`,
       * which maps a permission's resource onto one of the eight module
       * checkboxes the invite dialog offers. Naming the wrong resource is a
       * refusal waiting for the first owner who ticks the boxes.
       */
      {
        label: "Promotions",
        href: adminRoutes.promotions,
        icon: Tag,
        requiredPermission: "marketing:read",
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
        // Every screen behind this entry — campaigns, templates, subscribers,
        // segments, config — enforces `marketing:read`. `settings:read` maps to
        // a different module (`settings` rather than `marketing`), so a member
        // granted settings and not marketing was shown all six and refused all
        // six.
        requiredPermission: "marketing:read",
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
      // The list itself is an unguarded query, but it exists to open the page
      // editor, and `cms.getAdminPageBlocks` enforces `content:read`. Gating
      // the entry on the resource its own screens are about keeps it in the
      // same module as Blog and Médiathèque, which is where the server puts it.
      {
        label: "Pages",
        href: adminRoutes.contentPages,
        icon: FileText,
        requiredPermission: "content:read",
      },
      // "Composants" is deliberately left out until the editor exists.
      {
        label: "Blog",
        icon: PenSquare,
        basePath: adminRoutes.contentBlog,
        // `blog.listAdminArticles` and `blogAutoConfig.getByStoreId` enforce
        // `content:read`.
        requiredPermission: "content:read",
        children: [
          { label: "Articles", href: adminRoutes.contentBlog },
          { label: "Auto Blog", href: adminRoutes.contentBlogAutoConfig },
        ],
      },
      // `cmsMedia.listMedia` enforces `content:read`.
      {
        label: "Médiathèque",
        href: adminRoutes.contentMedia,
        icon: Image,
        requiredPermission: "content:read",
      },
      /**
       * Colours, typography and logo of the storefront.
       *
       * Gated on `stores:read` and not on `stores:write`, because this entry
       * answers "may you look at it". The saves ask the second question
       * themselves — see `lib/branding-eligibility.ts`. `manager` holds the
       * read and not the write, so it reaches this screen with every save
       * button drawn inert and explained.
       */
      {
        label: "Design",
        href: adminRoutes.design,
        icon: Palette,
        requiredPermission: "stores:read",
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
