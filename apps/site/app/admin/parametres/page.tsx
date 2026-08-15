"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "@/components/admin/ui/toast";
import { useAdmin } from "@/components/admin/auth-gate";
import {
  Plus,
  Rocket,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Info,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/admin/ui/card";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select } from "@/components/admin/ui/select";
import { Avatar } from "@/components/admin/ui/avatar";
import { Skeleton } from "@/components/admin/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/admin/ui/dialog";
import { formatRelative } from "@/lib/format";

/* ── Checklist go-live (informatif, statique) ── */
const GO_LIVE_STEPS: { title: string; detail: string }[] = [
  {
    title: "Contrat de maintenance provisionné (1 an)",
    detail: "La couverture annuelle est active dès la mise en production.",
  },
  {
    title: "Variables Stripe",
    detail: "Clé secrète, secret de webhook et price ID de la maintenance renseignés.",
  },
  {
    title: "Variables AWS SES",
    detail: "Expéditeur vérifié et région configurés pour l'envoi des e-mails.",
  },
  {
    title: "Webhook Stripe enregistré",
    detail: "Endpoint déclaré côté Stripe pour les paiements et renouvellements.",
  },
  {
    title: "Schéma Convex déployé",
    detail: "Tables, index et fonctions poussés sur l'instance du client.",
  },
  {
    title: "Smoke tests paiement + commande",
    detail: "Un achat et une commande de bout en bout validés en conditions réelles.",
  },
  {
    title: "Bascule DNS / domaine",
    detail: "Le domaine final pointe vers l'instance et le certificat est actif.",
  },
];

const PLAN_OPTIONS = [
  { value: "essentielle", label: "Essentielle" },
  { value: "premium", label: "Premium" },
] as const;

const REGION_OPTIONS = [
  { value: "eu-west-3", label: "eu-west-3 (Paris)" },
  { value: "eu-west-1", label: "eu-west-1 (Irlande)" },
] as const;

export default function ParametresPage() {
  const admin = useAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        description="Profil administrateur, provisioning des déploiements et état de l'ingestion des métriques."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard admin={admin} />
        <ProvisionCard />
      </div>

      <ProvisioningQueue />

      <div className="grid gap-4 lg:grid-cols-2">
        <GoLiveChecklist />
        <MetricsIngestion />
      </div>

      <AboutCard />
    </div>
  );
}

