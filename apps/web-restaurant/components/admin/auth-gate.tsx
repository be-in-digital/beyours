"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, ShieldAlert } from "lucide-react";

export type AdminProfile = {
  _id: string;
  firstName?: string;
  lastName?: string;
  role: "affiliate" | "admin";
  email: string | null;
  displayName: string;
};

const AdminContext = React.createContext<AdminProfile | null>(null);
export function useAdmin(): AdminProfile | null {
  return React.useContext(AdminContext);
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="canvas-glow grid min-h-dvh place-items-center bg-background">
      {children}
    </div>
  );
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.affiliateUsers.me, isAuthenticated ? {} : "skip");

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Vérification de la session…</span>
        </div>
      </FullScreen>
    );
  }

  if (me === undefined) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Chargement de l’espace…</span>
        </div>
      </FullScreen>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <FullScreen>
        <div className="mx-4 max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
            <ShieldAlert className="size-5" />
          </div>
          <h1 className="font-display text-lg font-semibold">Accès réservé</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Cet espace est réservé aux administrateurs BeInDigital.
          </p>
          <Link
            href="/parrainage/dashboard"
            className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour au dashboard
          </Link>
        </div>
      </FullScreen>
    );
  }

  const displayName =
    me.firstName && me.lastName
      ? `${me.firstName} ${me.lastName}`
      : (me.email ?? "Administrateur");

  const profile: AdminProfile = {
    _id: me._id,
    firstName: me.firstName,
    lastName: me.lastName,
    role: me.role,
    email: me.email,
    displayName,
  };

  return <AdminContext.Provider value={profile}>{children}</AdminContext.Provider>;
}
