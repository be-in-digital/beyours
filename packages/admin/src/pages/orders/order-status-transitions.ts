/**
 * Which actions the admin UI offers for each order status.
 *
 * Kept React-free and separate from the component so it can be checked against
 * the status machine in `@be-yours/convex-schema`. The UI may offer fewer
 * transitions than the server allows — never more, or the button writes a state
 * `updateStatus` refuses.
 *
 * « Annuler la commande » reaches `preparing`, `ready` and `out_for_delivery`
 * since #111. Until then the only cancellation was on `pending`, so a diner who
 * telephoned while the kitchen was cooking could not be recorded at all and the
 * staff's only recourse was to complete an order that never happened.
 *
 * It is offered on a MARKETPLACE order too, and `updateStatus` refuses that one
 * with a sentence naming the platform — deliberately, because the alternative is
 * hiding the button and leaving the operator with no explanation of why an order
 * they can see cannot be cancelled. The refusal tells them where to go instead.
 */

import type { ComponentType } from "react"
import { CheckCircle, ChefHat, PackageCheck, Truck, XCircle } from "lucide-react"

import type { OrderStatus } from "../../lib/types"

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary"

export interface StatusAction {
  label: string
  nextStatus: OrderStatus
  variant: ButtonVariant
  icon: ComponentType<{ className?: string }>
  requiresReason?: boolean
}

/**
 * Status transition configuration
 * Defines available actions based on current status
 */
export const statusTransitions: Record<OrderStatus, StatusAction[]> = {
  pending: [
    {
      label: "Accepter la commande",
      nextStatus: "confirmed",
      variant: "default",
      icon: CheckCircle,
    },
    {
      label: "Refuser la commande",
      nextStatus: "cancelled",
      variant: "destructive",
      icon: XCircle,
      requiresReason: true,
    },
  ],
  confirmed: [
    {
      label: "Commencer la préparation",
      nextStatus: "preparing",
      variant: "default",
      icon: ChefHat,
    },
  ],
  preparing: [
    {
      label: "Marquer comme prête",
      nextStatus: "ready",
      variant: "default",
      icon: PackageCheck,
    },
    {
      label: "Annuler la commande",
      nextStatus: "cancelled",
      variant: "destructive",
      icon: XCircle,
      requiresReason: true,
    },
  ],
  ready: [
    {
      label: "Terminer la commande",
      nextStatus: "completed",
      variant: "default",
      icon: CheckCircle,
    },
    {
      label: "Envoyer en livraison",
      nextStatus: "out_for_delivery",
      variant: "secondary",
      icon: Truck,
    },
    {
      label: "Annuler la commande",
      nextStatus: "cancelled",
      variant: "destructive",
      icon: XCircle,
      requiresReason: true,
    },
  ],
  out_for_delivery: [
    {
      label: "Marquer comme livrée",
      nextStatus: "delivered",
      variant: "default",
      icon: CheckCircle,
    },
    {
      label: "Annuler la commande",
      nextStatus: "cancelled",
      variant: "destructive",
      icon: XCircle,
      requiresReason: true,
    },
  ],
  delivered: [
    {
      label: "Terminer la commande",
      nextStatus: "completed",
      variant: "default",
      icon: CheckCircle,
    },
  ],
  completed: [],
  cancelled: [],
}
