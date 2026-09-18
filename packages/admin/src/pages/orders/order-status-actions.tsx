"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@be-yours/ui"
import { toast } from "sonner"
import { Clock } from "lucide-react"
import type { OrderStatus } from "../../lib/types"
import { statusTransitions } from "./order-status-transitions"
import type { StatusAction } from "./order-status-transitions"

type OrderStatusActionsProps = {
  orderId: string
  currentStatus: OrderStatus
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
