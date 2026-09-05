"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "@/components/admin/ui/toast";
import {
  ArrowLeft,
  ChevronDown,
  Server,
  Activity,
  GitBranch,
  Store,
  Euro,
  TriangleAlert,
  Plug,
  Plus,
  KeyRound,
  Pencil,
  ShieldCheck,
  CheckCircle2,
  X,
} from "lucide-react";
import { SectionTitle } from "@/components/admin/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { AreaChart } from "@/components/admin/charts";
import { EmptyState } from "@/components/admin/empty-state";
import {
  DEPLOYMENT_STATUS,
  HEALTH,
  SEVERITY,
  INCIDENT_STATUS,
  MAINTENANCE_STATUS,
  INTEGRATION_STATUS,
  INTEGRATION_LABEL,
  StatusBadge,
} from "@/components/admin/status";
import { ProbeNowButton } from "@/components/admin/probe-now-button";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Textarea } from "@/components/admin/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from "@/components/admin/ui/dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import {
  formatCentsCompact,
  formatCentsRounded,
  formatDate,
  formatDayMonth,
  formatNumber,
  formatRelative,
} from "@/lib/format";

type DeploymentStatus =
  | "provisioning"
  | "staging"
  | "live"
  | "degraded"
  | "suspended"
  | "offboarded";

const STATUS_ACTIONS: DeploymentStatus[] = [
  "live",
  "degraded",
  "suspended",
  "provisioning",
  "offboarded",
];

const PLAN_LABEL: Record<string, string> = {
  essentielle: "Essentielle",
  premium: "Premium",
};

const STORE_STATUS: Record<string, { label: string; variant: "success" | "muted" | "warning" | "danger" }> = {
  open: { label: "Ouvert", variant: "success" },
  closed: { label: "Fermé", variant: "muted" },
  draft: { label: "Brouillon", variant: "muted" },
  temporarily_unavailable: { label: "Indisponible", variant: "warning" },
};

const CHECK_STATUS: Record<string, "success" | "danger" | "warning"> = {
  up: "success",
  down: "danger",
  degraded: "warning",
};
const CHECK_LABEL: Record<string, string> = {
  up: "OK",
  down: "Down",
  degraded: "Dégradé",
};

const CHECK_KIND_LABEL: Record<string, string> = {
  http: "HTTP",
  convex: "Convex",
  integration: "Intégration",
  webhook: "Webhook",
};

const REGION_OPTIONS = [
  { value: "eu-west-3", label: "eu-west-3 (Paris)" },
  { value: "eu-west-1", label: "eu-west-1 (Irlande)" },
] as const;

const INTEGRATION_KEYS = [
  "stripe",
  "sumup",
  "paypal",
  "square",
  "uber_eats",
  "deliveroo",
  "uber_direct",
  "ses",
] as const;

const INTEGRATION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "not_configured",
] as const;

type IntegrationRow = {
  key: (typeof INTEGRATION_KEYS)[number];
  status: (typeof INTEGRATION_STATUSES)[number];
  detail?: string;
};

