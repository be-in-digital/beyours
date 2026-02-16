"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { hasPermission, type Role, type Permission } from "@beindigital-engine/core"
import { UtensilsCrossed, Store } from "lucide-react"
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
} from "../ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import {
  navGroups,
  isCollapsible,
  ChevronRight,
  type NavEntry,
  type CollapsibleNavItem,
} from "../config/nav-config"

// ─── Props ──────────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  /** Footer content (e.g. StoreSelector) injected by the consuming app */
  footer?: React.ReactNode
  /** User menu rendered at the very bottom of the sidebar */
  userFooter?: React.ReactNode
}

// ─── Permission filter ──────────────────────────────────────────────────────────

/**
 * Check if a nav entry should be visible for the given role.
 * Items without requiredPermission are always visible.
 */
function canSeeEntry(role: Role, entry: NavEntry): boolean {
  const permission = entry.requiredPermission
  if (!permission) return true
  return hasPermission(role, permission as Permission)
}

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * Application sidebar with RBAC filtering.
 * Menu items are filtered based on the authenticated user's role.
 * Groups with no visible items are hidden entirely.
 */
export function AppSidebar({ footer, userFooter }: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const role = useAdminAuthStore((s) => s.role)

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
                    Administration
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Navigation groups with RBAC filtering */}
      <SidebarContent>
        {navGroups.map((group) => {
          // Filter items by permission
          const visibleItems = group.items.filter((entry) =>
            canSeeEntry(role as Role, entry)
          )

          // Hide groups with no visible items
          if (visibleItems.length === 0) return null

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((entry) => {
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
          )
        })}
      </SidebarContent>

      {/* Footer with injected content (StoreSelector + user menu) */}
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
          <>
            {footer}
            {userFooter}
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

// ─── Collapsible sub-menu component ─────────────────────────────────────────────

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
    <Collapsible defaultOpen={isInSection} className="group/collapsible">
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
