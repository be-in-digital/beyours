"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Landmark,
  FileClock,
  CheckCircle2,
  Files,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { BarChart } from "@/components/admin/charts";
import { StatusBadge, INVOICE_STATUS } from "@/components/admin/status";
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
import {
  formatCents,
  formatCentsRounded,
  formatCentsCompact,
  formatNumber,
  formatDate,
} from "@/lib/format";

type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "open", label: "À payer" },
  { value: "paid", label: "Payée" },
  { value: "void", label: "Annulée" },
  { value: "uncollectible", label: "Irrécouvrable" },
];

/** Ordre d'affichage stable pour la ventilation par statut. */
const STATUS_ORDER: InvoiceStatus[] = [
  "paid",
  "open",
  "draft",
  "uncollectible",
  "void",
];

function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge variant={plan === "premium" ? "primary" : "muted"}>
      {plan === "premium" ? "Premium" : "Essentielle"}
    </Badge>
  );
}

export default function FacturesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const status =
    statusParam && STATUS_OPTIONS.some((o) => o.value === statusParam)
      ? (statusParam as InvoiceStatus)
      : undefined;

  const data = useQuery(
    api.saRevenue.invoicesOverview,
    status ? { status } : {},
  );

  function onStatusChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete("status");
    else params.set("status", value);
    const qs = params.toString();
    router.replace(qs ? `/admin/factures?${qs}` : "/admin/factures");
  }

  const paidCount = data?.stats.byStatus["paid"]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        description="Facturation Stripe des créations de sites et renouvellements de maintenance."
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
            label="Encaissé ce mois"
            value={formatCentsRounded(data.stats.paidThisMonthCents)}
            icon={<Landmark />}
          />
          <KpiCard
            label="Ouvertes"
            value={formatNumber(data.stats.openCount)}
            deltaLabel={formatCentsRounded(data.stats.openCents)}
            hint="à encaisser"
            icon={<FileClock />}
            accent={data.stats.openCount > 0 ? "var(--info)" : undefined}
          />
          <KpiCard
            label="Payées"
            value={formatNumber(paidCount)}
            hint={`${formatCentsCompact(
              data.stats.byStatus["paid"]?.cents ?? 0,
            )} au total`}
            icon={<CheckCircle2 />}
          />
          <KpiCard
            label="Total factures"
            value={formatNumber(data.stats.total)}
            icon={<Files />}
          />
        </div>
      )}

      {/* Graph + ventilation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-5 pb-2">
            <SectionTitle className="mb-0">
              Encaissements — 6 mois
            </SectionTitle>
          </div>
          <div className="px-4 pb-4">
            {data === undefined ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <BarChart
                data={data.monthly}
                valueFormatter={(v) => formatCentsCompact(v)}
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Par statut</SectionTitle>
          {data === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            (() => {
              const rows = STATUS_ORDER.filter(
                (s) => data.stats.byStatus[s],
              ).map((s) => ({ status: s, ...data.stats.byStatus[s]! }));
              if (rows.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Aucune facture pour l’instant.
                  </p>
                );
              }
              return (
                <ul className="divide-y divide-border">
                  {rows.map((r) => (
                    <li
                      key={r.status}
                      className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <StatusBadge map={INVOICE_STATUS} value={r.status} />
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground tnum">
                          {formatNumber(r.count)}
                        </span>
                        <span className="w-20 text-right font-medium text-foreground tnum">
                          {formatCentsRounded(r.cents)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </Card>
      </div>

      {/* Table */}
      <Card>
        <div className="p-5 pb-3">
          <SectionTitle className="mb-0">
            {status
              ? STATUS_OPTIONS.find((o) => o.value === status)?.label
              : "Toutes les factures"}
          </SectionTitle>
        </div>
        {data === undefined ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : data.list.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={<Receipt />}
              title="Aucune facture"
              description={
                status
                  ? "Aucune facture ne correspond à ce filtre."
                  : "Les factures Stripe apparaîtront ici dès la première transaction."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Émise</TableHead>
                <TableHead className="text-right">Lien</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.list.map((inv) => (
                <TableRow key={inv._id}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {inv.stripeInvoiceId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">
                      {inv.customerEmail}
                    </span>
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={inv.plan} />
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tnum">
                    {formatCents(inv.amountCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={INVOICE_STATUS} value={inv.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tnum">
                    {formatDate(inv.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Voir
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
