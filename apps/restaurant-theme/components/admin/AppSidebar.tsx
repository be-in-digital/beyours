"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRight,
  FileText,
  Gamepad2,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { StoreSelector } from "./StoreSelector"

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Standard navigation item (no children) */
interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

/** Sub-menu item displayed inside a collapsible section */
interface SubNavItem {
  label: string
  href: string
}

/** Collapsible navigation item with a sub-menu */
interface CollapsibleNavItem {
  label: string
  icon: LucideIcon
  basePath: string
  children: SubNavItem[]
}

/** A navigation entry can be either a standard item or a collapsible one */
type NavEntry = NavItem | CollapsibleNavItem

/** Navigation group that holds a set of entries */
interface NavGroup {
  label: string
  items: NavEntry[]
}

// ─── Type guard ─────────────────────────────────────────────────────────────────

/** Check whether a nav entry is collapsible (has children) */
function isCollapsible(entry: NavEntry): entry is CollapsibleNavItem {
  return "children" in entry
}

// ─── Navigation structure ───────────────────────────────────────────────────────

const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Opérations",
    items: [
      { label: "Commandes", href: "/orders", icon: ShoppingCart },
      { label: "Menu & Produits", href: "/products", icon: UtensilsCrossed },
      { label: "Clients", href: "/customers", icon: Users },
      { label: "Inventaire", href: "/inventory", icon: Warehouse },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Promotions", href: "/promotions", icon: Tag },
      {
        label: "Gamification",
        icon: Gamepad2,
        basePath: "/games",
        children: [
          { label: "Dashboard", href: "/games" },
          { label: "Jeux", href: "/games/catalog" },
          { label: "QR Codes", href: "/games/qr-codes" },
          { label: "Actions", href: "/games/actions" },
          { label: "Gagnants", href: "/games/winners" },
          { label: "Paramètres", href: "/games/settings" },
        ],
      },
      {
        label: "Email Marketing",
        icon: Mail,
        basePath: "/email",
        children: [
          { label: "Dashboard", href: "/email" },
          { label: "Campagnes", href: "/email/campaigns" },
          { label: "Modèles", href: "/email/templates" },
          { label: "Abonnés", href: "/email/subscribers" },
          { label: "Segments", href: "/email/segments" },
          { label: "Configuration", href: "/email/config" },
        ],
      },
    ],
  },
  {
    label: "Contenu",
    items: [
      { label: "Pages", href: "/content/pages", icon: FileText },
      { label: "Composants", href: "/content/components", icon: LayoutGrid },
      { label: "Blog", href: "/content/blog", icon: PenSquare },
      { label: "Médiathèque", href: "/content/media", icon: Image },
    ],
  },
  {
    label: "Organisation",
    items: [
      { label: "Établissements", href: "/stores", icon: Store },
      { label: "Équipe & Rôles", href: "/team", icon: UserCog },
      { label: "Paramètres", href: "/settings", icon: Settings },
      { label: "Système & Mises à jour", href: "/system", icon: RefreshCw },
    ],
  },
]

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * Application sidebar using shadcn/ui Sidebar component.
 * Features 5 navigation groups with collapsible sub-menus
 * for Gamification and Email Marketing sections.
 * Collapsible to icon-only mode with tooltip support.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon">
      {/* Brand header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">BeInDigital</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Restaurant Admin
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation groups */}
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((entry) => {
                  if (isCollapsible(entry)) {
                    return (
                      <CollapsibleNavMenuItem
                        key={entry.basePath}
                        item={entry}
                        pathname={pathname}
                      />
                    )
                  }

                  const Icon = entry.icon
                  const isActive =
                    pathname === entry.href ||
                    pathname.startsWith(entry.href + "/")

                  return (
                    <SidebarMenuItem key={entry.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={entry.label}
                      >
                        <Link href={entry.href}>
                          <Icon />
                          <span>{entry.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Store selector in footer - shows icon-only when collapsed */}
      <SidebarFooter>
        {isCollapsed ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Établissement">
                <Store />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <StoreSelector />
        )}
      </SidebarFooter>

      {/* Rail for resize/toggle handle */}
      <SidebarRail />
    </Sidebar>
  )
}

// ─── Collapsible sub-menu component ─────────────────────────────────────────────

/**
 * Renders a collapsible navigation menu item with sub-items.
 * Automatically opens when the current pathname matches the base path.
 */
function CollapsibleNavMenuItem({
  item,
  pathname,
}: {
  item: CollapsibleNavItem
  pathname: string
}) {
  const Icon = item.icon
  const isInSection = pathname.startsWith(item.basePath)

  return (
    <Collapsible
      defaultOpen={isInSection}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.label}>
            <Icon />
            <span>{item.label}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === child.href}
                >
                  <Link href={child.href}>
                    <span>{child.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
