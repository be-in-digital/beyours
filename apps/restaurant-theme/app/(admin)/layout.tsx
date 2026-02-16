import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/admin/AppSidebar"
import { AdminHeader } from "@/components/admin"
import { StoreGuard } from "@/components/admin"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 p-6">
          <StoreGuard>{children}</StoreGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
