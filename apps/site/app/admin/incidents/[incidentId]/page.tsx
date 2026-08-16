"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/components/admin/ui/toast";
import {
  ArrowLeft,
  TriangleAlert,
  UserRound,
  ExternalLink,
  Clock,
  MessageSquarePlus,
  UserPlus,
} from "lucide-react";
import {
  AREA_LABEL,
  INCIDENT_STATUS,
  SEVERITY,
  StatusBadge,
} from "@/components/admin/status";
import { SectionTitle } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import { Select } from "@/components/admin/ui/select";
import { Label } from "@/components/admin/ui/label";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Avatar } from "@/components/admin/ui/avatar";
import { Separator } from "@/components/admin/ui/separator";
import { formatDateTime, formatRelative } from "@/lib/format";

const DETECTED_BY_LABEL: Record<string, string> = {
  monitoring: "Monitoring",
  client: "Client",
  team: "Équipe",
};

const UPDATE_STATUS_VALUES = [
  "open",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
type UpdateStatus = (typeof UPDATE_STATUS_VALUES)[number];

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const incident = useQuery(api.saIncidents.get, {
    incidentId: incidentId as Id<"saIncidents">,
  });

  if (incident === undefined) return <DetailSkeleton />;

  if (incident === null) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Incidents
        </Link>
        <EmptyState
          icon={<TriangleAlert />}
          title="Incident introuvable"
          description="Cet incident n'existe pas ou a été supprimé."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/incidents">Retour aux incidents</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { deployment, updates } = incident;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/admin/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Incidents
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">
                {incident.number}
              </span>
              <StatusBadge map={SEVERITY} value={incident.severity} />
              <StatusBadge map={INCIDENT_STATUS} value={incident.status} />
            </div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {incident.title}
            </h1>
            {incident.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">
                {incident.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column — timeline + update form */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Chronologie</SectionTitle>
              <Timeline updates={updates} />
            </CardContent>
          </Card>

          <AddUpdateForm incidentId={incident._id} />
        </div>

        {/* Side column — metadata + assignment */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <SectionTitle>Informations</SectionTitle>
              <dl className="space-y-3.5 text-sm">
                <MetaRow label="Cible">
                  {deployment ? (
                    <Link
                      href={`/admin/flotte/${deployment._id}`}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {deployment.restaurantName}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  ) : (
                    <span className="text-foreground">Plateforme</span>
                  )}
                </MetaRow>
                <MetaRow label="Détecté par">
                  <span className="text-foreground">
                    {DETECTED_BY_LABEL[incident.detectedBy] ?? incident.detectedBy}
                  </span>
                </MetaRow>
                <MetaRow label="Domaines">
                  {incident.area.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {incident.area.map((a) => (
                        <Badge key={a} variant="muted">
                          {AREA_LABEL[a] ?? a}
                        </Badge>
                      ))}
                    </div>
                  )}
                </MetaRow>
                <Separator />
                <MetaRow label="Démarré">
                  <span className="text-foreground tnum">
                    {formatDateTime(incident.startedAt)}
                  </span>
                </MetaRow>
                <MetaRow label="Accusé">
                  <span className="text-foreground tnum">
                    {formatDateTime(incident.acknowledgedAt)}
                  </span>
                </MetaRow>
                <MetaRow label="Résolu">
                  <span className="text-foreground tnum">
                    {formatDateTime(incident.resolvedAt)}
                  </span>
                </MetaRow>
                {incident.impact && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Impact</dt>
                      <dd className="text-foreground">{incident.impact}</dd>
                    </div>
                  </>
                )}
                {incident.resolutionSummary && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <dt className="text-muted-foreground">Résolution</dt>
                      <dd className="text-foreground">
                        {incident.resolutionSummary}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <AssignCard
            incidentId={incident._id}
            assigneeName={incident.assigneeName}
          />
        </div>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

type Update = {
  _id: string;
  status?: string;
  message: string;
  authorName?: string;
  createdAt: number;
};

function Timeline({ updates }: { updates: Update[] }) {
  if (updates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune mise à jour pour l’instant.
      </p>
    );
  }
  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {updates.map((u) => (
        <li key={u._id} className="relative">
          <span className="absolute -left-[1.9rem] top-1 grid size-3.5 place-items-center rounded-full border-2 border-background bg-surface-4">
            <span className="size-1.5 rounded-full bg-muted-foreground" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {u.status && (
              <StatusBadge map={INCIDENT_STATUS} value={u.status} />
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {formatRelative(u.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
            {u.message}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {u.authorName ?? "Système"}
          </p>
        </li>
      ))}
    </ol>
  );
}

function AddUpdateForm({ incidentId }: { incidentId: Id<"saIncidents"> }) {
  const addUpdate = useMutation(api.saIncidents.addUpdate);
  const [status, setStatus] = React.useState<UpdateStatus | "">("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const resolving = status === "resolved";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Ajoute un message à la mise à jour.");
      return;
    }
    setSubmitting(true);
    try {
      await addUpdate({
        incidentId,
        message: trimmed,
        ...(status ? { status } : {}),
      });
      toast.success(
        status ? "Mise à jour publiée." : "Note ajoutée.",
      );
      setMessage("");
      setStatus("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <SectionTitle>Ajouter une mise à jour</SectionTitle>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="update-status">Changement de statut</Label>
            <Select
              id="update-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UpdateStatus | "")}
            >
              <option value="">Aucun changement</option>
              {UPDATE_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {INCIDENT_STATUS[s]!.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="update-message">
              {resolving ? "Résumé de résolution" : "Message"}
            </Label>
            <Textarea
              id="update-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                resolving
                  ? "Décris la cause et la résolution — ce message devient le résumé de résolution."
                  : "Décris l'avancement, les actions en cours…"
              }
            />
            {resolving && (
              <p className="text-xs text-muted-foreground">
                Ce message sera enregistré comme résumé de résolution de
                l’incident.
              </p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submitting}>
              <MessageSquarePlus className="size-4" />
              {submitting ? "Publication…" : "Publier"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AssignCard({
  incidentId,
  assigneeName,
}: {
  incidentId: Id<"saIncidents">;
  assigneeName?: string;
}) {
  const assign = useMutation(api.saIncidents.assign);
  const [value, setValue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setValue(assigneeName ?? "");
  }, [assigneeName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    setSubmitting(true);
    try {
      await assign({
        incidentId,
        ...(trimmed ? { assigneeName: trimmed } : {}),
      });
      toast.success(trimmed ? "Incident assigné." : "Assignation retirée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <SectionTitle>Assignation</SectionTitle>
        <div className="mb-4 flex items-center gap-2.5">
          {assigneeName ? (
            <>
              <Avatar name={assigneeName} />
              <span className="text-sm font-medium text-foreground">
                {assigneeName}
              </span>
            </>
          ) : (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground">
                <UserRound className="size-4" />
              </span>
              <span className="text-sm text-muted-foreground">Non assigné</span>
            </>
          )}
        </div>
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="assignee">Responsable</Label>
            <Input
              id="assignee"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nom du responsable"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={submitting}>
            <UserPlus className="size-4" />
            Assigner
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-8 w-2/3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-52" />
        </div>
      </div>
    </div>
  );
}
