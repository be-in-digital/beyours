"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { Button, ButtonGroup } from "@beindigital-engine/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@beindigital-engine/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@beindigital-engine/ui"
import { Input, Label } from "@beindigital-engine/ui"
import { toast } from "sonner"
import {
  CheckCircle,
  ChefHat,
  Clock,
  PackageCheck,
  Truck,
  XCircle,
} from "lucide-react"
import type { OrderSource, OrderStatus } from "../../lib/types"

type OrderStatusActionsProps = {
  orderId: string
  currentStatus: OrderStatus
  source: OrderSource
}

type ButtonVariant = "default" | "destructive" | "outline" | "secondary"

interface StatusAction {
  label: string
  nextStatus: OrderStatus
  variant: ButtonVariant
  icon: React.ComponentType<{ className?: string }>
  requiresReason?: boolean
}

// === Cancellation reasons per platform ===

type CancellationReasonOption = {
  code: string
  label: string
}

const UBER_EATS_REASONS: CancellationReasonOption[] = [
  { code: "OUT_OF_ITEMS", label: "Rupture de stock" },
  { code: "KITCHEN_CLOSED", label: "Cuisine fermée" },
  { code: "CUSTOMER_CALLED_TO_CANCEL", label: "Demande du client" },
  { code: "RESTAURANT_TOO_BUSY", label: "Restaurant surchargé" },
  { code: "CANNOT_COMPLETE_CUSTOMER_NOTE", label: "Instructions client impossibles" },
  { code: "OTHER", label: "Autre" },
]

const DELIVEROO_REASONS: CancellationReasonOption[] = [
  { code: "items_out_of_stock", label: "Rupture de stock" },
  { code: "store_busy", label: "Restaurant surchargé" },
  { code: "store_closing", label: "Restaurant en fermeture" },
  { code: "customer_request", label: "Demande du client" },
  { code: "technical_issue", label: "Problème technique" },
  { code: "other", label: "Autre" },
]

const WEBSITE_REASONS: CancellationReasonOption[] = [
  { code: "out_of_stock", label: "Rupture de stock" },
  { code: "store_busy", label: "Restaurant surchargé" },
  { code: "store_closing", label: "Restaurant en fermeture" },
  { code: "customer_request", label: "Demande du client" },
  { code: "duplicate_order", label: "Commande en double" },
  { code: "payment_issue", label: "Problème de paiement" },
  { code: "other", label: "Autre" },
]

function getCancellationReasons(source: OrderSource): CancellationReasonOption[] {
  switch (source) {
    case "uber_eats":
      return UBER_EATS_REASONS
    case "deliveroo":
      return DELIVEROO_REASONS
    default:
      return WEBSITE_REASONS
  }
}

function isOtherReason(code: string): boolean {
  return code.toLowerCase() === "other"
}

function formatCancellationReason(
  code: string,
  label: string,
  details?: string
): string {
  if (details) {
    return `${code}::${label}::${details}`
  }
  return `${code}::${label}`
}

/**
 * Status transition configuration
 * Defines available actions based on current status
 */
const statusTransitions: Record<OrderStatus, StatusAction[]> = {
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
  ],
  out_for_delivery: [
    {
      label: "Marquer comme livrée",
      nextStatus: "delivered",
      variant: "default",
      icon: CheckCircle,
    },
  ],
  // "delivered" auto-completes on the backend, but keep manual action
  // for any legacy orders still in "delivered" status
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

/**
 * Order status actions component
 * Displays buttons for transitioning order status
 */
export function OrderStatusActions({
  orderId,
  currentStatus,
  source,
}: OrderStatusActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedReasonCode, setSelectedReasonCode] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  const updateStatus = useMutation(api?.orders?.updateStatus ?? ("skip" as never))

  const availableActions = statusTransitions[currentStatus]
  const reasons = getCancellationReasons(source)
  const selectedReason = reasons.find((r) => r.code === selectedReasonCode)
  const showCustomInput = selectedReason && isOtherReason(selectedReason.code)

  const isCancelDisabled =
    isLoading ||
    !selectedReasonCode ||
    (showCustomInput && !customReason.trim())

  /**
   * Handle status transition
   */
  const handleStatusChange = async (
    nextStatus: OrderStatus,
    reason?: string
  ) => {
    setIsLoading(true)
    try {
      await updateStatus({
        id: orderId,
        status: nextStatus,
        cancellationReason: reason,
      })

      toast.success("Statut de la commande mis à jour")

      // Reset dialog state
      setShowCancelDialog(false)
      setSelectedReasonCode("")
      setCustomReason("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de la mise à jour du statut: ${message}`)
      console.error("Error updating order status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Handle cancellation confirmation
   */
  const handleCancelConfirm = () => {
    if (!selectedReason) return

    const formattedReason = formatCancellationReason(
      selectedReason.code,
      selectedReason.label,
      showCustomInput ? customReason.trim() : undefined
    )

    handleStatusChange("cancelled", formattedReason)
  }

  /**
   * Handle button click
   */
  const handleActionClick = (action: StatusAction) => {
    if (action.requiresReason) {
      setShowCancelDialog(true)
    } else {
      handleStatusChange(action.nextStatus)
    }
  }

  /**
   * Reset dialog state on close
   */
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedReasonCode("")
      setCustomReason("")
    }
    setShowCancelDialog(open)
  }

  // No actions available for completed or cancelled orders
  if (availableActions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Clock className="size-4 mr-2" />
        <span className="text-sm">Aucune action disponible</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {availableActions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.nextStatus}
              variant={action.variant}
              className="w-full text-sm"
              onClick={() => handleActionClick(action)}
              disabled={isLoading}
            >
              <Icon className="size-4" />
              {action.label}
            </Button>
          )
        })}
      </div>

      {/* Cancellation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la commande</DialogTitle>
            <DialogDescription>
              Sélectionnez un motif d&apos;annulation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motif d&apos;annulation</Label>
              <Select
                value={selectedReasonCode}
                onValueChange={(value) => {
                  setSelectedReasonCode(value)
                  setCustomReason("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un motif..." />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason.code} value={reason.code}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showCustomInput && (
              <div className="space-y-2">
                <Label htmlFor="custom-reason">Précisez le motif</Label>
                <Input
                  id="custom-reason"
                  placeholder="Décrivez le motif d'annulation..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => handleDialogClose(false)}
                disabled={isLoading}
              >
                Fermer
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelConfirm}
                disabled={isCancelDisabled}
              >
                Annuler la commande
              </Button>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
