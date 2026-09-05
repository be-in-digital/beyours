"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  HeartPulse,
  ShieldAlert,
  ShieldOff,
  Gauge,
  ServerCog,
  Radio,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
import { HealthDot } from "@/components/admin/status";
import { INTEGRATION_LABEL } from "@/components/admin/status";
import { ProbeNowButton } from "@/components/admin/probe-now-button";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import {
  formatNumber,
  formatPercentPoints,
  formatRelative,
} from "@/lib/format";

/* ── Status of a check (up | degraded | down) → consistent colour ── */
const CHECK_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "muted" }
> = {
  up: { label: "En ligne", variant: "success" },
  degraded: { label: "Dégradé", variant: "warning" },
  down: { label: "Hors-ligne", variant: "danger" },
};

const CHECK_KIND_LABEL: Record<string, string> = {
  http: "HTTP",
  convex: "Convex",
  integration: "Intégration",
  webhook: "Webhook",
};

function CheckStatusBadge({ status }: { status: string }) {
  const meta = CHECK_STATUS[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export default function MonitoringPage() {
  const data = useQuery(api.saMonitoring.overview, {});
  const recent = useQuery(api.saMonitoring.recentChecks, { limit: 30 });

  if (data === undefined) return <MonitoringSkeleton />;

  const { deployments, rollup } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Santé en temps réel de chaque système restaurant déployé — disponibilité, latence et intégrations."
      >
        <Badge variant="muted">
          <Activity className="size-3.5" /> {formatNumber(rollup.total)} déploiement
          {rollup.total > 1 ? "s" : ""}
        </Badge>
        <ProbeNowButton />
      </PageHeader>

      {/* Health rollup */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Sains"
          value={formatNumber(rollup.byHealth.healthy)}
          icon={<HeartPulse />}
          accent="var(--success)"
        />
        <KpiCard
          label="Dégradés"
          value={formatNumber(rollup.byHealth.degraded)}
          icon={<ShieldAlert />}
          accent="var(--warning)"
          hint={
            rollup.integrationErrors > 0
              ? `${formatNumber(rollup.integrationErrors)} erreur${rollup.integrationErrors > 1 ? "s" : ""} d'intégration`
              : "aucune erreur d'intégration"
          }
        />
        <KpiCard
          label="Hors-ligne"
          value={formatNumber(rollup.byHealth.down)}
          icon={<ShieldOff />}
          accent={rollup.byHealth.down > 0 ? "var(--danger)" : undefined}
        />
        {/* Null until a probe has run: an average over nothing is not 100 %. */}
        <KpiCard
          label="Uptime moyen"
          value={
            rollup.avgUptime === null ? "—" : formatPercentPoints(rollup.avgUptime)
          }
          icon={<Gauge />}
          hint={
            rollup.avgUptime === null
              ? "aucun déploiement sondé"
              : `sur 30 jours · ${formatNumber(rollup.monitored)} sondé${rollup.monitored > 1 ? "s" : ""}`
          }
        />
      </div>

      {/* Deployment status */}
      <Card>
        <div className="flex items-center justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2">
            <ServerCog className="size-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              État des déploiements
            </h2>
          </div>
          {rollup.integrationErrors > 0 && (
            <Badge variant="danger">
              {formatNumber(rollup.integrationErrors)} intégration
              {rollup.integrationErrors > 1 ? "s" : ""} en erreur
            </Badge>
          )}
        </div>

        {deployments.length === 0 ? (
          <div className="p-5 pt-0">
            <EmptyState
              icon={<ServerCog />}
              title="Aucun déploiement surveillé"
              description="Les systèmes restaurant apparaîtront ici dès leur mise en production."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Restaurant</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Dernier contrôle</TableHead>
                <TableHead className="text-right">Uptime</TableHead>
                <TableHead>Intégrations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((d) => {
                const errorKeys = d.integrationErrors.map(
                  (i) => INTEGRATION_LABEL[i.key] ?? i.key,
                );
                return (
                  <TableRow key={d._id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <HealthDot health={d.health} />
                        <span className="font-medium text-foreground">
                          {d.restaurantName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {d.domain}
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.latestCheck ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <CheckStatusBadge status={d.latestCheck.status} />
                          {typeof d.latestCheck.latencyMs === "number" && (
                            <span className="tnum text-xs text-muted-foreground">
                              {formatNumber(d.latestCheck.latencyMs)} ms
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(d.latestCheck.checkedAt)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* No probe yet, no figure — `uptime30d` is a
                          placeholder until the first check lands. */}
                      {d.lastCheckAt === null ? (
                        <span
                          className="text-muted-foreground"
                          title="Jamais sondé"
                        >
                          —
                        </span>
                      ) : (
                        <span className="tnum font-medium text-foreground">
                          {formatPercentPoints(d.uptime30d)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.integrationErrors.length > 0 ? (
                        <Badge variant="danger" title={errorKeys.join(", ")}>
                          {d.integrationErrors.length} erreur
                          {d.integrationErrors.length > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Feed of recent checks */}
      <Card>
        <div className="flex items-center gap-2 p-5 pb-3">
          <Radio className="size-4 text-muted-foreground" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Flux de contrôles récents
          </h2>
        </div>

        {recent === undefined ? (
          <div className="space-y-2 p-5 pt-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="p-5 pt-0">
            <EmptyState
              icon={<Radio />}
              title="Aucun contrôle enregistré"
              description="La sonde passe toutes les 10 minutes sur les déploiements en ligne. « Sonder maintenant » déclenche un passage immédiat."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Déploiement</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Latence</TableHead>
                <TableHead className="text-right">Code</TableHead>
                <TableHead className="text-right">Quand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((c) => {
                const tint =
                  c.status === "down"
                    ? "bg-danger-soft/40 hover:bg-danger-soft/50"
                    : c.status === "degraded"
                      ? "bg-warning-soft/40 hover:bg-warning-soft/50"
                      : undefined;
                return (
                  <TableRow key={c._id} className={tint}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {c.deploymentName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {CHECK_KIND_LABEL[c.kind] ?? c.kind}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="block max-w-[16rem] truncate font-mono text-xs text-muted-foreground"
                        title={c.target}
                      >
                        {c.target}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CheckStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof c.latencyMs === "number" ? (
                        <span className="tnum text-muted-foreground">
                          {formatNumber(c.latencyMs)} ms
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof c.statusCode === "number" ? (
                        <span
                          className={
                            c.status === "up"
                              ? "tnum text-muted-foreground"
                              : "tnum font-medium text-danger"
                          }
                        >
                          {c.statusCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(c.checkedAt)}
                      </span>
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

function MonitoringSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-80" />
    </div>
  );
}
