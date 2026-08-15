"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Euro,
  ShoppingCart,
  Receipt,
  RefreshCw,
  TrendingUp,
  Store,
  Wrench,
  Hammer,
  ReceiptText,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { AreaChart } from "@/components/admin/charts";
import { SourceBreakdown } from "@/components/admin/source-breakdown";
import {
  HealthDot,
  StatusBadge,
  ORDER_STATUS,
  ORDER_TYPE_LABEL,
} from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { EmptyState } from "@/components/admin/empty-state";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/admin/ui/tabs";
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
  formatDayMonth,
  formatDate,
} from "@/lib/format";

const DAY_OPTIONS = [7, 30, 90] as const;
type Days = (typeof DAY_OPTIONS)[number];

function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge variant={plan === "premium" ? "primary" : "muted"}>
      {plan === "premium" ? "Premium" : "Essentielle"}
    </Badge>
  );
}

/** Barre de proportion sobre (à la SourceBreakdown, mais binaire A vs B). */
function SplitBar({
  title,
  a,
  b,
}: {
  title: string;
  a: { label: string; cents: number; color: string };
  b: { label: string; cents: number; color: string };
}) {
  const total = a.cents + b.cents || 1;
  const aPct = (a.cents / total) * 100;
  const bPct = (b.cents / total) * 100;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full"
          style={{ width: `${aPct}%`, backgroundColor: a.color }}
        />
        <div
          className="h-full"
          style={{ width: `${bPct}%`, backgroundColor: b.color }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: a.color }}
          />
          {a.label}
          <span className="font-medium text-foreground tnum">
            {formatCentsRounded(a.cents)}
          </span>
          <span className="text-muted-foreground tnum">
            {aPct.toFixed(0)}%
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-medium text-foreground tnum">
            {formatCentsRounded(b.cents)}
          </span>
          <span className="text-muted-foreground tnum">
            {bPct.toFixed(0)}%
          </span>
          {b.label}
          <span
            className="size-2 rounded-[2px]"
            style={{ backgroundColor: b.color }}
          />
        </span>
      </div>
    </div>
  );
}

