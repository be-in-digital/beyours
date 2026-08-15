"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Déprécié — l'administration du programme d'apporteurs est désormais unifiée
 * dans la console superadmin (/admin/apporteurs), qui s'appuie sur la vraie
 * librairie de composants (tables, skeletons, toasts) et le thème « salle de
 * contrôle ». Ce stub redirige pour préserver les anciens liens / marque-pages.
 * Le contrôle d'accès (apporteur `role: admin`) est identique côté /admin.
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