export default function DeploymentDetailPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const id = deploymentId as Id<"saDeployments">;

  const deployment = useQuery(api.saFleet.get, { deploymentId: id });
  const sales = useQuery(api.saSales.forDeployment, {
    deploymentId: id,
    days: 30,
  });
  const updateStatus = useMutation(api.saFleet.updateStatus);
  const recordAccessRevoked = useMutation(api.saFleet.recordAccessRevoked);
  const issueLicenseKey = useMutation(api.saFleet.issueLicenseKey);

  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  /* Held after a rotation: the key is written into the site's
     .beindigital-site.json by hand, so it has to be readable once. */
  const [issuedKey, setIssuedKey] = React.useState<string | null>(null);

  if (deployment === undefined) return <DetailSkeleton />;

  if (deployment === null) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={<Server />}
          title="Déploiement introuvable"
          description="Ce déploiement n'existe pas ou a été supprimé."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/flotte">Retour aux déploiements</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const outdated =
    deployment.version &&
    deployment.latestVersion &&
    deployment.version !== deployment.latestVersion;

  async function onChangeStatus(status: DeploymentStatus) {
    if (status === deployment!.status || pending) return;
    setPending(true);
    try {
      await updateStatus({ deploymentId: id, status });
      toast.success(`Statut mis à jour : ${DEPLOYMENT_STATUS[status]!.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  async function onConfirmRevoked() {
    setPending(true);
    try {
      await recordAccessRevoked({ deploymentId: id });
      toast.success("Accès marqués comme révoqués.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  async function onIssueLicenseKey() {
    setPending(true);
    try {
      const key = await issueLicenseKey({ deploymentId: id });
      setIssuedKey(key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPending(false);
    }
  }

  /* "Sorti" is a label; it revokes nothing. While the revocation is
     outstanding, say so rather than letting the badge read as done. */
  const revocationPending =
    deployment.offboardedAt != null && deployment.accessRevokedAt == null;

  const salesSeries =
    sales?.series.map((p) => ({
      label: formatDayMonth(p.dayTs),
      value: p.grossCents,
    })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <BackLink />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {deployment.restaurantName}
              </h1>
              <StatusBadge map={DEPLOYMENT_STATUS} value={deployment.status} />
              <StatusBadge map={HEALTH} value={deployment.health} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a
                href={`https://${deployment.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {deployment.domain}
              </a>
              <span className="text-border">·</span>
              <span className="text-muted-foreground">
                {deployment.customerEmail}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
              Modifier
            </Button>
            <Dropdown
              trigger={
                <Button variant="outline" size="sm" disabled={pending}>
                  Changer le statut
                  <ChevronDown className="size-4" />
                </Button>
              }
            >
              <DropdownLabel>Nouveau statut</DropdownLabel>
              <DropdownSeparator />
              {STATUS_ACTIONS.map((s) => {
                const current = s === deployment.status;
                return (
                  <DropdownItem
                    key={s}
                    disabled={current || pending}
                    onClick={() => onChangeStatus(s)}
                    destructive={s === "offboarded"}
                  >
                    <span className="flex-1">{DEPLOYMENT_STATUS[s]!.label}</span>
                    {current && (
                      <span className="text-[10px] text-muted-foreground">
                        actuel
                      </span>
                    )}
                  </DropdownItem>
                );
              })}
            </Dropdown>
          </div>
        </div>
      </div>

      <EditDeploymentDialog
        open={editing}
        onOpenChange={setEditing}
        deploymentId={id}
        current={{
          domain: deployment.domain,
          region: deployment.region,
          version: deployment.version ?? "",
          latestVersion: deployment.latestVersion ?? "",
          storeCount: deployment.storeCount,
          notes: deployment.notes ?? "",
          integrations: deployment.integrations,
        }}
      />

      <LicenseKeyDialog
        licenseKey={issuedKey}
        onClose={() => setIssuedKey(null)}
      />

      {revocationPending && (
        <Card className="border-danger-border bg-danger-soft p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Accès non révoqués
                </p>
                <p className="text-sm text-muted-foreground">
                  Ce déploiement est marqué sorti, mais rien ne lui a été
                  retiré : il conserve les identifiants reçus au provisioning,
                  dont les clés AWS. Suivez{" "}
                  <span className="font-mono text-xs">
                    tasks/client-offboarding-runbook.md
                  </span>{" "}
                  avant de cocher.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onConfirmRevoked}
              className="shrink-0"
            >
              <ShieldCheck className="size-4" />
              J&apos;ai révoqué les accès
            </Button>
          </div>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {/* Measured by the prober, or nothing at all — never the placeholder
            stamped at provisioning (convex/saMonitoring.ts). */}
        <KpiCard
          label="Uptime 30j"
          value={
            deployment.lastCheckAt
              ? `${deployment.uptime30d.toFixed(2)} %`
              : "—"
          }
          hint={deployment.lastCheckAt ? undefined : "jamais sondé"}
          icon={<Activity />}
        />
        <KpiCard
          label="Version"
          value={
            <span className="font-mono text-xl">{deployment.version ?? "—"}</span>
          }
          hint={
            deployment.latestVersion
              ? outdated
                ? `dernière ${deployment.latestVersion}`
                : "à jour"
              : undefined
          }
          icon={<GitBranch />}
          accent={outdated ? "var(--warning)" : undefined}
        />
        <KpiCard
          label="Boutiques"
          value={formatNumber(deployment.storeCount)}
          hint={`${deployment.stores.length} référencées`}
          icon={<Store />}
        />
        <KpiCard
          label="CA 30j"
          value={formatCentsCompact(deployment.sales30.grossCents)}
          hint={`${formatNumber(deployment.sales30.orderCount)} commandes`}
          icon={<Euro />}
        />
        <KpiCard
          label="Incidents ouverts"
          value={formatNumber(deployment.openIncidentCount)}
          hint={deployment.openIncidentCount > 0 ? "en cours" : "aucun"}
          icon={<TriangleAlert />}
          accent={
            deployment.openIncidentCount > 0 ? "var(--danger)" : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne gauche */}
        <div className="space-y-4 lg:col-span-2">
          {/* Ventes */}
          <Card>
            <div className="flex items-start justify-between gap-4 p-5 pb-2">
              <div>
                <SectionTitle className="mb-0">
                  Ventes du restaurant — 30 j
                </SectionTitle>
                <p className="mt-1 font-display text-2xl font-semibold tracking-tight tnum">
                  {sales
                    ? formatCentsRounded(sales.totals.grossCents)
                    : formatCentsRounded(deployment.sales30.grossCents)}
                </p>
              </div>
              {sales && (
                <div className="text-right text-xs text-muted-foreground">
                  <div className="tnum">
                    {formatNumber(sales.totals.orderCount)} commandes
                  </div>
                  <div className="tnum">
                    Panier moyen {formatCentsRounded(sales.totals.avgOrderValueCents)}
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 pb-4">
              {sales === undefined ? (
                <Skeleton className="h-[240px] w-full" />
              ) : salesSeries.every((p) => p.value === 0) ? (
                <div className="grid h-[240px] place-items-center text-sm text-muted-foreground">
                  Aucune vente enregistrée sur la période.
                </div>
              ) : (
                <AreaChart
                  data={salesSeries}
                  valueFormatter={(v) => formatCentsCompact(v)}
                />
              )}
            </div>
          </Card>

          {/* Monitoring */}
          <Card className="p-5">
            <SectionTitle action={<ProbeNowButton deploymentId={id} />}>
              Monitoring
            </SectionTitle>
            {deployment.recentChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun contrôle enregistré pour ce déploiement. La sonde passe
                toutes les 10 minutes sur les déploiements en ligne.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Latence</TableHead>
                    <TableHead className="text-right">Code</TableHead>
                    <TableHead className="text-right">Vérifié</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployment.recentChecks.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="text-muted-foreground">
                        {CHECK_KIND_LABEL[c.kind] ?? c.kind}
                      </TableCell>
                      <TableCell className="max-w-[16rem]">
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {c.target}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={CHECK_STATUS[c.status] ?? "muted"}>
                          {CHECK_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tnum text-muted-foreground">
                        {typeof c.latencyMs === "number"
                          ? `${formatNumber(c.latencyMs)} ms`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tnum text-muted-foreground">
                        {c.statusCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatRelative(c.checkedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Incidents */}
          <Card className="p-5">
            <SectionTitle>Incidents</SectionTitle>
            {deployment.incidents.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2.5 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Aucun incident lié à ce déploiement.
              </div>
            ) : (
              <ul className="space-y-2">
                {deployment.incidents.map((i) => (
                  <li key={i._id}>
                    <Link
                      href={`/admin/incidents/${i._id}`}
                      className="block rounded-md border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {i.number}
                          </span>
                          <StatusBadge map={SEVERITY} value={i.severity} />
                        </div>
                        <StatusBadge map={INCIDENT_STATUS} value={i.status} />
                      </div>
                      <p className="mt-1.5 line-clamp-1 text-sm font-medium text-foreground">
                        {i.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(i.startedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Infrastructure */}
          <Card className="p-5">
            <SectionTitle>Infrastructure</SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <DefRow label="Environnement">
                <span className="text-foreground">{deployment.environment}</span>
              </DefRow>
              <DefRow label="Région">
                <span className="text-foreground">{deployment.region}</span>
              </DefRow>
              <DefRow label="Plan">
                <Badge
                  variant={deployment.plan === "premium" ? "primary" : "muted"}
                >
                  {PLAN_LABEL[deployment.plan] ?? deployment.plan}
                </Badge>
              </DefRow>
              <div className="flex flex-col gap-1 border-t border-border pt-2.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  URL Convex
                </dt>
                <dd className="break-all font-mono text-xs text-foreground">
                  {deployment.convexUrl ?? "—"}
                </dd>
              </div>
              <DefRow label="Provisionné" className="border-t border-border pt-2.5">
                <span className="text-foreground tnum">
                  {formatDate(deployment.provisionedAt)}
                </span>
              </DefRow>
              <DefRow label="Mise en ligne">
                <span className="text-foreground tnum">
                  {formatDate(deployment.goLiveAt)}
                </span>
              </DefRow>
              <DefRow label="Dernier déploiement">
                <span className="text-foreground tnum">
                  {deployment.lastDeployAt
                    ? formatRelative(deployment.lastDeployAt)
                    : "—"}
                </span>
              </DefRow>
              <DefRow label="Dernier contrôle">
                <span className="text-foreground tnum">
                  {deployment.lastCheckAt
                    ? formatRelative(deployment.lastCheckAt)
                    : "—"}
                </span>
              </DefRow>
            </dl>
          </Card>

          {/* Integrations */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Plug className="size-3.5" /> Intégrations
              </span>
            </SectionTitle>
            {deployment.integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune intégration configurée.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {deployment.integrations.map((it) => (
                  <li
                    key={it.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {INTEGRATION_LABEL[it.key] ?? it.key}
                      </span>
                      {it.detail && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {it.detail}
                        </span>
                      )}
                    </div>
                    <StatusBadge map={INTEGRATION_STATUS} value={it.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Boutiques */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Store className="size-3.5" /> Boutiques
              </span>
            </SectionTitle>
            {deployment.stores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune boutique référencée.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {deployment.stores.map((s) => {
                  const meta = STORE_STATUS[s.status] ?? {
                    label: s.status,
                    variant: "muted" as const,
                  };
                  return (
                    <li
                      key={s._id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {s.name}
                        </span>
                        {s.city && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {s.city}
                          </span>
                        )}
                      </div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Maintenance */}
          <Card className="p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-3.5" /> Maintenance
              </span>
            </SectionTitle>
            <dl className="space-y-2.5 text-sm">
              <DefRow label="Contrat">
                <StatusBadge
                  map={MAINTENANCE_STATUS}
                  value={deployment.maintenance.status}
                />
              </DefRow>
              <DefRow label="Couverte jusqu'au">
                <span className="text-foreground tnum">
                  {formatDate(deployment.maintenance.coveredUntil)}
                </span>
              </DefRow>
              <DefRow label="Renouvellement">
                {deployment.maintenance.autoRenew ? (
                  <Badge variant="success">Auto</Badge>
                ) : (
                  <Badge variant="muted">Manuel</Badge>
                )}
              </DefRow>
              {/* The key the site presents to /maintenance/status. A site
                  provisioned before the entitlement gate has none and reads as
                  unregistered until one is issued — which until now could only
                  be done from the Convex dashboard (apps/themes/docs/UPDATES.md). */}
              <DefRow label="Clé de licence" className="border-t border-border pt-2.5">
                {deployment.licenseKey ? (
                  <Badge variant="success">Émise</Badge>
                ) : (
                  <Badge variant="warning">Absente</Badge>
                )}
              </DefRow>
            </dl>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              disabled={pending}
              onClick={onIssueLicenseKey}
            >
              <KeyRound className="size-4" />
              {deployment.licenseKey
                ? "Régénérer la clé"
                : "Émettre une clé"}
            </Button>
            {deployment.licenseKey && (
              <p className="mt-2 text-xs text-muted-foreground">
                Régénérer invalide la clé détenue par le site : elle doit être
                reportée dans son{" "}
                <span className="font-mono">.beindigital-site.json</span>.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

type EditForm = {
  domain: string;
  region: string;
  version: string;
  latestVersion: string;
  /* String, not number: an empty number input reads as "" and `Number("")` is
     0, which would silently zero a restaurant's store count. */
  storeCount: string;
  notes: string;
};

type EditableDeployment = {
  domain: string;
  region: string;
  version: string;
  latestVersion: string;
  storeCount: number;
  notes: string;
  integrations: readonly IntegrationRow[];
};

function toForm(d: EditableDeployment): EditForm {
  return {
    domain: d.domain,
    region: d.region,
    version: d.version,
    latestVersion: d.latestVersion,
    storeCount: String(d.storeCount),
    notes: d.notes,
  };
}

/* ── Operator corrections ──
   Everything `saFleet.update` still accepts, in one place. `health` and
   `uptime30d` are deliberately absent: they are computed from the probe rounds
   now, so a field for them would only let an operator type a number that the
   next round overwrites. */
function EditDeploymentDialog({
  open,
  onOpenChange,
  deploymentId,
  current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deploymentId: Id<"saDeployments">;
  current: EditableDeployment;
}) {
  const update = useMutation(api.saFleet.update);
  const [form, setForm] = React.useState<EditForm>(() => toForm(current));
  const [integrations, setIntegrations] = React.useState<IntegrationRow[]>(() =>
    current.integrations.map((i) => ({ ...i })),
  );
  const [submitting, setSubmitting] = React.useState(false);

  /* Reloads the deployment's current values every time the dialog is opened:
     it stays mounted while closed so the close animation can play, which means
     stale form state would otherwise survive between openings. `current` is
     rebuilt on every render of the parent, so opening is the real trigger. */
  React.useEffect(() => {
    if (!open) return;
    setForm(toForm(current));
    setIntegrations(current.integrations.map((i) => ({ ...i })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const usedKeys = new Set(integrations.map((i) => i.key));
  const nextFreeKey = INTEGRATION_KEYS.find((k) => !usedKeys.has(k));
  const duplicateKeys = usedKeys.size !== integrations.length;
  const storeCount = Number.parseInt(form.storeCount, 10);
  const canSubmit =
    form.domain.trim() !== "" &&
    Number.isFinite(storeCount) &&
    storeCount >= 0 &&
    !duplicateKeys &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await update({
        deploymentId,
        domain: form.domain.trim(),
        region: form.region,
        version: form.version.trim(),
        latestVersion: form.latestVersion.trim(),
        storeCount,
        notes: form.notes,
        integrations: integrations.map((i) => ({
          key: i.key,
          status: i.status,
          detail: i.detail?.trim() ? i.detail.trim() : undefined,
        })),
      });
      toast.success("Déploiement mis à jour.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>Modifier le déploiement</DialogTitle>
          <DialogDescription>
            Les informations tenues à jour à la main. La santé et l&apos;uptime
            sont mesurés par la sonde et ne se saisissent pas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-domain">Domaine</Label>
            <Input
              id="edit-domain"
              className="font-mono"
              value={form.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="lebistrot.fr"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-region">Région</Label>
              <Select
                id="edit-region"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
              >
                {REGION_OPTIONS.some((r) => r.value === form.region) ? null : (
                  <option value={form.region}>{form.region}</option>
                )}
                {REGION_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-stores">Boutiques</Label>
              <Input
                id="edit-stores"
                type="number"
                min={0}
                value={form.storeCount}
                onChange={(e) => set("storeCount", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-version">Version installée</Label>
              <Input
                id="edit-version"
                className="font-mono"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
                placeholder="1.4.2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-latest">Dernière version</Label>
              <Input
                id="edit-latest"
                className="font-mono"
                value={form.latestVersion}
                onChange={(e) => set("latestVersion", e.target.value)}
                placeholder="1.5.0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>Intégrations</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!nextFreeKey}
                onClick={() =>
                  nextFreeKey &&
                  setIntegrations((rows) => [
                    ...rows,
                    { key: nextFreeKey, status: "not_configured" },
                  ])
                }
              >
                <Plus className="size-4" />
                Ajouter
              </Button>
            </div>
            {integrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune intégration configurée.
              </p>
            ) : (
              <ul className="space-y-2">
                {integrations.map((row, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Select
                        aria-label="Intégration"
                        value={row.key}
                        onChange={(e) =>
                          setIntegrations((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    key: e.target
                                      .value as IntegrationRow["key"],
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        {INTEGRATION_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {INTEGRATION_LABEL[k] ?? k}
                          </option>
                        ))}
                      </Select>
                      <Select
                        aria-label="Statut"
                        value={row.status}
                        onChange={(e) =>
                          setIntegrations((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    status: e.target
                                      .value as IntegrationRow["status"],
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        {INTEGRATION_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {INTEGRATION_STATUS[st]?.label ?? st}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label="Détail"
                        className="sm:col-span-2"
                        value={row.detail ?? ""}
                        onChange={(e) =>
                          setIntegrations((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, detail: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="Détail (ex. « webhook en erreur depuis le 12/03 »)"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Retirer l'intégration"
                      onClick={() =>
                        setIntegrations((rows) =>
                          rows.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {duplicateKeys && (
              <p className="text-xs text-danger">
                Une intégration ne peut apparaître qu&apos;une fois.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Contexte utile pour l'équipe."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* Shown once, right after a key is issued or rotated: the site does not learn
   its key from this backend, someone copies it into the repository. */
function LicenseKeyDialog({
  licenseKey,
  onClose,
}: {
  licenseKey: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={licenseKey !== null} onOpenChange={() => onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>Clé de licence</DialogTitle>
          <DialogDescription>
            À reporter dans le{" "}
            <span className="font-mono text-xs">.beindigital-site.json</span> du
            site. Elle ne sera plus affichée en clair ensuite.
          </DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-md border border-border bg-surface-1 p-3 font-mono text-sm">
          {licenseKey}
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/flotte"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Déploiements
    </Link>
  );
}

function DefRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}
