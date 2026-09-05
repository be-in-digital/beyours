"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Server, Signal, Activity, TriangleAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
import {
  DEPLOYMENT_STATUS,
  HEALTH,
  HealthDot,
  StatusBadge,
} from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Select } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { formatNumber, formatPercentPoints } from "@/lib/format";

type StatusFilter =
  | "provisioning"
  | "staging"
  | "live"
  | "degraded"
  | "suspended"
  | "offboarded";
type HealthFilter = "healthy" | "degraded" | "down" | "unknown";

const PLAN_LABEL: Record<string, string> = {
  essentielle: "Essentielle",
  premium: "Premium",
};

export default function FleetPage() {
  const [status, setStatus] = React.useState<StatusFilter | "">("");
  const [health, setHealth] = React.useState<HealthFilter | "">("");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const stats = useQuery(api.saFleet.stats, {});
  const deployments = useQuery(api.saFleet.list, {
    ...(status ? { status } : {}),
    ...(health ? { health } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const hasFilters = status !== "" || health !== "" || debouncedSearch !== "";
  const infraIncidents = stats ? stats.down + stats.degraded : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flotte"
        description="Registre des déploiements clients — statut, santé et fiabilité de chaque restaurant en production."
      >
        <Badge variant="muted">
          {stats ? `${formatNumber(stats.total)} déploiements` : "…"}
        </Badge>
      </PageHeader>

      {/* KPIs */}
      {stats === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Déploiements"
            value={formatNumber(stats.total)}
            hint={`${stats.provisioning} en provisioning`}
            icon={<Server />}
          />
          <KpiCard
            label="En ligne"
            value={formatNumber(stats.live)}
            hint={`${stats.total} au total`}
            icon={<Signal />}
          >
            <div className="flex flex-col items-end gap-1 text-xs">
              <HealthChip health="healthy" n={stats.byHealth.healthy ?? 0} />
              <HealthChip health="degraded" n={stats.byHealth.degraded ?? 0} />
              <HealthChip health="down" n={stats.byHealth.down ?? 0} />
            </div>
          </KpiCard>
          {/* Null while nothing has been probed — see convex/saMonitoring.ts. */}
          <KpiCard
            label="Uptime moyen"
            value={
              stats.avgUptime === null
                ? "—"
                : formatPercentPoints(stats.avgUptime)
            }
            hint={
              stats.avgUptime === null
                ? "aucun déploiement sondé"
                : `${formatNumber(stats.monitored)} restaurant${stats.monitored > 1 ? "s" : ""} sondé${stats.monitored > 1 ? "s" : ""}`
            }
            icon={<Activity />}
          />
          <KpiCard
            label="Incidents infra"
            value={
              infraIncidents > 0
                ? `${formatNumber(infraIncidents)} à surveiller`
                : "Aucun"
            }
            hint={`${stats.down} down · ${stats.degraded} dégradés`}
            icon={<TriangleAlert />}
            accent={
              stats.down > 0
                ? "var(--danger)"
                : stats.degraded > 0
                  ? "var(--warning)"
                  : undefined
            }
          />
        </div>
      )}

      {/* Filtres + table */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Restaurant, domaine…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-40">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter | "")}
                aria-label="Filtrer par statut"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(DEPLOYMENT_STATUS).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Select
                value={health}
                onChange={(e) => setHealth(e.target.value as HealthFilter | "")}
                aria-label="Filtrer par santé"
              >
                <option value="">Toute santé</option>
                {Object.entries(HEALTH).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {deployments === undefined ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : deployments.length === 0 ? (
          <div className="p-4">
            {hasFilters ? (
              <EmptyState
                icon={<Search />}
                title="Aucun déploiement ne correspond"
                description="Aucun résultat pour ces filtres. Élargissez la recherche ou réinitialisez les critères."
              />
            ) : (
              <EmptyState
                icon={<Server />}
                title="Aucun déploiement"
                description="Aucun restaurant n'est encore provisionné. Les déploiements apparaîtront ici une fois créés."
              />
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Santé</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Uptime</TableHead>
                <TableHead className="text-right">Intég.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((d) => {
                const outdated =
                  d.version &&
                  d.latestVersion &&
                  d.version !== d.latestVersion;
                return (
                  <TableRow key={d._id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/admin/flotte/${d._id}`}
                        className="flex items-center gap-2.5"
                      >
                        <HealthDot health={d.health} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {d.restaurantName}
                          </span>
                          {d.city && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {d.city}
                            </span>
                          )}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/flotte/${d._id}`}
                        className="block font-mono text-xs text-muted-foreground"
                      >
                        {d.domain}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/flotte/${d._id}`} className="block">
                        <StatusBadge map={DEPLOYMENT_STATUS} value={d.status} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/flotte/${d._id}`} className="block">
                        <StatusBadge map={HEALTH} value={d.health} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/flotte/${d._id}`} className="block">
                        <Badge variant={d.plan === "premium" ? "primary" : "muted"}>
                          {PLAN_LABEL[d.plan] ?? d.plan}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/flotte/${d._id}`}
                        className="flex items-center gap-1.5"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.version ?? "—"}
                        </span>
                        {outdated && (
                          <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                            MAJ dispo
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/flotte/${d._id}`}
                        className="block tabular-nums text-foreground tnum"
                      >
                        {d.lastCheckAt === undefined
                          ? "—"
                          : `${d.uptime30d.toFixed(2)} %`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/flotte/${d._id}`}
                        className="inline-flex justify-end"
                      >
                        {d.integrationErrors > 0 ? (
                          <Badge variant="danger">
                            {formatNumber(d.integrationErrors)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
