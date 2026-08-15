"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { hasPermission, type Role, type Permission } from "@be-in-digital/core"
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

interface AppSidebarProps {
  footer?: React.ReactNode
  userFooter?: React.ReactNode
  logoUrl?: string | null
  brandName?: string
}

function canSeeEntry(role: Role, entry: NavEntry): boolean {
  const permission = entry.requiredPermission
  if (!permission) return true
  return hasPermission(role, permission as Permission)
}

export function AppSidebar({ footer, userFooter, logoUrl, brandName = "BeYours" }: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const role = useAdminAuthStore((s) => s.role)

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
            canSeeEntry(role as Role, entry)
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
                    const tourId = `nav-${entry.href.replace(/^\//, "").replace(/\//g, "-")}`

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

  const tourId = `nav-${item.basePath.replace(/^\//, "").replace(/\//g, "-")}`

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
