"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Deprecated — administering the affiliate programme now lives entirely in the
 * superadmin console (/admin/apporteurs), which is built on the real component
 * library (tables, skeletons, toasts) and the « salle de contrôle » theme. This
 * stub redirects so that old links / bookmarks keep working. Access control
 * (affiliate `role: admin`) is identical on the /admin side.
 */
export default function DeprecatedAffiliateAdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/apporteurs");
  }, [router]);

  return (
    <div
      role="status"
      aria-label="Redirection vers la console d'administration"
      className="max-w-6xl mx-auto px-4 py-24 text-center"
    >
      <div className="animate-pulse text-muted-foreground">
        Redirection vers la console d&apos;administration…
      </div>
    </div>
  );
}