/* ── Profil administrateur ── */
function ProfileCard({ admin }: { admin: ReturnType<typeof useAdmin> }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Profil administrateur
        </h2>
      </div>

      {admin === null ? (
        <div className="flex items-center gap-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <Avatar name={admin.displayName} color="var(--primary)" size="lg" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                {admin.displayName}
              </p>
              {admin.email && (
                <p className="truncate text-sm text-muted-foreground">
                  {admin.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rôle</span>
              <Badge variant="primary">Superadmin</Badge>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Provisionner un déploiement ── */
function ProvisionCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-center gap-2">
        <ServerCog className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Provisionner un déploiement
        </h2>
      </div>
      <p className="flex-1 text-sm text-muted-foreground">
        Créez une nouvelle instance restaurant pour un client existant. Le
        déploiement démarre en <span className="text-foreground">provisioning</span>{" "}
        et rejoint la file ci-dessous.
      </p>
      <div className="mt-4">
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Nouveau déploiement
        </Button>
      </div>
      <ProvisionDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

type FormState = {
  customerEmail: string;
  restaurantName: string;
  city: string;
  name: string;
  domain: string;
  plan: "essentielle" | "premium";
  region: string;
};

const EMPTY_FORM: FormState = {
  customerEmail: "",
  restaurantName: "",
  city: "",
  name: "",
  domain: "",
  plan: "essentielle",
  region: "eu-west-3",
};

function ProvisionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const clients = useQuery(api.saClients.list, {});
  const create = useMutation(api.saFleet.create);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);

  // Réinitialise le formulaire à chaque ouverture.
  React.useEffect(() => {
    if (open) setForm(EMPTY_FORM);
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function onClientChange(email: string) {
    const client = clients?.find((c) => c.email === email);
    if (!client) {
      setForm((f) => ({ ...f, customerEmail: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      customerEmail: client.email,
      restaurantName: client.restaurantName,
      city: client.city,
      plan: client.plan === "premium" ? "premium" : "essentielle",
    }));
  }

  const canSubmit =
    !!form.customerEmail &&
    form.restaurantName.trim() !== "" &&
    form.name.trim() !== "" &&
    form.domain.trim() !== "" &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await create({
        customerEmail: form.customerEmail,
        restaurantName: form.restaurantName.trim(),
        city: form.city.trim(),
        name: form.name.trim(),
        domain: form.domain.trim(),
        plan: form.plan,
        region: form.region,
      });
      toast.success("Déploiement provisionné.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Provisionner un déploiement</DialogTitle>
          <DialogDescription>
            Sélectionnez le client puis renseignez l&apos;instance à créer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prov-client">Client</Label>
            <Select
              id="prov-client"
              value={form.customerEmail}
              onChange={(e) => onClientChange(e.target.value)}
              disabled={clients === undefined}
            >
              <option value="">
                {clients === undefined
                  ? "Chargement…"
                  : clients.length === 0
                    ? "Aucun client"
                    : "Sélectionner un client"}
              </option>
              {clients?.map((c) => (
                <option key={c.email} value={c.email}>
                  {c.restaurantName} — {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-resto">Restaurant</Label>
              <Input
                id="prov-resto"
                value={form.restaurantName}
                onChange={(e) => set("restaurantName", e.target.value)}
                placeholder="Nom du restaurant"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-city">Ville</Label>
              <Input
                id="prov-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Ville"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-name">Nom du déploiement</Label>
            <Input
              id="prov-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ex. Production — Le Bistrot"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-domain">Domaine</Label>
            <Input
              id="prov-domain"
              className="font-mono"
              value={form.domain}
              onChange={(e) => set("domain", e.target.value)}
              placeholder="lebistrot.fr"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-plan">Plan</Label>
              <Select
                id="prov-plan"
                value={form.plan}
                onChange={(e) =>
                  set("plan", e.target.value as FormState["plan"])
                }
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-region">Région</Label>
              <Select
                id="prov-region"
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Provisioning…
                </>
              ) : (
                <>
                  <Rocket className="size-4" /> Provisionner
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── File de provisioning ── */
function ProvisioningQueue() {
  const queue = useQuery(api.saFleet.list, { status: "provisioning" });

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Loader2 className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          File de provisioning
        </h2>
      </div>

      {queue === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md bg-surface-1 px-3 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" />
          Aucun provisioning en cours.
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.map((d) => (
            <li key={d._id}>
              <Link
                href={`/admin/flotte/${d._id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-1 p-3 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {d.restaurantName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.name} · <span className="font-mono">{d.domain}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatRelative(d.provisionedAt)}
                  </span>
                  <Badge variant="info">Provisioning</Badge>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Checklist go-live ── */
function GoLiveChecklist() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Rocket className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Checklist go-live
        </h2>
      </div>
      <ol className="space-y-3">
        {GO_LIVE_STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {i + 1}. {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ── Ingestion des métriques ── */
function MetricsIngestion() {
  const rows = [
    {
      title: "Ingestion flotte (santé + ventes des instances)",
      detail:
        "Chaque instance déployée pousse ses snapshots de santé et son chiffre d'affaires vers la console.",
    },
    {
      title: "Synchro commerciale (hub web-restaurant)",
      detail:
        "Commandes, abonnements et factures du hub alimentent les vues revenus et clients.",
    },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ServerCog className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ingestion des métriques
        </h2>
      </div>
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-1 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{row.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
            </div>
            <Badge variant="warning" className="shrink-0">
              À câbler au go-live
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── À propos ── */
function AboutCard() {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Info className="size-4 text-muted-foreground" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          À propos
        </h2>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Console superadmin BeInDigital — tour de contrôle des revenus, des
        clients, de la flotte de déploiements, des incidents et de la
        maintenance. Intégrée au site web-restaurant, thème sombre.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Badge variant="muted">web-restaurant</Badge>
        <Badge variant="muted">Thème sombre</Badge>
        <Badge variant="outline">v1.0</Badge>
      </div>
    </Card>
  );
}
