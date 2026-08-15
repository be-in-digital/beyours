"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, Users, BadgeCheck, RefreshCw, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
import {
  DEPLOYMENT_STATUS,
  HealthDot,
  StatusBadge,
  SUBSCRIPTION_STATUS,
} from "@/components/admin/status";
import { Badge } from "@/components/admin/ui/badge";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
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
  formatCentsRounded,
  formatDate,
  formatNumber,
} from "@/lib/format";

const PLAN_LABEL: Record<string, string> = {
  premium: "Premium",
  essentielle: "Essentielle",
};

export default function AdminClientsPage() {
  const [search, setSearch] = React.useState("");
  const trimmed = search.trim();

  const stats = useQuery(api.saClients.stats, {});
  const clients = useQuery(
    api.saClients.list,
    trimmed ? { search: trimmed } : {},
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Clients réels dérivés des commandes — regroupés par email, triés par total dépensé."
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
            label="Clients"
            value={formatNumber(stats.totalClients)}
            icon={<Users />}
          />
          <KpiCard
            label="Clients payants"
            value={formatNumber(stats.payingClients)}
            icon={<BadgeCheck />}
          />
          <KpiCard
            label="Abonnements actifs"
            value={formatNumber(stats.activeSubscriptions)}
            icon={<RefreshCw />}
          />
          <KpiCard
            label="Prospects"
            value={formatNumber(stats.prospects)}
            icon={<UserPlus />}
          />
        </div>
      )}

      {/* Recherche + table */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client, restaurant, ville…"
              className="pl-9"
              aria-label="Rechercher un client"
            />
          </div>
          {clients !== undefined && (
            <span className="hidden text-sm text-muted-foreground tnum sm:inline">
              {formatNumber(clients.length)} client
              {clients.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {clients === undefined ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<Users />}
            title={trimmed ? "Aucun résultat" : "Aucun client"}
            description={
              trimmed
                ? "Aucun client ne correspond à cette recherche."
                : "Les clients apparaîtront ici dès la première commande."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Commandes</TableHead>
                <TableHead className="text-right">Total dépensé</TableHead>
                <TableHead>Abonnement</TableHead>
                <TableHead>Déploiement</TableHead>
                <TableHead>Dernière commande</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.email}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-foreground">{c.restaurantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.city}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.plan === "premium" ? "primary" : "muted"}>
                      {PLAN_LABEL[c.plan] ?? c.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-foreground tnum">
                    {formatNumber(c.orderCount)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground tnum">
                    {formatCentsRounded(c.totalSpentCents)}
                  </TableCell>
                  <TableCell>
                    {c.subscriptionStatus ? (
                      <StatusBadge
                        map={SUBSCRIPTION_STATUS}
                        value={c.subscriptionStatus}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.deploymentStatus && c.deploymentId ? (
                      <Link
                        href={`/admin/flotte/${c.deploymentId}`}
                        className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                      >
                        {c.deploymentHealth && (
                          <HealthDot health={c.deploymentHealth} />
                        )}
                        <StatusBadge
                          map={DEPLOYMENT_STATUS}
                          value={c.deploymentStatus}
                        />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Aucun</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tnum">
                    {formatDate(c.lastOrderAt)}
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
