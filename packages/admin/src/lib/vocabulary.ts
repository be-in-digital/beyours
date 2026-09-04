/**
 * Domain vocabulary — the single source of truth for status labels and their
 * visual treatment across the admin.
 *
 * Every page used to redeclare these maps locally, and they drifted (two
 * `statusConfig` twins for orders; a StoreStatus map missing "draft" that
 * shipped a raw english status to the UI). One module, imported everywhere:
 * label drift is now impossible.
 */

import type {
  OrderStatus,
  OrderType,
  OrderPaymentStatus,
  PaymentConnectionStatus,
} from "./types"

export interface StatusBadge {
  label: string
  className: string
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusBadge> = {
  pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
  confirmed: { className: "bg-blue-100 text-blue-800", label: "Confirmée" },
  preparing: { className: "bg-orange-100 text-orange-800", label: "En préparation" },
  ready: { className: "bg-green-100 text-green-800", label: "Prête" },
  out_for_delivery: { className: "bg-purple-100 text-purple-800", label: "En livraison" },
  delivered: { className: "bg-green-100 text-green-800", label: "Livrée" },
  completed: { className: "bg-gray-100 text-gray-800", label: "Terminée" },
  cancelled: { className: "bg-red-100 text-red-800", label: "Annulée" },
}

/**
 * Payment status of an *order*.
 *
 * Was declared inline twice — `orders-table.tsx` and `order-detail-page.tsx`
 * each had their own `paymentConfig` — which is exactly the drift this module
 * exists to prevent. Both now read from here, so a new status is labelled once.
 */
export const ORDER_PAYMENT_STATUS_CONFIG: Record<OrderPaymentStatus, StatusBadge> = {
  pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
  paid: { className: "bg-green-100 text-green-800", label: "Payé" },
  failed: { className: "bg-red-100 text-red-800", label: "Échoué" },
  refunded: { className: "bg-gray-100 text-gray-800", label: "Remboursé" },
  partially_refunded: {
    className: "bg-orange-100 text-orange-800",
    label: "Partiellement remboursé",
  },
  refund_pending: {
    className: "bg-amber-100 text-amber-800",
    label: "Remboursement à effectuer",
  },
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Livraison",
  pickup: "À emporter",
  dine_in: "Sur place",
}

export const ORDER_SOURCE_LABELS: Record<string, string> = {
  website: "Site web",
  uber_eats: "Uber Eats",
  deliveroo: "Deliveroo",
  pos: "Caisse",
}

// ─── Payment connections ────────────────────────────────────────────────────

/**
 * A connection state as the settings screen shows it: a coloured dot, a short
 * label, and — when the state needs explaining — one line telling the owner
 * what it means for their takings.
 */
export interface ConnectionBadge {
  label: string
  /** Tailwind background for the status dot. */
  dotClassName: string
  /** Tailwind colour for the label. */
  textClassName: string
  /** Shown under the badge. Present only where the label alone would mislead. */
  detail?: string
}

/**
 * Status of a *payment provider connection*.
 *
 * `onboarding_complete` is the one that matters. It means the provider account
 * exists and onboarding finished, while the charge path still does not route to
 * it — true of Stripe Connect today, because `convex/stripe.ts` charges on the
 * platform key and never reads the connection row. It is neither a success nor
 * a failure, so it gets amber, its own wording, and a line saying where the
 * money currently goes. Rendering it as "Connecté" is what this map exists to
 * prevent: an owner read a green dot while every euro landed elsewhere.
 */
export const PAYMENT_CONNECTION_STATUS_CONFIG: Record<
  PaymentConnectionStatus,
  ConnectionBadge
> = {
  connected: {
    label: "Connecté",
    dotClassName: "bg-green-500",
    textClassName: "text-muted-foreground",
  },
  onboarding_complete: {
    label: "Vérifié, pas encore actif",
    dotClassName: "bg-amber-500",
    textClassName: "text-amber-700",
    detail:
      "Votre compte est vérifié, mais les encaissements ne sont pas encore reversés dessus. Contactez le support avant d'activer le paiement par carte.",
  },
  disconnected: {
    label: "Non connecté",
    dotClassName: "bg-muted-foreground/40",
    textClassName: "text-muted-foreground",
  },
  error: {
    label: "Échec de la connexion",
    dotClassName: "bg-red-500",
    textClassName: "text-red-700",
    detail:
      "L'inscription n'a pas été terminée, les encaissements sont impossibles. Relancez la connexion pour la reprendre.",
  },
}

// ─── Stores ─────────────────────────────────────────────────────────────────

/** Keyed by string: documents can carry statuses newer than local unions. */
export const STORE_STATUS_CONFIG: Record<string, StatusBadge> = {
  draft: { label: "Brouillon", className: "bg-slate-100 text-slate-700" },
  open: { label: "Ouvert", className: "bg-green-100 text-green-800" },
  closed: { label: "Fermé", className: "bg-red-100 text-red-800" },
  temporarily_unavailable: { label: "Indisponible", className: "bg-orange-100 text-orange-800" },
}

// ─── Gamification (prize redemptions) ───────────────────────────────────────

export type RedemptionStatus = "pending" | "claimed" | "redeemed" | "expired" | "cancelled"

export const REDEMPTION_STATUS_CONFIG: Record<RedemptionStatus, StatusBadge> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  claimed: { label: "En attente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  redeemed: { label: "Utilisé", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  expired: { label: "Expiré", className: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "Annulé", className: "bg-red-100 text-red-700 border-red-200" },
}
