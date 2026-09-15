import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/auth-gate";
import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "@/components/admin/ui/toast";

/**
 * The operations console asks not to be indexed (#535).
 *
 * `robots.ts` disallows this path too, and that is a request a crawler may
 * ignore — or never see, if it reaches a url from a link rather than from the
 * root. This tag is what travels with the page itself. Both halves, on purpose.
 *
 * `follow: false` as well: there is nothing here worth following, and every
 * link beneath a sign-in wall leads to another one.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
