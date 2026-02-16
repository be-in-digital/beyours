"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Separator } from "../ui/separator"
import { SidebarTrigger } from "../ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb"
import { getBreadcrumbData } from "../config/route-titles"

/**
 * Admin header component with sidebar trigger and breadcrumb.
 * User info and sign-out are now in the sidebar footer.
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
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={parentHref}>{parentLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
