"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BadgeCheck, RefreshCw, CalendarClock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import {
  StatusBadge,
  SUBSCRIPTION_STATUS,
} from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Select } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { EmptyState } from "@/components/admin/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/admin/ui/table";
import { cn } from "@/lib/utils";
import {
  formatCentsRounded,
  formatNumber,
  formatDate,
  daysUntil,
} from "@/lib/format";

type SubStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

const STATUS_OPTIONS: { value: SubStatus; label: string }[] = [
  { value: "active", label: "Actif" },
  { value: "past_due", label: "En retard" },
  { value: "canceled", label: "Annulé" },
  { value: "unpaid", label: "Impayé" },
  { value: "incomplete", label: "Incomplet" },
];

function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge variant={plan === "premium" ? "primary" : "muted"}>
      {plan === "premium" ? "Premium" : "Essentielle"}
    </Badge>
  );
}

/** Due-date chip, coloured by urgency (days remaining). */
function DueChip({ end }: { end?: number | null }) {
  if (!end) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const d = daysUntil(end);
  const tone =
    d < 0
      ? "bg-danger-soft text-danger"
      : d <= 14
        ? "bg-warning-soft text-warning"
        : "bg-surface-2 text-muted-foreground";
  const label =
    d < 0
      ? `en retard de ${Math.abs(d)} j`
      : d === 0
        ? "aujourd'hui"
        : `dans ${d} j`;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tnum",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export default function AbonnementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const status =
    statusParam && STATUS_OPTIONS.some((o) => o.value === statusParam)
      ? (statusParam as SubStatus)
      : undefined;

  const data = useQuery(
    api.saRevenue.subscriptionsOverview,
    status ? { status } : {},
  );

  function onStatusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("status");
    else params.set("status", value);
    const qs = params.toString();
    router.replace(qs ? `/admin/abonnements?${qs}` : "/admin/abonnements");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abonnements & maintenance"
        description="Contrats de maintenance annuelle et abonnements récurrents des clients."
      >
        <div className="w-48">
          <Select
            value={status ?? "all"}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </PageHeader>

      {/* KPI */}
      {data === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Abonnements actifs"
            value={formatNumber(data.stats.active)}
            hint={`${formatNumber(data.stats.total)} au total`}
            icon={<BadgeCheck />}
          />
          <KpiCard
            label="MRR"
            value={formatCentsRounded(data.stats.mrrCents)}
            hint={`ARR ${formatCentsRounded(data.stats.arrCents)}`}
            icon={<RefreshCw />}
          />
          <KpiCard
            label="Échéance 30 j"
            value={formatNumber(data.stats.due30Count)}
            deltaLabel={formatCentsRounded(data.stats.due30Cents)}
            hint="à renouveler"
            icon={<CalendarClock />}
            accent={data.stats.due30Count > 0 ? "var(--warning)" : undefined}
          />
          <KpiCard
            label="En retard"
            value={formatNumber(data.stats.pastDue)}
            hint={data.stats.pastDue > 0 ? "action requise" : "aucun"}
            icon={<TriangleAlert />}
            accent={data.stats.pastDue > 0 ? "var(--danger)" : undefined}
          />
        </div>
      )}

      {/* Table */}
      <Card>
        {data === undefined ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : data.list.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<RefreshCw />}
              title="Aucun abonnement"
              description={
                status
                  ? "Aucun abonnement ne correspond à ce filtre."
                  : "Les contrats de maintenance apparaîtront ici après la première année incluse."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant / an</TableHead>
                <TableHead>Prochaine échéance</TableHead>
                <TableHead className="text-right">Depuis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((s) => {
                const pastDue = s.status === "past_due";
                return (
                  <TableRow
                    key={s._id}
                    className={cn(
                      pastDue && "border-l-2 border-l-danger bg-danger-soft/30",
                    )}
                  >
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {s.customerEmail}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PlanBadge plan={s.plan} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge map={SUBSCRIPTION_STATUS} value={s.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground tnum">
                      {formatCentsRounded(s.annualCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-foreground tnum">
                          {formatDate(s.currentPeriodEnd)}
                        </span>
                        <DueChip end={s.currentPeriodEnd} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tnum">
                      {formatDate(s.createdAt)}
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
