"use client"

/**
 * Uber Direct — the courier panel on an order
 *
 * Booking a courier costs money and dispatches a person, so every control here
 * states what it will do before it does it, and nothing fires twice: the book
 * button disappears once a delivery exists, and the action itself is idempotent
 * on the order.
 */

import { useState } from "react"
import { useAction } from "convex/react"
import { toast } from "sonner"
import { Truck, ExternalLink, AlertTriangle, Loader2, X } from "lucide-react"

/** Courier status, in the order Uber sends it. */
const STATUS_LABELS: Record<string, { label: string; tone: "idle" | "live" | "done" | "failed" }> = {
  SCHEDULED: { label: "Coursier assigné", tone: "idle" },
  EN_ROUTE_TO_PICKUP: { label: "En route vers le restaurant", tone: "live" },
  ARRIVED_AT_PICKUP: { label: "Arrivé au restaurant", tone: "live" },
  EN_ROUTE_TO_DROPOFF: { label: "En route vers le client", tone: "live" },
  ARRIVED_AT_DROPOFF: { label: "Arrivé chez le client", tone: "live" },
  COMPLETED: { label: "Livré", tone: "done" },
  FAILED: { label: "Échec de la livraison", tone: "failed" },
}

const TONE_CLASSES: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  live: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
}

export interface UberDirectPanelProps {
  orderId: string
  orderType?: string
  /** Convex api object, injected by the host app. */
  api: any
  uberDirectDeliveryId?: string
  uberDirectStatus?: string
  uberDirectTrackingUrl?: string
  uberDirectFee?: number
  uberDirectFailedAt?: number
  /** True when the restaurant has configured its Uber Direct credentials. */
  enabled: boolean
}

export function UberDirectPanel({
  orderId,
  orderType,
  api,
  uberDirectDeliveryId,
  uberDirectStatus,
  uberDirectTrackingUrl,
  uberDirectFee,
  uberDirectFailedAt,
  enabled,
}: UberDirectPanelProps) {
  const [isBooking, setIsBooking] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const createDelivery = useAction(api?.uberDirect?.createDelivery ?? ("skip" as never))
  const cancelDelivery = useAction(api?.uberDirect?.cancelDelivery ?? ("skip" as never))

  // A courier only makes sense on a delivery order.
  if (orderType !== "delivery") return null
  if (!enabled && !uberDirectDeliveryId) return null

  const status = uberDirectStatus ? STATUS_LABELS[uberDirectStatus] : undefined
  const isTerminal =
    uberDirectStatus === "COMPLETED" || uberDirectStatus === "FAILED"

  const handleBook = async () => {
    setIsBooking(true)
    try {
      const result = await createDelivery({ orderId })
      toast.success(
        result.alreadyBooked
          ? "Un coursier était déjà réservé pour cette commande."
          : "Coursier réservé."
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      // The payload builder names its failures; surface the actionable ones.
      if (message.includes("MISSING_CUSTOMER_PHONE")) {
        toast.error(
          "Uber Direct exige un numéro de téléphone client pour remettre la commande."
        )
      } else if (message.includes("MISSING_DELIVERY_ADDRESS")) {
        toast.error("Cette commande n'a pas d'adresse de livraison.")
      } else if (message.includes("NO_QUOTE")) {
        toast.error(
          "Aucun devis sur cette commande. Elle a été passée avant l'activation d'Uber Direct."
        )
      } else if (message.includes("QUOTE_EXPIRED")) {
        toast.error(
          "Le devis a expiré ou l'adresse est hors zone. Il faut refaire un devis."
        )
      } else if (message.includes("UBER_DIRECT_DISABLED")) {
        toast.error("Uber Direct n'est pas activé dans vos réglages.")
      } else {
        toast.error("La réservation du coursier a échoué.")
      }
    } finally {
      setIsBooking(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const result = await cancelDelivery({ orderId })
      toast.success(
        result.cancelled
          ? "Course annulée."
          : "La course était déjà terminée chez Uber, rien à annuler."
      )
      setConfirmCancel(false)
    } catch {
      toast.error("L'annulation a échoué.")
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="h-4 w-4" />
          Livraison Uber Direct
        </h3>
        {status && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[status.tone]}`}
          >
            {status.label}
          </span>
        )}
      </div>

      {uberDirectFailedAt && (
        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            La course a échoué et la commande reste en cours de livraison. Elle
            ne peut pas être annulée automatiquement : contactez le client, puis
            réservez un nouveau coursier ou livrez vous-même.
          </p>
        </div>
      )}

      {uberDirectFee !== undefined && (
        <p className="text-sm text-muted-foreground">
          Coût de la course :{" "}
          <span className="font-medium text-foreground tabular-nums">
            {(uberDirectFee / 100).toFixed(2)} €
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!uberDirectDeliveryId && (
          <button
            type="button"
            onClick={handleBook}
            disabled={isBooking}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isBooking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            Réserver un coursier
          </button>
        )}

        {uberDirectTrackingUrl && (
          <a
            href={uberDirectTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Suivre la course
          </a>
        )}

        {uberDirectDeliveryId && !isTerminal && !confirmCancel && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
            Annuler la course
          </button>
        )}

        {confirmCancel && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Annuler la course ? La commande, elle, reste ouverte.
            </span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
