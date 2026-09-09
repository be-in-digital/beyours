"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserPlus, Mail } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { EmptyState } from "@/components/admin/empty-state";
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
import { formatNumber, formatRelative } from "@/lib/format";

const PLAN_LABEL: Record<string, string> = {
  premium: "Premium",
  essentielle: "Essentielle",
};

const LEAD_STATUS: Record<string, { label: string; variant: "primary" | "muted" }> = {
  new: { label: "Nouveau", variant: "primary" },
  contacted: { label: "Contacté", variant: "muted" },
  converted: { label: "Converti", variant: "muted" },
  archived: { label: "Archivé", variant: "muted" },
};

export default function AdminProspectsPage() {
  const prospects = useQuery(api.saClients.prospects, {});
  const contactLeads = useQuery(api.contactLeads.list, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description="Demandes entrantes (liste d'attente) — restaurants intéressés pas encore clients."
      />

      {prospects === undefined ? (
        <Skeleton className="h-24 w-full max-w-[16rem]" />
      ) : (
        <div className="max-w-[16rem]">
          <KpiCard
            label="Prospects"
            value={formatNumber(prospects.length)}
            hint="en liste d'attente"
            icon={<UserPlus />}
          />
        </div>
      )}

      <Card className="overflow-hidden">
        {prospects === undefined ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <EmptyState
            className="m-4"
            icon={<UserPlus />}
            title="Aucun prospect"
            description="Les demandes entrantes apparaîtront ici."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Plan visé</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {`${p.firstName} ${p.lastName}`.trim()}
                      </p>
                      <a
                        href={`mailto:${p.email}`}
                        className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground transition-colors hover:text-primary-ink"
                      >
                        <Mail className="size-3" />
                        {p.email}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-foreground">{p.restaurantName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.city}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.plan === "premium" ? "primary" : "muted"}>
                      {PLAN_LABEL[p.plan] ?? p.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground tnum">
                    {p.phone || "—"}
                  </TableCell>
                  <TableCell className="max-w-[22rem]">
                    {p.message ? (
                      <p
                        className="truncate text-muted-foreground"
                        title={p.message}
                      >
                        {p.message}
                      </p>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tnum">
                    {formatRelative(p.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Contact messages (from the site form) */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          Messages de contact
        </h2>
        <Card className="overflow-hidden">
          {contactLeads === undefined ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : contactLeads.length === 0 ? (
            <EmptyState
              className="m-4"
              icon={<Mail />}
              title="Aucun message"
              description="Les messages envoyés depuis le formulaire de contact apparaîtront ici."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Reçu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactLeads.map((lead) => {
                  const status = LEAD_STATUS[lead.status] ?? LEAD_STATUS.new!;
                  return (
                    <TableRow key={lead._id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{lead.name}</p>
                          <a
                            href={`mailto:${lead.email}`}
                            className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground transition-colors hover:text-primary-ink"
                          >
                            <Mail className="size-3" />
                            {lead.email}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {lead.restaurant || "—"}
                      </TableCell>
                      <TableCell className="max-w-[24rem]">
                        <p className="truncate text-muted-foreground" title={lead.message}>
                          {lead.message}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tnum">
                        {formatRelative(lead.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
