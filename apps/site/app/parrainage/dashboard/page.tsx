"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { InvoiceUpload } from "@/components/parrainage/invoice-upload";
import { COMPANY } from "@/lib/legal";
import { AFFILIATE_REFERRAL_STATUS } from "@/lib/referral-status";

function formatCents(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

function statusBadge(status: string) {
  /* The vocabulary lives in `lib/referral-status.ts`, not here: a map declared
     inside a page is one no test can import, and that is how #384's `paying`
     reached an affiliate as a raw English literal (#411). */
  const s = AFFILIATE_REFERRAL_STATUS[status] ?? {
    label: status,
    cls: "bg-secondary text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const affiliate = useQuery(
    api.affiliateUsers.me,
    isAuthenticated ? {} : "skip",
  );
  const referralCode = useQuery(
    api.referralCodes.getMyCode,
    isAuthenticated ? {} : "skip",
  );
  const settings = useQuery(api.affiliateSettings.get);
  const stats = useQuery(
    api.referrals.getMyStats,
    isAuthenticated ? {} : "skip",
  );
  const referrals = useQuery(
    api.referrals.getMyReferrals,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  // Guard: redirect if contract not signed
  useEffect(() => {
    if (
      affiliate &&
      affiliate.contractStatus !== "active"
    ) {
      router.push("/parrainage/contrat");
    }
  }, [affiliate, router]);

  if (
    isLoading ||
    !isAuthenticated ||
    affiliate === undefined ||
    referralCode === undefined
  ) {
    return <DashboardSkeleton />;
  }

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://beyours.fr";
  const referralLink = referralCode
    ? `${siteUrl}/checkout?ref=${referralCode.code}`
    : null;

  const commissionAmount = affiliate?.commissionOverrideCents
    ? affiliate.commissionOverrideCents / 100
    : (settings?.defaultCommissionCents ?? 50000) / 100;

  const profileComplete = affiliate?.firstName && affiliate?.lastName;
  const isAdmin = affiliate?.role === "admin";
  const stripeStatus = affiliate?.stripeConnectStatus ?? "not_started";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {affiliate?.firstName
              ? `Bonjour, ${affiliate.firstName}`
              : "Bienvenue"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Votre espace apporteur d&apos;affaires
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin/apporteurs"
              className="inline-flex items-center h-9 px-4 rounded-lg bg-warning-soft border border-warning-border text-warning-strong text-sm font-medium hover:bg-warning/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Console admin
            </Link>
          )}
          <Link
            href="/parrainage/dashboard/profil"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-surface-1 border border-border text-sm hover:bg-surface-3 transition-colors"
          >
            Profil
          </Link>
          <Link
            href="/parrainage/dashboard/partage"
            className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Partager
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {!profileComplete && (
        <div className="mb-6 p-4 rounded-xl bg-warning-soft border border-warning-border text-warning-strong text-sm flex items-start gap-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="flex-shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="font-medium">Complétez votre profil</p>
            <p className="text-foreground/80 mt-1">
              Ajoutez votre nom et prénom pour pouvoir recevoir vos commissions.
            </p>
            <Link
              href="/parrainage/dashboard/profil"
              className="inline-flex items-center mt-2 text-warning-strong hover:text-warning-strong/80 font-medium"
            >
              Compléter mon profil &rarr;
            </Link>
          </div>
        </div>
      )}

      {stripeStatus === "not_started" && profileComplete && (
        <div className="mb-6 p-4 rounded-xl bg-info-soft border border-info-border text-info-strong text-sm flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="font-medium">Configurez votre compte de paiement</p>
            <p className="text-foreground/80 mt-1">
              Connectez Stripe pour recevoir vos commissions automatiquement.
            </p>
            <Link
              href="/parrainage/dashboard/profil"
              className="inline-flex items-center mt-2 text-info-strong hover:text-info-strong/80 font-medium"
            >
              Configurer &rarr;
            </Link>
          </div>
        </div>
      )}

      {/*
        A total that stopped at the read cap is a FLOOR, and saying so is the
        whole point: this figure and the admin console's were computed over two
        different caps with neither screen admitting it, so one set of
        commissions produced two euro totals and the affiliate was shown the
        smaller one.
      */}
      {stats?.truncated && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-warning-border bg-warning-soft p-4 text-sm text-warning-strong"
        >
          Vous avez plus de filleuls que cette page n&apos;en affiche : les
          montants ci-dessous sont donc des minimums. Contactez-nous pour le
          détail complet de vos commissions.
        </div>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Commission / client",
            value: `${commissionAmount} €`,
            sub: "montant actuel",
          },
          {
            label: "Filleuls",
            value: String(stats?.totalReferrals ?? 0),
            sub: `${stats?.pendingCount ?? 0} en attente`,
          },
          {
            label: "En attente",
            value: formatCents(stats?.totalPending ?? 0),
            sub: "non versé",
          },
          {
            label: "Revenus",
            value: formatCents(stats?.totalEarned ?? 0),
            sub: `${stats?.paidCount ?? 0} versement(s)`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-xl bg-surface-1 border border-border"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Referral code card */}
      {referralCode && (
        <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-8">
          <h2 className="text-base font-semibold mb-4">
            Votre code de parrainage
          </h2>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-lg font-mono font-bold text-primary-ink">
                  {referralCode.code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referralCode.code);
                  }}
                  className="text-primary-ink/60 hover:text-primary-ink transition-colors"
                  title="Copier le code"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </button>
              </div>
              {referralLink && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Lien de parrainage :
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-foreground bg-secondary px-2 py-1 rounded truncate max-w-xs">
                      {referralLink}
                    </code>
                    <button
                      onClick={() => {
                        if (referralLink) navigator.clipboard.writeText(referralLink);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      title="Copier le lien"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="14" height="14" x="8" y="8" rx="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/parrainage/dashboard/partage"
              className="inline-flex items-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Partager
            </Link>
          </div>
        </div>
      )}

      {/* Referrals list */}
      {referrals && referrals.length > 0 ? (
        <div className="p-6 rounded-2xl bg-surface-1 border border-border">
          <h2 className="text-base font-semibold mb-1">Mes filleuls</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Pour être payé, joignez votre facture (établie à l&apos;ordre de{" "}
            {COMPANY.operatorName}, {COMPANY.address.street},{" "}
            {COMPANY.address.postalCode} {COMPANY.address.city}, SIRET{" "}
            {COMPANY.siret}) à chaque commission. Aucun versement sans facture.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Commission</th>
                  <th className="pb-3 pr-4">Facture</th>
                  <th className="pb-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((r) => (
                  <tr key={r._id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{r.customerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.customerEmail}</p>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {formatCents(r.commissionCents)}
                    </td>
                    <td className="py-3 pr-4">
                      {r.status === "cancelled" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <InvoiceUpload
                          referralId={r._id}
                          uploaded={!!r.invoiceStorageId}
                        />
                      )}
                    </td>
                    <td className="py-3">
                      {statusBadge(r.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-surface-1 border border-border text-center">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-1">Aucun filleul</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Partagez votre code de parrainage pour commencer à gagner des
            commissions. Chaque client apporté vous rapporte {commissionAmount} €.
          </p>
        </div>
      )}
    </div>
  );
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement du tableau de bord"
      className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <SkeletonBar className="h-7 w-48" />
          <SkeletonBar className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-9 w-20" />
          <SkeletonBar className="h-9 w-24" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface-1 border border-border space-y-3"
          >
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-6 w-16" />
            <SkeletonBar className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Referral code card */}
      <div className="p-6 rounded-2xl bg-surface-1 border border-border mb-8 space-y-4">
        <SkeletonBar className="h-4 w-40" />
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-11 w-40" />
          <SkeletonBar className="h-9 w-24" />
        </div>
      </div>
      {/* Referrals table card */}
      <div className="p-6 rounded-2xl bg-surface-1 border border-border space-y-4">
        <SkeletonBar className="h-4 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBar key={i} className="h-10 w-full" />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
