"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  TriangleAlert,
  Flame,
  BadgeCheck,
  Timer,
  Plus,
  ShieldCheck,
  SearchX,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
import { INCIDENT_STATUS, SEVERITY, StatusBadge } from "@/components/admin/status";
import { Card } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
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
import { formatNumber, formatRelative } from "@/lib/format";

function formatDuration(ms: number) {
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.round(ms / 60000)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} j`;
}

const STATUS_VALUES = [
  "open",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
type IncidentStatus = (typeof STATUS_VALUES)[number];

const SEVERITY_VALUES = ["sev1", "sev2", "sev3", "sev4"] as const;
type Severity = (typeof SEVERITY_VALUES)[number];

function isStatus(v: string | null): v is IncidentStatus {
  return v !== null && (STATUS_VALUES as readonly string[]).includes(v);
}

export default function IncidentsListPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");

  const [status, setStatus] = React.useState<IncidentStatus | "">(
    isStatus(initialStatus) ? initialStatus : "",
  );
  const [severity, setSeverity] = React.useState<Severity | "">("");

  const stats = useQuery(api.saIncidents.stats, {});
  const incidents = useQuery(api.saIncidents.list, {
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Suivi des incidents d'exploitation — flotte de restaurants et plateforme."
      >
        <Button asChild size="sm">
          <Link href="/admin/incidents/nouveau">
            <Plus className="size-4" /> Nouvel incident
          </Link>
        </Button>
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
            label="Ouverts"
            value={formatNumber(stats.openCount)}
            hint="non résolus"
            icon={<TriangleAlert />}
            accent={stats.openCount > 0 ? "var(--danger)" : undefined}
          />
          <KpiCard
            label="SEV1 en cours"
            value={formatNumber(stats.sev1Open)}
            hint="critiques"
            icon={<Flame />}
            accent={stats.sev1Open > 0 ? "var(--danger)" : undefined}
          />
          <KpiCard
            label="Résolus ce mois"
            value={formatNumber(stats.resolvedThisMonth)}
            hint="ce mois-ci"
            icon={<BadgeCheck />}
          />
          <KpiCard
            label="MTTR"
            value={stats.mttrMs > 0 ? formatDuration(stats.mttrMs) : "—"}
            hint="délai moyen de résolution"
            icon={<Timer />}
          />
        </div>
      )}

      {/* Filtres */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-1.5 sm:max-w-[220px]">
            <span className="text-xs font-medium text-muted-foreground">Statut</span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}
            >
              <option value="">Tous les statuts</option>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {INCIDENT_STATUS[s]!.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5 sm:max-w-[220px]">
            <span className="text-xs font-medium text-muted-foreground">Gravité</span>
            <Select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity | "")}
            >
              <option value="">Toutes gravités</option>
              {SEVERITY_VALUES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY[s]!.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Tableau */}
      <Card>
        {incidents === undefined ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-4">
            {status || severity ? (
              <EmptyState
                icon={<SearchX />}
                title="Aucun incident ne correspond"
                description="Aucun incident ne correspond aux filtres sélectionnés. Ajuste les critères."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatus("");
                      setSeverity("");
                    }}
                  >
                    Réinitialiser les filtres
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ShieldCheck />}
                title="Aucun incident"
                description="Tout est stable. Aucun incident n'a encore été déclaré."
                action={
                  <Button asChild size="sm">
                    <Link href="/admin/incidents/nouveau">
                      <Plus className="size-4" /> Nouvel incident
                    </Link>
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Gravité</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Assigné</TableHead>
                <TableHead className="text-right">Ouvert</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((i) => (
                <TableRow key={i._id} className="relative cursor-pointer">
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    <Link
                      href={`/admin/incidents/${i._id}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {i.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={SEVERITY} value={i.severity} />
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <span className="block truncate font-medium text-foreground">
                      {i.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={INCIDENT_STATUS} value={i.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {i.restaurantName ?? "Plateforme"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {i.assigneeName ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground tnum">
                    {formatRelative(i.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