export default function VentesPage() {
  const [days, setDays] = React.useState<Days>(30);
  const revenue = useQuery(api.saRevenue.revenueOverview, { days });
  const fleet = useQuery(api.saSales.fleetOverview, { days });
  const orders = useQuery(api.saRevenue.ordersList, { limit: 15 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventes & revenus"
        description="Chiffre d'affaires commercial réel (création + maintenance) et GMV agrégée des restaurants déployés."
      >
        <Tabs
          value={String(days)}
          onValueChange={(v) => setDays(Number(v) as Days)}
        >
          <TabsList>
            {DAY_OPTIONS.map((d) => (
              <TabsTrigger key={d} value={String(d)}>
                {d} j
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* KPI commerciaux */}
      {revenue === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label={`Revenus (${days} j)`}
            value={formatCentsRounded(revenue.revenueCents)}
            delta={revenue.deltaRevenueRatio}
            hint={`vs ${days} j préc.`}
            icon={<Euro />}
          />
          <KpiCard
            label="Commandes payées"
            value={formatNumber(revenue.orderCount)}
            hint={`${formatNumber(revenue.paidOrderCount)} au total`}
            icon={<ShoppingCart />}
          />
          <KpiCard
            label="Panier moyen"
            value={formatCents(revenue.aovCents)}
            icon={<Receipt />}
          />
          <KpiCard
            label="MRR"
            value={formatCentsRounded(revenue.mrrCents)}
            hint={`ARR ${formatCentsCompact(revenue.arrCents)}`}
            icon={<RefreshCw />}
          />
        </div>
      )}

      {/* CA + répartition */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-4 p-5 pb-2">
            <div>
              <SectionTitle className="mb-0">
                Chiffre d’affaires — {days} j
              </SectionTitle>
              <p className="mt-1 font-display text-2xl font-semibold tracking-tight tnum">
                {revenue === undefined ? (
                  <Skeleton className="mt-1 h-8 w-32" />
                ) : (
                  formatCentsRounded(revenue.revenueCents)
                )}
              </p>
            </div>
          </div>
          <div className="px-4 pb-4">
            {revenue === undefined ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <AreaChart
                data={revenue.series.map((p) => ({
                  label: formatDayMonth(p.dayTs),
                  value: p.revenueCents,
                }))}
                valueFormatter={(v) => formatCentsCompact(v)}
              />
            )}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Répartition</SectionTitle>
          {revenue === undefined ? (
            <div className="space-y-6">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <div className="space-y-6">
              <SplitBar
                title="Création vs Maintenance"
                a={{
                  label: "Création",
                  cents: revenue.creationCents,
                  color: "var(--chart-1)",
                }}
                b={{
                  label: "Maintenance",
                  cents: revenue.maintenanceCents,
                  color: "var(--chart-4)",
                }}
              />
              <SplitBar
                title="Essentielle vs Premium"
                a={{
                  label: "Essentielle",
                  cents: revenue.essentielleCents,
                  color: "var(--chart-2)",
                }}
                b={{
                  label: "Premium",
                  cents: revenue.premiumCents,
                  color: "var(--primary)",
                }}
              />
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
                    <Hammer className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold tnum">
                      {formatCentsCompact(revenue.creationCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">Création</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
                    <Wrench className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold tnum">
                      {formatCentsCompact(revenue.maintenanceCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* GMV flotte */}
      <div className="space-y-4">
        <SectionTitle className="mb-0">
          GMV des restaurants déployés
        </SectionTitle>

        {fleet === undefined ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-24 lg:col-span-2" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={`GMV brut (${days} j)`}
              value={formatCentsCompact(fleet.totals.grossCents)}
              delta={fleet.deltaGrossRatio}
              hint={`${formatNumber(fleet.activeDeployments)} restaurants actifs`}
              icon={<TrendingUp />}
            />
            <KpiCard
              label="Commandes totales"
              value={formatNumber(fleet.totals.orderCount)}
              delta={fleet.deltaOrdersRatio}
              hint={`${formatCents(fleet.totals.avgOrderValueCents)} / commande`}
              icon={<ShoppingCart />}
            />
            <Card className="p-4 sm:col-span-2">
              <SectionTitle className="mb-2">GMV par canal</SectionTitle>
              <SourceBreakdown bySource={fleet.totals.bySource} />
            </Card>
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between gap-4 p-5 pb-3">
            <SectionTitle className="mb-0">Top restaurants</SectionTitle>
            <Link
              href="/admin/flotte"
              className="text-xs font-medium text-primary hover:underline"
            >
              Toute la flotte
            </Link>
          </div>
          {fleet === undefined ? (
            <div className="space-y-2 px-5 pb-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : fleet.restaurants.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={<Store />}
                title="Aucune vente sur la période"
                description="Les restaurants déployés n'ont pas encore enregistré de commandes sur cet intervalle."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead className="text-right">Commandes</TableHead>
                  <TableHead className="w-10 text-right">Santé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fleet.restaurants.slice(0, 10).map((r) => (
                  <TableRow
                    key={r.deploymentId}
                    className="cursor-pointer"
                  >
                    <TableCell className="p-0">
                      <Link
                        href={`/admin/flotte/${r.deploymentId}`}
                        className="flex flex-col px-3 py-2.5"
                      >
                        <span className="font-medium text-foreground">
                          {r.name}
                        </span>
                        {r.city && (
                          <span className="text-xs text-muted-foreground">
                            {r.city}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/flotte/${r.deploymentId}`}>
                        <PlanBadge plan={r.plan} />
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground tnum">
                      <Link href={`/admin/flotte/${r.deploymentId}`}>
                        {formatCentsRounded(r.grossCents)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tnum">
                      <Link href={`/admin/flotte/${r.deploymentId}`}>
                        {formatNumber(r.orderCount)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/flotte/${r.deploymentId}`}
                        className="inline-flex justify-end"
                      >
                        <HealthDot health={r.health} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Dernières commandes */}
      <Card>
        <div className="flex items-center justify-between gap-4 p-5 pb-3">
          <SectionTitle className="mb-0">Dernières commandes</SectionTitle>
          <span className="grid size-8 place-items-center rounded-md bg-surface-2 text-muted-foreground">
            <ReceiptText className="size-4" />
          </span>
        </div>
        {orders === undefined ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={<Receipt />}
              title="Aucune commande"
              description="Les commandes commerciales (achats de sites & maintenance) apparaîtront ici."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o._id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {o.restaurantName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[o.customerFirstName, o.customerLastName]
                          .filter(Boolean)
                          .join(" ") || o.customerEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PlanBadge plan={o.plan} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tnum">
                    {formatCents(o.amountCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge map={ORDER_STATUS} value={o.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tnum">
                    {formatDate(o.createdAt)}
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
