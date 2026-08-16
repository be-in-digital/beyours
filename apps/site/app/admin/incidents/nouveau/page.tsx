"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/components/admin/ui/toast";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AREA_LABEL } from "@/components/admin/status";
import { Card, CardContent, CardFooter } from "@/components/admin/ui/card";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import { Select } from "@/components/admin/ui/select";
import { Label } from "@/components/admin/ui/label";

const SEVERITY_OPTIONS = [
  { value: "sev1", label: "SEV1 — Critique · service interrompu" },
  { value: "sev2", label: "SEV2 — Majeur · fonction clé dégradée" },
  { value: "sev3", label: "SEV3 — Mineur · impact limité" },
  { value: "sev4", label: "SEV4 — Faible · cosmétique ou différé" },
] as const;
type Severity = (typeof SEVERITY_OPTIONS)[number]["value"];

const DETECTED_BY_OPTIONS = [
  { value: "monitoring", label: "Monitoring" },
  { value: "client", label: "Client" },
  { value: "team", label: "Équipe" },
] as const;
type DetectedBy = (typeof DETECTED_BY_OPTIONS)[number]["value"];

const AREA_VALUES = [
  "payments",
  "orders",
  "kitchen",
  "integrations",
  "site",
  "delivery",
  "auth",
  "other",
] as const;
type Area = (typeof AREA_VALUES)[number];

export default function NewIncidentPage() {
  const router = useRouter();
  const create = useMutation(api.saIncidents.create);
  const deployments = useQuery(api.saFleet.list, {});

  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState<Severity>("sev3");
  const [deploymentId, setDeploymentId] = React.useState<string>("");
  const [detectedBy, setDetectedBy] = React.useState<DetectedBy>("monitoring");
  const [areas, setAreas] = React.useState<Area[]>([]);
  const [assigneeName, setAssigneeName] = React.useState("");
  const [impact, setImpact] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function toggleArea(area: Area) {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Le titre est requis.");
      return;
    }
    const trimmedAssignee = assigneeName.trim();
    const trimmedImpact = impact.trim();
    setSubmitting(true);
    try {
      const id = await create({
        title: trimmedTitle,
        severity,
        detectedBy,
        ...(deploymentId
          ? { deploymentId: deploymentId as Id<"saDeployments"> }
          : {}),
        ...(areas.length ? { area: areas } : {}),
        ...(trimmedAssignee ? { assigneeName: trimmedAssignee } : {}),
        ...(trimmedImpact ? { impact: trimmedImpact } : {}),
      });
      toast.success("Incident créé.");
      router.push(`/admin/incidents/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/incidents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Incidents
      </Link>

      <PageHeader
        title="Nouvel incident"
        description="Déclare un incident d'exploitation. Une première entrée est ajoutée automatiquement à la chronologie."
      />

      <Card className="max-w-2xl">
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-5 p-5">
            {/* Titre */}
            <div className="space-y-1.5">
              <Label htmlFor="title">
                Titre <span className="text-danger">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Paiements Stripe en échec sur le storefront"
                required
                autoFocus
              />
            </div>

            {/* Severity + Detected by */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="severity">Gravité</Label>
                <Select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="detectedBy">Détecté par</Label>
                <Select
                  id="detectedBy"
                  value={detectedBy}
                  onChange={(e) => setDetectedBy(e.target.value as DetectedBy)}
                >
                  {DETECTED_BY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Deployment */}
            <div className="space-y-1.5">
              <Label htmlFor="deployment">Déploiement</Label>
              <Select
                id="deployment"
                value={deploymentId}
                onChange={(e) => setDeploymentId(e.target.value)}
                disabled={deployments === undefined}
              >
                <option value="">Plateforme (aucun)</option>
                {(deployments ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.restaurantName} — {d.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Laisse sur « Plateforme » si l’incident ne concerne pas un
                restaurant en particulier.
              </p>
            </div>

            {/* Domaines */}
            <div className="space-y-2">
              <span className="text-sm font-medium leading-none text-foreground">
                Domaines impactés
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AREA_VALUES.map((area) => {
                  const active = areas.includes(area);
                  return (
                    <label
                      key={area}
                      className={
                        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors " +
                        (active
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border bg-surface-1 text-muted-foreground hover:bg-surface-2")
                      }
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={active}
                        onChange={() => toggleArea(area)}
                      />
                      {AREA_LABEL[area]}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <Label htmlFor="assignee">Assigné à</Label>
              <Input
                id="assignee"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Nom du responsable (optionnel)"
              />
            </div>

            {/* Impact */}
            <div className="space-y-1.5">
              <Label htmlFor="impact">Impact</Label>
              <Textarea
                id="impact"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="Qui / quoi est affecté, ampleur, symptômes observés…"
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border pt-5">
            <Button asChild variant="ghost" size="sm" type="button">
              <Link href="/admin/incidents">Annuler</Link>
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              <TriangleAlert className="size-4" />
              {submitting ? "Création…" : "Créer l'incident"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
