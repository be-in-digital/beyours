"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/components/admin/ui/toast";
import {
  ArrowLeft,
  ChevronDown,
  Server,
  Activity,
  GitBranch,
  Store,
  Euro,
  TriangleAlert,
  Plug,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { SectionTitle } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { AreaChart } from "@/components/admin/charts";
import { EmptyState } from "@/components/admin/empty-state";
import {
  DEPLOYMENT_STATUS,
  HEALTH,
  SEVERITY,
  INCIDENT_STATUS,
  MAINTENANCE_STATUS,
  INTEGRATION_STATUS,
  INTEGRATION_LABEL,
  StatusBadge,
} from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/admin/ui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import {
  formatCentsCompact,
  formatCentsRounded,
  formatDate,
  formatDayMonth,
  formatNumber,
  formatRelative,
} from "@/lib/format";

type DeploymentStatus =
  | "provisioning"
  | "staging"
  | "live"
  | "degraded"
  | "suspended"
  | "offboarded";

const STATUS_ACTIONS: DeploymentStatus[] = [
  "live",
  "degraded",
  "suspended",
  "provisioning",
  "offboarded",
];

const PLAN_LABEL: Record<string, string> = {
  essentielle: "Essentielle",
  premium: "Premium",
};

const STORE_STATUS: Record<string, { label: string; variant: "success" | "muted" | "warning" | "danger" }> = {
  open: { label: "Ouvert", variant: "success" },
  closed: { label: "Fermé", variant: "muted" },
  draft: { label: "Brouillon", variant: "muted" },
  temporarily_unavailable: { label: "Indisponible", variant: "warning" },
};

const CHECK_STATUS: Record<string, "success" | "danger" | "warning"> = {
  up: "success",
  down: "danger",
  degraded: "warning",
};
const CHECK_LABEL: Record<string, string> = {
  up: "OK",
  down: "Down",
  degraded: "Dégradé",
};

const CHECK_KIND_LABEL: Record<string, string> = {
  http: "HTTP",
  convex: "Convex",
  integration: "Intégration",
  webhook: "Webhook",
};

export default function DeploymentDetailPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const id = deploymentId as Id<"saDeployments">;

  const deployment = useQuery(api.saFleet.get, { deploymentId: id });
  const sales = useQuery(api.saSales.forDeployment, {
    deploymentId: id,
    days: 30,
  });
  const updateStatus = useMutation(api.saFleet.updateStatus);

  const [pending, setPending] = React.useState(false);

  if (deployment === undefined) return <DetailSkeleton />;

  if (deployment === null) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={<Server />}
          title="Déploiement introuvable"
          description="Ce déploiement n'existe pas ou a été supprimé."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/flotte">Retour aux déploiements</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const outdated =
    deployment.version &&
    deployment.latestVersion &&
    deployment.version !== deployment.latestVersion;

  async function onChangeStatus(status: DeploymentStatus) {
    if (status === deployment!.status || pending) return;
    setPending(true);
    try {
      await updateStatus({ deploymentId: id, status });
      toast.success(`Statut mis à jour : ${DEPLOYMENT_STATUS[status]!.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  const salesSeries =
    sales?.series.map((p) => ({
      label: formatDayMonth(p.dayTs),
      value: p.grossCents,
    })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <BackLink />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {deployment.restaurantName}
              </h1>
              <StatusBadge map={DEPLOYMENT_STATUS} value={deployment.status} />
              <StatusBadge map={HEALTH} value={deployment.health} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a
                href={`https://${deployment.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {deployment.domain}
              </a>
              <span className="text-border">·</span>
              <span className="text-muted-foreground">
                {deployment.customerEmail}
              </span>
            </div>
          </div>

          <Dropdown
            trigger={
              <Button variant="outline" size="sm" disabled={pending}>
                Changer le statut
                <ChevronDown className="size-4" />
              </Button>
            }
          >
            <DropdownLabel>Nouveau statut</DropdownLabel>
            <DropdownSeparator />
            {STATUS_ACTIONS.map((s) => {
              const current = s === deployment.status;
              return (
                <DropdownItem
                  key={s}
                  disabled={current || pending}
                  onClick={() => onChangeStatus(s)}
                  destructive={s === "offboarded"}
                >
                  <span className="flex-1">{DEPLOYMENT_STATUS[s]!.label}</span>
                  {current && (
                    <span className="text-[10px] text-muted-foreground">
                      actuel
                    </span>
                  )}
                </DropdownItem>
              );
            })}
          </Dropdown>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Uptime 30j"
          value={`${deployment.uptime30d.toFixed(2)} %`}
          icon={<Activity />}
        />
        <KpiCard
          label="Version"
          value={
            <span className="font-mono text-xl">{deployment.version ?? "—"}</span>
          }
          hint={
            deployment.latestVersion
              ? outdated
                ? `dernière ${deployment.latestVersion}`
                : "à jour"
              : undefined
          }
          icon={<GitBranch />}
          accent={outdated ? "var(--warning)" : undefined}
        />
        <KpiCard
          label="Boutiques"
          value={formatNumber(deployment.storeCount)}
          hint={`${deployment.stores.length} référencées`}
          icon={<Store />}
        />
        <KpiCard
          label="CA 30j"
          value={formatCentsCompact(deployment.sales30.grossCents)}
          hint={`${formatNumber(deployment.sales30.orderCount)} commandes`}
          icon={<Euro />}
        />
        <KpiCard
          label="Incidents ouverts"
          value={formatNumber(deployment.openIncidentCount)}
          hint={deployment.openIncidentCount > 0 ? "en cours" : "aucun"}
          icon={<TriangleAlert />}
          accent={
            deployment.openIncidentCount > 0 ? "var(--danger)" : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne gauche */}
        <div className="space-y-4 lg:col-span-2">
          {/* Ventes */}
          <Card>
            <div className="flex items-start justify-between gap-4 p-5 pb-2">
              <div>
                <SectionTitle className="mb-0">
                  Ventes du restaurant — 30 j
                </SectionTitle>
                <p className="mt-1 font-display text-2xl font-semibold tracking-tight tnum">
                  {sales
                    ? formatCentsRounded(sales.totals.grossCents)
                    : formatCentsRounded(deployment.sales30.grossCents)}
                </p>
              </div>
              {sales && (
                <div className="text-right text-xs text-muted-foreground">
                  <div className="tnum">
                    {formatNumber(sales.totals.orderCount)} commandes
                  </div>
                  <div className="tnum">
                    Panier moyen {formatCentsRounded(sales.totals.avgOrderValueCents)}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 pb-4">
              {sales === undefined ? (
                <Skeleton className="h-[240px] w-full" />
              ) : salesSeries.every((p) => p.value === 0) ? (
                <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">
                  Aucune vente enregistrée sur la période.
                </div>
              ) : (
                <AreaChart
                  data={salesSeries}
                  valueFormatter={(v) => formatCentsCompact(v)}
                />
              )}
            </div>
          </Card>

          {/* Monitoring */}
          <Card className="p-5">
            <SectionTitle>Monitoring</SectionTitle>
            {deployment.recentChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun contrôle enregistré pour ce déploiement.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Latence</TableHead>
                    <TableHead className="text-right">Code</TableHead>
                    <TableHead className="text-right">Vérifié</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployment.recentChecks.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="text-muted-foreground">
                        {CHECK_KIND_LABEL[c.kind] ?? c.kind}
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {c.target}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={CHECK_STATUS[c.status] ?? "muted"}>
                          {CHECK_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tnum text-muted-foreground">
                        {typeof c.latencyMs === "number"
                          ? `${formatNumber(c.latencyMs)} ms`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tnum text-muted-foreground">
                        {c.statusCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(c.checkedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Incidents */}
          <Card className="p-5">
            <SectionTitle>Incidents</SectionTitle>
            {deployment.incidents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Aucun incident lié à ce déploiement.
              </div>
            ) : (
              <ul className="space-y-2">
                {deployment.incidents.map((i) => (
                  <li key={i._id}>
                    <Link
                      href={`/admin/incidents/${i._id}`}
                      className="block rounded-md border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {i.number}
                          </span>
                          <StatusBadge map={SEVERITY} value={i.severity} />
                        </div>
                        <StatusBadge map={INCIDENT_STATUS} value={i.status} />
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-foreground">
                        {i.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(i.startedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Infrastructure */}
          <Card className="p-5">
            <SectionTitle>Infrastructure</SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <DefRow label="Environnement">
                <span className="text-foreground">{deployment.environment}</span>
              </DefRow>
              <DefRow label="Région">
                <span className="text-foreground">{deployment.region}</span>
              </DefRow>
              <DefRow label="Plan">
                <Badge
                  variant={deployment.plan === "premium" ? "primary" : "muted"}
                >
                  {PLAN_LABEL[deployment.plan] ?? deployment.plan}
                </Badge>
              </DefRow>
              <div className="flex flex-col gap-1 border-t border-border pt-2.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  URL Convex
                </dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {deployment.convexUrl ?? "—"}
                </dd>
              </div>
              <DefRow label="Provisionné" className="border-t border-border pt-2.5">
                <span className="text-foreground tnum">
                  {formatDate(deployment.provisionedAt)}
                </span>
              </DefRow>
              <DefRow label="Mise en ligne">
                <span className="text-foreground tnum">
                  {formatDate(deployment.goLiveAt)}
                </span>
              </DefRow>
              <DefRow label="Dernier déploiement">
                <span className="text-foreground tnum">
                  {deployment.lastDeployAt
                    ? formatRelative(deployment.lastDeployAt)
                    : "—"}
                </span>
              </DefRow>
              <DefRow label="Dernier contrôle">
                <span className="text-foreground tnum">
                  {deployment.lastCheckAt
                    ? formatRelative(deployment.lastCheckAt)
                    : "—"}
                </span>
              </DefRow>
            </dl>
          </Card>

          {/* Intégrations */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Plug className="size-3.5" /> Intégrations
              </span>
            </SectionTitle>
            {deployment.integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune intégration configurée.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {deployment.integrations.map((it) => (
                  <li
                    key={it.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {INTEGRATION_LABEL[it.key] ?? it.key}
                      </span>
                      {it.detail && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {it.detail}
                        </span>
                      )}
                    </div>
                    <StatusBadge map={INTEGRATION_STATUS} value={it.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Boutiques */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Store className="size-3.5" /> Boutiques
              </span>
            </SectionTitle>
            {deployment.stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boutique référencée.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {deployment.stores.map((s) => {
                  const meta = STORE_STATUS[s.status] ?? {
                    label: s.status,
                    variant: "muted" as const,
                  };
                  return (
                    <li
                      key={s._id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.name}
                        </span>
                        {s.city && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.city}
                          </span>
                        )}
                      </div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Maintenance */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-3.5" /> Maintenance
              </span>
            </SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <DefRow label="Contrat">
                <StatusBadge
                  map={MAINTENANCE_STATUS}
                  value={deployment.maintenance.status}
                />
              </DefRow>
              <DefRow label="Couverte jusqu'au">
                <span className="text-foreground tnum">
                  {formatDate(deployment.maintenance.coveredUntil)}
                </span>
              </DefRow>
              <DefRow label="Renouvellement">
                {deployment.maintenance.autoRenew ? (
                  <Badge variant="success">Auto</Badge>
                ) : (
                  <Badge variant="muted">Manuel</Badge>
                )}
              </DefRow>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/flotte"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Déploiements
    </Link>
  );
}

function DefRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}
