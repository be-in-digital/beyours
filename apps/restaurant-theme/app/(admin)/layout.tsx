"use client"

import { AdminAuthSync } from "@/components/admin/AdminAuthSync"
import {
  AuthGuard,
  AppSidebar,
  AdminHeader,
  SidebarProvider,
  SidebarInset,
} from "@beindigital-engine/admin"
import { StoreSelector } from "@/components/admin/StoreSelector"
import { SidebarUserMenu } from "@/components/admin/SidebarUserMenu"
import { StoreGuard } from "@/components/admin"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AdminAuthSync />
      <AuthGuard>
        <SidebarProvider>
          <AppSidebar
            footer={<StoreSelector />}
            userFooter={<SidebarUserMenu />}
          />
          <SidebarInset>
            <AdminHeader />
            <main className="flex-1 p-6">
              <StoreGuard>{children}</StoreGuard>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AuthGuard>
    </>
  )
}
