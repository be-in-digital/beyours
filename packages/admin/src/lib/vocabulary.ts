/**
 * Domain vocabulary — the single source of truth for status labels and their
 * visual treatment across the admin.
 *
 * Every page used to redeclare these maps locally, and they drifted (two
 * `statusConfig` twins for orders; a StoreStatus map missing "draft" that
 * shipped a raw english status to the UI). One module, imported everywhere:
 * label drift is now impossible.
 */

import type { OrderStatus, OrderType } from "./types"

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
