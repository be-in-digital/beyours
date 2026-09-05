"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Role } from "@be-in-digital/core"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@be-in-digital/ui"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import { UnreadMessagesBadge } from "./unread-messages-badge"
import {
  navGroups,
  isCollapsible,
  navTourId,
  canRoleSeeNavHref,
  ChevronRight,
  type NavEntry,
  type CollapsibleNavItem,
} from "../config/nav-config"

interface AppSidebarProps {
  footer?: React.ReactNode
  userFooter?: React.ReactNode
  logoUrl?: string | null
  brandName?: string
}

/**
 * Delegated, not reimplemented. The onboarding tour asks the same question by
 * href (`canRoleSeeNavHref`), and a second copy of this rule is exactly how the
 * tour's `nav-*` ids drifted away from the ones the sidebar emits.
 *
 * `modules` is the second gate: `userProfiles.permissions`, the invite dialog's
 * eight checkboxes, which the server narrows a role by and which this sidebar
 * used to ignore entirely.
 */
function canSeeEntry(role: Role, modules: string[], entry: NavEntry): boolean {
  const href = isCollapsible(entry) ? entry.basePath : entry.href
  return canRoleSeeNavHref(role, href, modules)
}
export function AppSidebar({ footer, userFooter, logoUrl, brandName = "BeYours" }: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const role = useAdminAuthStore((s) => s.role)
  const modules = useAdminAuthStore((s) => s.permissions)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild data-tour="sidebar-brand">
              <Link href="/dashboard">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="size-7 rounded-lg object-cover"
                  />
                ) : (
                  <div className="bg-primary text-primary-foreground flex aspect-square size-7 items-center justify-center rounded-lg">
                    <UtensilsCrossed className="size-3.5" />
                  </div>
                )}
                <span className="truncate text-sm font-semibold tracking-tight">
                  {brandName}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((entry) =>
            canSeeEntry(role as Role, modules, entry)
          )
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
                    const tourId = navTourId(entry.href)

                    return (
                      <SidebarMenuItem key={entry.href} data-tour={tourId}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={entry.label}
                        >
                          <Link href={entry.href}>
                            <Icon className="size-4" />
                            <span>{entry.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {entry.badge === "unreadMessages" ? (
                          <UnreadMessagesBadge />
                        ) : null}
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        {isCollapsed ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Établissement">
                <Store className="size-4" />
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

function CollapsibleNavMenuItem({
  item,
  pathname,
}: {
  item: CollapsibleNavItem
  pathname: string
}) {
  const Icon = item.icon
  const isInSection = pathname.startsWith(item.basePath)

  const tourId = navTourId(item.basePath)

  return (
    <Collapsible defaultOpen={isInSection} className="group/collapsible">
      <SidebarMenuItem data-tour={tourId}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.label}>
            <Icon className="size-4" />
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
