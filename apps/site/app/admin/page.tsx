"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Euro,
  Users,
  RefreshCw,
  TrendingUp,
  Server,
  TriangleAlert,
  ArrowRight,
  BadgeCheck,
  Activity,
  UserPlus,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { AreaChart } from "@/components/admin/charts";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import { HealthDot, SEVERITY, StatusBadge } from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Button } from "@/components/admin/ui/button";
import {
  formatCentsCompact,
  formatCentsRounded,
  formatNumber,
  formatPercentPoints,
  formatRelative,
  formatDayMonth,
} from "@/lib/format";

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  commerce: <ShoppingBag className="size-3.5" />,
  deployment: <Server className="size-3.5" />,
  incident: <TriangleAlert className="size-3.5" />,
  client: <UserPlus className="size-3.5" />,
  system: <Wrench className="size-3.5" />,
};

export default function AdminOverviewPage() {
  const data = useQuery(api.saDashboard.overview, {});
  if (data === undefined) return <OverviewSkeleton />;

  const { commerce, gmv, fleet, incidents, renewals, activity } = data;
  const revenueSeries = commerce.revenueSeries.map((p) => ({
    label: formatDayMonth(p.dayTs),
    value: p.revenueCents,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue d'ensemble"
        description="Activité commerciale, flotte de restaurants et fiabilité — 30 derniers jours."
      >
        <Badge variant="muted">30 derniers jours</Badge>
      </PageHeader>

      {incidents.sev1Open > 0 && (
        <Link href="/admin/incidents?status=open" className="block">
          <div className="flex items-center gap-3 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 transition-colors hover:bg-danger-soft/70">
            <span className="grid size-8 place-items-center rounded-md bg-danger/15 text-danger">
              <TriangleAlert className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {incidents.sev1Open} incident{incidents.sev1Open > 1 ? "s" : ""} critique
                {incidents.sev1Open > 1 ? "s" : ""} (SEV1) en cours
              </p>
              <p className="text-xs text-muted-foreground">
                Intervention prioritaire requise.
              </p>
            </div>
            <ArrowRight className="size-4 text-danger" />
          </div>
        </Link>
      )}

      {/* Commerce */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Revenus (30j)"
          value={formatCentsCompact(commerce.revenue30Cents)}
          delta={commerce.deltaRevenueRatio}
          hint="vs 30j préc."
          icon={<Euro />}
        />
        <KpiCard
          label="MRR"
          value={formatCentsRounded(commerce.mrrCents)}
          hint={`ARR ${formatCentsCompact(commerce.arrCents)}`}
          icon={<RefreshCw />}
        />
        <KpiCard
          label="Clients"
          value={formatNumber(commerce.totalClients)}
          hint={`${commerce.prospects} prospects`}
          icon={<Users />}
        />
        <KpiCard
          label="Abonnements actifs"
          value={formatNumber(commerce.activeSubscriptions)}
          hint={`${formatCentsRounded(commerce.paidThisMonthCents)} encaissés ce mois`}
          icon={<BadgeCheck />}
        />
      </div>

      {/* Exploitation */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="GMV flotte (30j)"
          value={formatCentsCompact(gmv.grossCents)}
          delta={gmv.deltaGrossRatio}
          hint={`${gmv.activeDeployments} restaurants actifs`}
          icon={<TrendingUp />}
        />
        <KpiCard
          label="Déploiements en ligne"
          value={formatNumber(fleet.live)}
          hint={`${fleet.total} au total`}
          icon={<Server />}
        >
          <div className="flex flex-col items-end gap-1 text-xs">
            <HealthChip health="healthy" n={fleet.byHealth.healthy} />
            <HealthChip health="degraded" n={fleet.byHealth.degraded} />
            <HealthChip health="down" n={fleet.byHealth.down} />
          </div>
        </KpiCard>
        <KpiCard
          label="Incidents ouverts"
          value={formatNumber(incidents.open)}
          hint={`${incidents.openBySeverity.sev1} SEV1 · ${incidents.openBySeverity.sev2} SEV2`}
          icon={<TriangleAlert />}
          accent={incidents.open > 0 ? "var(--danger)" : undefined}
        />
        <KpiCard
          label="Renouvellements 30j"
          value={formatNumber(renewals.due30Count)}
          deltaLabel={formatCentsRounded(renewals.due30Cents)}
          hint={renewals.pastDueSubs > 0 ? `${renewals.pastDueSubs} en retard` : "à échéance"}
          icon={<RefreshCw />}
          accent={renewals.pastDueSubs > 0 ? "var(--warning)" : undefined}
        />
      </div>

      {/* Graphes + santé/incidents */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-4 p-5 pb-2">
            <div>
              <SectionTitle className="mb-0">Chiffre d’affaires commercial</SectionTitle>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight tnum">
                {formatCentsRounded(commerce.revenue30Cents)}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/ventes">
                Détail <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="px-4 pb-4">
            <AreaChart data={revenueSeries} valueFormatter={(v) => formatCentsCompact(v)} />
          </div>
          <div className="border-t border-border p-5">
            <SectionTitle>GMV flotte — par canal</SectionTitle>
            <SourceBreakdown bySource={gmv.bySource} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Santé de la flotte</SectionTitle>
            <div className="space-y-2.5">
              <HealthRow health="healthy" label="Sains" n={fleet.byHealth.healthy} />
              <HealthRow health="degraded" label="Dégradés" n={fleet.byHealth.degraded} />
              <HealthRow health="down" label="Hors-ligne" n={fleet.byHealth.down} />
              <HealthRow health="unknown" label="Inconnus" n={fleet.byHealth.unknown} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Uptime moyen</span>
              <span className="font-display font-semibold tnum">
                {formatPercentPoints(fleet.avgUptime)}
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              action={
                <Link href="/admin/incidents" className="text-xs font-medium text-primary hover:underline">
                  Tous
                </Link>
              }
            >
              Incidents ouverts
            </SectionTitle>
            {incidents.recent.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success">
                <BadgeCheck className="size-4" />
                Aucun incident en cours.
              </div>
            ) : (
              <ul className="space-y-2">
                {incidents.recent.map((i) => (
                  <li key={i._id}>
                    <Link
                      href={`/admin/incidents/${i._id}`}
                      className="block rounded-md border border-border bg-surface-1 p-2.5 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge map={SEVERITY} value={i.severity} />
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelative(i.startedAt)}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-foreground">
                        {i.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.restaurantName ?? "Plateforme"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Activité */}
      <Card className="p-5">
        <SectionTitle>Activité récente</SectionTitle>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité pour l’instant.</p>
        ) : (
          <ul className="space-y-1">
            {activity.map((a) => (
              <li key={a._id} className="flex items-start gap-3 rounded-md px-1 py-2">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                  {ACTIVITY_ICON[a.kind] ?? <Activity className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{a.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actorName ?? "Système"} · {formatRelative(a.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HealthChip({ health, n }: { health: string; n: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <HealthDot health={health} /> {n}
    </span>
  );
}

function HealthRow({ health, label, n }: { health: string; label: string; n: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <HealthDot health={health} />
        {label}
      </span>
      <span className="font-display text-sm font-semibold text-foreground tnum">{n}</span>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
