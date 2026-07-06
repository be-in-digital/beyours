"use client";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

type Tab = "stats" | "affiliates" | "referrals" | "settings";

function formatCents(cents: number) {
  return `${(cents / 100).toFixed(0)} €`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    validated: { label: "Validé", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    payable: { label: "À verser", cls: "bg-primary/10 text-primary border-primary/20" },
    paid: { label: "Payé", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    cancelled: { label: "Annulé", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    blocked: { label: "Bloqué", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    active: { label: "Actif", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    suspended: { label: "Suspendu", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    rejected: { label: "Rejeté", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  };
  const s = map[status] ?? { label: status, cls: "bg-white/[0.04] text-muted-foreground border-white/[0.08]" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const affiliate = useQuery(api.affiliateUsers.me, isAuthenticated ? {} : "skip");
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/parrainage/connexion");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (affiliate && affiliate.role !== "admin") {
      router.push("/parrainage/dashboard");
    }
  }, [affiliate, router]);

  if (isLoading || !isAuthenticated || affiliate === undefined) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="animate-pulse text-muted-foreground text-center">Chargement...</div>
      </div>
    );
  }

  if (affiliate?.role !== "admin") return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "stats", label: "Vue d'ensemble" },
    { key: "affiliates", label: "Apporteurs" },
    { key: "referrals", label: "Parrainages" },
    { key: "settings", label: "Paramètres" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/parrainage/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Administration</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/[0.02] border border-white/[0.06] w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stats" && <StatsTab />}
      {tab === "affiliates" && <AffiliatesTab />}
      {tab === "referrals" && <ReferralsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function StatsTab() {
  const stats = useQuery(api.admin.getStats);

  if (!stats) {
    return <div className="animate-pulse text-muted-foreground">Chargement...</div>;
  }

  const kpis = [
    { label: "Apporteurs actifs", value: String(stats.activeAffiliates), sub: `${stats.totalAffiliates} total` },
    { label: "Parrainages", value: String(stats.totalReferrals), sub: `${stats.pendingReferrals} en attente` },
    { label: "Validés", value: String(stats.validatedReferrals), sub: `${stats.paidReferrals} payés` },
    { label: "Commissions payées", value: formatCents(stats.totalCommissions), sub: `${formatCents(stats.pendingCommissions)} en attente` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
          <p className="text-xl font-bold">{kpi.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
        </div>
      ))}
    </div>
  );
}

function AffiliatesTab() {
  const affiliates = useQuery(api.admin.listAffiliates);
  const updateStatus = useMutation(api.admin.updateAffiliateStatus);

  if (!affiliates) {
    return <div className="animate-pulse text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-white/[0.06]">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Filleuls</th>
              <th className="px-4 py-3">Gagné</th>
              <th className="px-4 py-3">En attente</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {affiliates.map((a) => (
              <tr key={a._id}>
                <td className="px-4 py-3 text-muted-foreground">{a.email ?? "—"}</td>
                <td className="px-4 py-3">
                  {a.firstName && a.lastName ? `${a.firstName} ${a.lastName}` : "—"}
                </td>
                <td className="px-4 py-3">{a.role}</td>
                <td className="px-4 py-3">{statusBadge(a.status)}</td>
                <td className="px-4 py-3">{statusBadge(a.stripeConnectStatus)}</td>
                <td className="px-4 py-3">{a.referralCount}</td>
                <td className="px-4 py-3 font-medium">{formatCents(a.totalEarned)}</td>
                <td className="px-4 py-3">{formatCents(a.pendingEarnings)}</td>
                <td className="px-4 py-3">
                  {a.status === "active" ? (
                    <button
                      onClick={() => updateStatus({ affiliateUserId: a._id as Id<"affiliateUsers">, status: "suspended" })}
                      className="text-xs text-amber-400 hover:text-amber-300"
                    >
                      Suspendre
                    </button>
                  ) : a.status === "suspended" ? (
                    <button
                      onClick={() => updateStatus({ affiliateUserId: a._id as Id<"affiliateUsers">, status: "active" })}
                      className="text-xs text-green-400 hover:text-green-300"
                    >
                      Réactiver
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {affiliates.length === 0 && (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Aucun apporteur inscrit.
        </div>
      )}
    </div>
  );
}

function ReferralsTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const referrals = useQuery(
    api.admin.listReferrals,
    statusFilter ? { status: statusFilter as "pending" | "validated" | "payable" | "paid" | "cancelled" | "blocked" } : {},
  );
  const blockPayout = useMutation(api.admin.blockReferralPayout);
  const unblockPayout = useMutation(api.admin.unblockReferralPayout);

  const statuses = ["pending", "validated", "payable", "paid", "cancelled", "blocked"];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter(undefined)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !statusFilter ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
          }`}
        >
          Tous
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-white/[0.06]">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Apporteur</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Réduction</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {referrals?.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.customerEmail}</p>
                    {r.customerName && <p className="text-xs text-muted-foreground">{r.customerName}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.affiliateName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.affiliateEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCents(r.commissionCents)}</td>
                  <td className="px-4 py-3">{r.discountPercent}% ({formatCents(r.discountAmountCents)})</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {(r.status === "validated" || r.status === "payable") && (
                      <button
                        onClick={() => blockPayout({ referralId: r._id as Id<"referrals"> })}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Bloquer
                      </button>
                    )}
                    {r.status === "blocked" && (
                      <button
                        onClick={() => unblockPayout({ referralId: r._id as Id<"referrals"> })}
                        className="text-xs text-green-400 hover:text-green-300"
                      >
                        Débloquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {referrals?.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Aucun parrainage trouvé.
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const settings = useQuery(api.affiliateSettings.get);
  const updateSettings = useMutation(api.admin.updateSettings);

  const [commissionCents, setCommissionCents] = useState(50000);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [delayDays, setDelayDays] = useState(14);
  const [programEnabled, setProgramEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setCommissionCents(settings.defaultCommissionCents);
      setDiscountPercent(settings.defaultDiscountPercent);
      setDelayDays(settings.validationDelayDays);
      setProgramEnabled(settings.programEnabled);
      setInitialized(true);
    }
  }, [settings, initialized]);

  async function handleSave() {
    setSaving(true);
    setSuccess(false);
    try {
      await updateSettings({
        defaultCommissionCents: commissionCents,
        defaultDiscountPercent: discountPercent,
        validationDelayDays: delayDays,
        programEnabled,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <h2 className="text-base font-semibold mb-6">Paramètres du programme</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Commission par défaut (en centimes)
            </label>
            <input
              type="number"
              value={commissionCents}
              onChange={(e) => setCommissionCents(Number(e.target.value))}
              className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">
              = {formatCents(commissionCents)} par parrainage
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Réduction client par défaut (%)
            </label>
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              min={0}
              max={100}
              className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Délai de validation (jours)
            </label>
            <input
              type="number"
              value={delayDays}
              onChange={(e) => setDelayDays(Number(e.target.value))}
              min={1}
              className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProgramEnabled(!programEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                programEnabled ? "bg-primary" : "bg-white/[0.08]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  programEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm">Programme actif</span>
          </div>
        </div>

        {success && (
          <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            Paramètres sauvegardés
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
