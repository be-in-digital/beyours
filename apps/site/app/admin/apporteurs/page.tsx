"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Users,
  Share2,
  BadgeCheck,
  Wallet,
  Ban,
  RotateCcw,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
import { REFERRAL_STATUS, StatusBadge } from "@/components/admin/status";
import { Badge, type BadgeProps } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { toast } from "@/components/admin/ui/toast";
import { formatCentsRounded, formatDate, formatNumber } from "@/lib/format";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const AFFILIATE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Actif", variant: "success" },
  suspended: { label: "Suspendu", variant: "warning" },
  rejected: { label: "Rejeté", variant: "danger" },
};

const STRIPE_CONNECT: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Connecté", variant: "success" },
  pending: { label: "En cours", variant: "warning" },
  disabled: { label: "Désactivé", variant: "danger" },
  not_started: { label: "Non lié", variant: "muted" },
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  affiliate: "Apporteur",
};

export default function AdminApporteursPage() {
  const [tab, setTab] = React.useState("apporteurs");
  const stats = useQuery(api.admin.getStats, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apporteurs d'affaires"
        description="Programme de parrainage — apporteurs, commissions et réglages."
      />

      {/* KPI */}
      {stats === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Apporteurs actifs"
            value={formatNumber(stats.activeAffiliates)}
            hint={`${formatNumber(stats.totalAffiliates)} au total`}
            icon={<Users />}
          />
          <KpiCard
            label="Parrainages"
            value={formatNumber(stats.totalReferrals)}
            hint={`${formatNumber(stats.pendingReferrals)} en attente`}
            icon={<Share2 />}
          />
          <KpiCard
            label="Validés"
            value={formatNumber(stats.validatedReferrals)}
            hint={`${formatNumber(stats.paidReferrals)} payés`}
            icon={<BadgeCheck />}
          />
          <KpiCard
            label="Commissions payées"
            value={formatCentsRounded(stats.totalCommissions)}
            hint={`${formatCentsRounded(stats.pendingCommissions)} en attente`}
            icon={<Wallet />}
          />
        </div>
      )}

      {/*
        Every figure above stopped at a read cap. It is said out loud because
        the alternative was measured: this dashboard summed 500 referrals while
        an affiliate's own portal summed 200, so one set of commissions
        produced two euro totals and nothing on either screen admitted it.
      */}
      {stats?.truncated && (
        <p
          role="status"
          className="rounded-lg border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning-strong"
        >
          Il y a plus d&apos;apporteurs ou de parrainages que cette page
          n&apos;en lit en une fois : les montants ci-dessus sont des minimums,
          pas des totaux.
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="apporteurs">Apporteurs</TabsTrigger>
          <TabsTrigger value="parrainages">Parrainages</TabsTrigger>
          <TabsTrigger value="parametres">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="apporteurs">
          <AffiliatesTab />
        </TabsContent>
        <TabsContent value="parrainages">
          <ReferralsTab />
        </TabsContent>
        <TabsContent value="parametres">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Onglet Apporteurs ── */

function AffiliatesTab() {
  const affiliates = useQuery(api.admin.listAffiliates, {});
  const updateStatus = useMutation(api.admin.updateAffiliateStatus);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function toggle(
    id: Id<"affiliateUsers">,
    current: string,
  ) {
    const next = current === "active" ? "suspended" : "active";
    setPendingId(id);
    try {
      await updateStatus({ affiliateUserId: id, status: next });
      toast.success(next === "active" ? "Apporteur réactivé" : "Apporteur suspendu");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      {affiliates === undefined ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : affiliates.length === 0 ? (
        <EmptyState
          className="m-4"
          icon={<Users />}
          title="Aucun apporteur"
          description="Les apporteurs inscrits au programme apparaîtront ici."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Stripe</TableHead>
              <TableHead className="text-right">Filleuls</TableHead>
              <TableHead className="text-right">Gagné</TableHead>
              <TableHead className="text-right">En attente</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiliates.map((a) => {
              const name = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
              const stripe = STRIPE_CONNECT[a.stripeConnectStatus] ?? {
                label: a.stripeConnectStatus,
                variant: "muted" as BadgeVariant,
              };
              const st = AFFILIATE_STATUS[a.status] ?? {
                label: a.status,
                variant: "muted" as BadgeVariant,
              };
              const isActive = a.status === "active";
              return (
                <TableRow key={a._id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {name || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.email ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ROLE_LABEL[a.role] ?? a.role}
                  </TableCell>
                  <TableCell>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stripe.variant}>{stripe.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-foreground tnum">
                    {formatNumber(a.referralCount)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tnum">
                    {formatCentsRounded(a.totalEarned)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tnum">
                    {formatCentsRounded(a.pendingEarnings)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={isActive ? "outline" : "secondary"}
                      size="sm"
                      disabled={pendingId === a._id}
                      onClick={() =>
                        toggle(a._id as Id<"affiliateUsers">, a.status)
                      }
                    >
                      {isActive ? "Suspendre" : "Réactiver"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

/* ── Onglet Parrainages ── */

/**
 * The filter list, derived from the badge vocabulary rather than retyped.
 *
 * These were two hand-written copies of the same seven states, and #384 added
 * an eighth to neither: a commission whose transfer was in flight showed as a
 * grey `paying` badge and could not be filtered for (#411). Derived, a status
 * is added in one place — `REFERRAL_STATUS` — and appears in both.
 */
const REFERRAL_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tous les statuts" },
  ...Object.entries(REFERRAL_STATUS).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
];

type ReferralStatus =
  | "pending"
  | "validated"
  | "payable"
  | "paying"
  | "paid"
  | "cancelled"
  | "blocked";

function AdminInvoiceLink({ referralId }: { referralId: Id<"referrals"> }) {
  const url = useQuery(api.referrals.getReferralInvoiceUrl, { referralId });
  if (!url) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-medium text-primary-ink underline underline-offset-2 hover:opacity-80"
    >
      Voir
    </a>
  );
}

function ReferralsTab() {
  const [status, setStatus] = React.useState("");
  const referrals = useQuery(
    api.admin.listReferrals,
    status ? { status: status as ReferralStatus } : {},
  );
  const block = useMutation(api.admin.blockReferralPayout);
  const unblock = useMutation(api.admin.unblockReferralPayout);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onBlock(id: Id<"referrals">) {
    setPendingId(id);
    try {
      await block({ referralId: id });
      toast.success("Versement bloqué");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPendingId(null);
    }
  }

  async function onUnblock(id: Id<"referrals">) {
    setPendingId(id);
    try {
      await unblock({ referralId: id });
      toast.success("Versement débloqué");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="w-full max-w-[16rem]">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrer par statut"
          >
            {REFERRAL_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        {referrals !== undefined && (
          <span className="hidden text-sm text-muted-foreground tnum sm:inline">
            {formatNumber(referrals.length)} parrainage
            {referrals.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {referrals === undefined ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : referrals.length === 0 ? (
        <EmptyState
          className="m-4"
          icon={<Share2 />}
          title="Aucun parrainage"
          description={
            status
              ? "Aucun parrainage avec ce statut."
              : "Les parrainages générés apparaîtront ici."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Apporteur</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Réduction</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Facture</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {referrals.map((r) => {
              const canBlock =
                r.status === "validated" || r.status === "payable";
              const isBlocked = r.status === "blocked";
              return (
                <TableRow key={r._id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {r.customerEmail}
                      </p>
                      {r.customerName && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.customerName}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-foreground">
                        {r.affiliateName ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.affiliateEmail ?? "—"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tnum">
                    {formatCentsRounded(r.commissionCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted-foreground tnum">
                    {`${r.discountPercent}% (${formatCentsRounded(r.discountAmountCents)})`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={REFERRAL_STATUS} value={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tnum">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <AdminInvoiceLink referralId={r._id as Id<"referrals">} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canBlock ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === r._id}
                        onClick={() => onBlock(r._id as Id<"referrals">)}
                      >
                        <Ban className="size-3.5" />
                        Bloquer
                      </Button>
                    ) : isBlocked ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={pendingId === r._id}
                        onClick={() => onUnblock(r._id as Id<"referrals">)}
                      >
                        <RotateCcw className="size-3.5" />
                        Débloquer
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

/* ── Settings tab ── */

function SettingsTab() {
  const settings = useQuery(api.affiliateSettings.get, {});
  const save = useMutation(api.admin.updateSettings);

  const [commissionCents, setCommissionCents] = React.useState("");
  const [discountPercent, setDiscountPercent] = React.useState("");
  const [delayDays, setDelayDays] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings && !initialized) {
      setCommissionCents(String(settings.defaultCommissionCents));
      setDiscountPercent(String(settings.defaultDiscountPercent));
      setDelayDays(String(settings.validationDelayDays));
      setEnabled(settings.programEnabled);
      setInitialized(true);
    }
  }, [settings, initialized]);

  async function onSave() {
    const commission = Number(commissionCents);
    const discount = Number(discountPercent);
    const delay = Number(delayDays);
    if (
      !Number.isFinite(commission) ||
      !Number.isFinite(discount) ||
      !Number.isFinite(delay)
    ) {
      toast.error("Valeurs numériques invalides");
      return;
    }
    setSaving(true);
    try {
      await save({
        defaultCommissionCents: Math.round(commission),
        defaultDiscountPercent: Math.round(discount),
        validationDelayDays: Math.round(delay),
        programEnabled: enabled,
      });
      toast.success("Paramètres enregistrés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (settings === undefined) {
    return (
      <Card className="p-6">
        <div className="max-w-md space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
          <Skeleton className="h-9 w-40" />
        </div>
      </Card>
    );
  }

  const commissionEuros = Number(commissionCents);

  return (
    <Card className="p-6">
      <div className="max-w-md space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="commission">Commission par défaut (centimes)</Label>
          <Input
            id="commission"
            type="number"
            min={0}
            step={100}
            value={commissionCents}
            onChange={(e) => setCommissionCents(e.target.value)}
            className="tnum"
          />
          <p className="text-xs text-muted-foreground tnum">
            {Number.isFinite(commissionEuros)
              ? `≈ ${formatCentsRounded(commissionEuros)} par parrainage validé`
              : "Montant en centimes"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount">Réduction filleul (%)</Label>
          <Input
            id="discount"
            type="number"
            min={0}
            max={100}
            step={1}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="tnum"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="delay">Délai de validation (jours)</Label>
          <Input
            id="delay"
            type="number"
            min={0}
            step={1}
            value={delayDays}
            onChange={(e) => setDelayDays(e.target.value)}
            className="tnum"
          />
          <p className="text-xs text-muted-foreground">
            Avant qu’une commission ne devienne payable.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-1 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Programme actif
            </p>
            <p className="text-xs text-muted-foreground">
              Active la génération de codes de parrainage.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Programme actif"
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-primary" : "bg-surface-3"
            }`}
          >
            <span
              className={`inline-block size-4 rounded-full bg-background transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={onSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          {!enabled && (
            <span className="text-xs text-warning">Programme désactivé</span>
          )}
        </div>
      </div>
    </Card>
  );
}
