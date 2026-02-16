"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
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
import { Button } from "../ui/button"
import { useAdminAuthStore } from "../stores/admin-auth-store"
import { getBreadcrumbData } from "../config/route-titles"

/**
 * Admin header component with sidebar trigger, breadcrumb, and user info.
 * Displays user name/email and a sign-out button.
 */
export function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { parentLabel, parentHref, currentLabel } = getBreadcrumbData(pathname)
  const user = useAdminAuthStore((s) => s.user)
  const signOut = useAdminAuthStore((s) => s.signOut)

  const handleSignOut = async () => {
    if (signOut) {
      await signOut()
    }
    router.push("/sign-in")
  }

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
      <div className="ml-auto flex items-center gap-3">
        {user && (
          <span className="text-sm text-muted-foreground">
            {user.name || user.email}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleSignOut}
          title="Se d\u00e9connecter"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
