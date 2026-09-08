import * as React from "react";
import { Badge, type BadgeProps } from "@/components/admin/ui/badge";
import { cn } from "@/lib/utils";

type Variant = NonNullable<BadgeProps["variant"]>;
type Meta = { label: string; variant: Variant };

/* ── Status vocabulary — single source of truth for colours/labels ── */

export const CLIENT_STATUS: Record<string, Meta> = {
  prospect: { label: "Prospect", variant: "info" },
  onboarding: { label: "Onboarding", variant: "warning" },
  active: { label: "Actif", variant: "success" },
  paused: { label: "En pause", variant: "muted" },
  churned: { label: "Résilié", variant: "danger" },
};

export const DEPLOYMENT_STATUS: Record<string, Meta> = {
  provisioning: { label: "Provisioning", variant: "info" },
  staging: { label: "Staging", variant: "muted" },
  live: { label: "En ligne", variant: "success" },
  degraded: { label: "Dégradé", variant: "warning" },
  suspended: { label: "Suspendu", variant: "muted" },
  offboarded: { label: "Sorti", variant: "danger" },
};

export const HEALTH: Record<string, Meta> = {
  healthy: { label: "Sain", variant: "success" },
  degraded: { label: "Dégradé", variant: "warning" },
  down: { label: "Down", variant: "danger" },
  unknown: { label: "Inconnu", variant: "muted" },
};

export const INCIDENT_STATUS: Record<string, Meta> = {
  open: { label: "Ouvert", variant: "danger" },
  investigating: { label: "Investigation", variant: "warning" },
  identified: { label: "Identifié", variant: "warning" },
  monitoring: { label: "Sous surveillance", variant: "info" },
  resolved: { label: "Résolu", variant: "success" },
};

export const SEVERITY: Record<string, Meta> = {
  sev1: { label: "SEV1", variant: "danger" },
  sev2: { label: "SEV2", variant: "warning" },
  sev3: { label: "SEV3", variant: "info" },
  sev4: { label: "SEV4", variant: "muted" },
};

export const RENEWAL_STATUS: Record<string, Meta> = {
  active: { label: "Actif", variant: "success" },
  expiring_soon: { label: "Bientôt dû", variant: "warning" },
  past_due: { label: "En retard", variant: "danger" },
  canceled: { label: "Annulé", variant: "muted" },
  expired: { label: "Expiré", variant: "danger" },
};

export const MAINTENANCE_STATUS: Record<string, Meta> = {
  none: { label: "Aucune", variant: "muted" },
  active: { label: "Active", variant: "success" },
  expiring_soon: { label: "Expire bientôt", variant: "warning" },
  expired: { label: "Expirée", variant: "danger" },
};

export const INTEGRATION_STATUS: Record<string, Meta> = {
  connected: { label: "Connecté", variant: "success" },
  disconnected: { label: "Déconnecté", variant: "muted" },
  error: { label: "Erreur", variant: "danger" },
  not_configured: { label: "Non configuré", variant: "muted" },
};

export const INVOICE_STATUS: Record<string, Meta> = {
  draft: { label: "Brouillon", variant: "muted" },
  open: { label: "À payer", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  void: { label: "Annulée", variant: "muted" },
  overdue: { label: "En retard", variant: "danger" },
  uncollectible: { label: "Irrécouvrable", variant: "danger" },
};

export const INTEGRATION_LABEL: Record<string, string> = {
  stripe: "Stripe",
  sumup: "SumUp",
  paypal: "PayPal",
  square: "Square",
  uber_eats: "Uber Eats",
  deliveroo: "Deliveroo",
  uber_direct: "Uber Direct",
  ses: "AWS SES",
};

export const AREA_LABEL: Record<string, string> = {
  payments: "Paiements",
  orders: "Commandes",
  kitchen: "Cuisine",
  integrations: "Intégrations",
  site: "Site",
  delivery: "Livraison",
  auth: "Auth",
  other: "Autre",
};

export const ORDER_STATUS: Record<string, Meta> = {
  pending: { label: "En attente", variant: "warning" },
  paid: { label: "Payée", variant: "success" },
  failed: { label: "Échouée", variant: "danger" },
  cancelled: { label: "Annulée", variant: "muted" },
};

export const SUBSCRIPTION_STATUS: Record<string, Meta> = {
  active: { label: "Actif", variant: "success" },
  past_due: { label: "En retard", variant: "danger" },
  canceled: { label: "Annulé", variant: "muted" },
  unpaid: { label: "Impayé", variant: "danger" },
  incomplete: { label: "Incomplet", variant: "warning" },
};

export const REFERRAL_STATUS: Record<string, Meta> = {
  pending: { label: "En attente", variant: "warning" },
  validated: { label: "Validé", variant: "info" },
  payable: { label: "À verser", variant: "primary" },
  /* Claimed by a payout run, transfer not yet confirmed. #384 added it to the
     schema and to the affiliate's own totals and gave it no label here, so
     `badgeFrom`'s fallback rendered the raw English literal `paying` in a grey
     "unknown" badge, in a French console, for the whole window in which a
     commission is in flight (#411). `referral-status-vocabulary.test.ts` now
     fails a build over the next one. */
  paying: { label: "Versement en cours", variant: "info" },
  paid: { label: "Payé", variant: "success" },
  cancelled: { label: "Annulé", variant: "muted" },
  blocked: { label: "Bloqué", variant: "danger" },
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  creation: "Création",
  maintenance: "Maintenance",
};

/* ── Composants ── */

function badgeFrom(map: Record<string, Meta>, value: string, className?: string) {
  const meta = map[value] ?? { label: value, variant: "muted" as Variant };
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export const StatusBadge = ({
  map,
  value,
  className,
}: {
  map: Record<string, Meta>;
  value: string;
  className?: string;
}) => badgeFrom(map, value, className);

const DOT_COLOR: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  down: "bg-danger",
  unknown: "bg-muted-foreground",
};

export function HealthDot({
  health,
  className,
}: {
  health: string;
  className?: string;
}) {
  const live = health === "down" || health === "degraded";
  return (
    <span className={cn("relative inline-flex", className)}>
      <span
        className={cn(
          "relative inline-block size-2.5 rounded-full",
          DOT_COLOR[health] ?? "bg-muted-foreground",
          live && "live-dot",
        )}
        style={
          live
            ? { color: health === "down" ? "var(--danger)" : "var(--warning)" }
            : undefined
        }
      />
    </span>
  );
}
