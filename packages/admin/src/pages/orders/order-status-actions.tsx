"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { Button, ButtonGroup } from "@be-in-digital/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@be-in-digital/ui"
import { Input, Label } from "@be-in-digital/ui"
import { toast } from "sonner"
import {
  CheckCircle,
  ChefHat,
  Clock,
  PackageCheck,
  Truck,
  XCircle,
} from "lucide-react"
import type { OrderStatus } from "../../lib/types"

type OrderStatusActionsProps = {
  orderId: string
  currentStatus: OrderStatus
}

type ButtonVariant = "default" | "destructive" | "outline" | "secondary"

interface StatusAction {
  label: string
  nextStatus: OrderStatus
  variant: ButtonVariant
  icon: React.ComponentType<{ className?: string }>
  requiresReason?: boolean
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
}: OrderStatusActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  const updateStatus = useMutation(api?.orders?.updateStatus ?? ("skip" as never))

  const availableActions = statusTransitions[currentStatus]

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
      setCancellationReason("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de la mise à jour du statut: ${message}`)
      console.error("Error updating order status:", error)
    } finally {
      setIsLoading(false)
    }
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
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la commande</DialogTitle>
            <DialogDescription>
              Veuillez fournir un motif d&apos;annulation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reason">Motif d&apos;annulation</Label>
            <Input
              id="reason"
              placeholder="ex : Rupture de stock, Demande du client..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <ButtonGroup>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setCancellationReason("")
                }}
                disabled={isLoading}
              >
                Fermer
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleStatusChange("cancelled", cancellationReason)}
                disabled={isLoading || !cancellationReason.trim()}
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
