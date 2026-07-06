import { AdminGate } from "@/components/admin/auth-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "@/components/admin/ui/toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
      <Toaster />
    </AdminGate>
  );
}
