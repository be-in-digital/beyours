"use client"

import { useEffect } from "react"
import { api } from "@/convex/_generated/api"
import { AdminAuthSync } from "@/components/admin/AdminAuthSync"
import {
  AuthGuard,
  AppSidebar,
  AdminHeader,
  SidebarProvider,
  SidebarInset,
  StoreSelector,
  SidebarUserMenu,
  StoreGuard,
  useAdminApiStore,
} from "@beindigital-engine/admin"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    useAdminApiStore.getState().setApi(api as unknown as Record<string, unknown>)
  }, [])

  return (
    <>
      <AdminAuthSync />
      <AuthGuard>
        <SidebarProvider>
          <AppSidebar
            userFooter={<SidebarUserMenu />}
          />
          <SidebarInset>
            <AdminHeader storeSelector={<StoreSelector />} />
            <main className="flex-1 px-6 py-5 lg:px-8 min-w-0 overflow-x-hidden">
              <div className="mx-auto max-w-[1600px]">
                <StoreGuard>{children}</StoreGuard>
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AuthGuard>
    </>
  )
}
