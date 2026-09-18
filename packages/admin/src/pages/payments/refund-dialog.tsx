"use client"

import { useState } from "react"
import { useAction } from "convex/react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Textarea,
  Label,
  Input,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { formatPrice } from "../../lib/formatters"
import type { Payment } from "../../lib/types"

interface RefundDialogProps {
  payment: Payment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefundDialog({ payment, open, onOpenChange }: RefundDialogProps) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  // An action, not a mutation: the refund calls the payment provider before
  // anything is recorded. `payments.refund` was a database-only patch that
  // reported success while the customer was never paid back.
  const refundPayment = useAction(api?.payments?.refundPayment ?? ("skip" as never))

  const maxRefundAmount = payment.amount - (payment.refundedAmount || 0)
  const [refundAmount, setRefundAmount] = useState(maxRefundAmount)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRefund = async () => {
    if (refundAmount <= 0) {
      toast.error("Le montant du remboursement doit être supérieur à 0")
      return
    }

    if (refundAmount > maxRefundAmount) {
      toast.error(
        `Le montant du remboursement ne peut pas dépasser ${formatPrice(maxRefundAmount, payment.currency)}`
      )
      return
    }

    setIsSubmitting(true)

    try {
      await refundPayment({
        id: payment._id,
        amount: refundAmount,
        reason: reason.trim() || undefined,
      })

      toast.success(
        payment.provider === "cash"
          ? `Remboursement de ${formatPrice(refundAmount, payment.currency)} enregistré (espèces, à remettre au client)`
          : `Remboursement de ${formatPrice(refundAmount, payment.currency)} confirmé par ${payment.provider}`
      )
      onOpenChange(false)
      setRefundAmount(maxRefundAmount)
      setReason("")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec du remboursement: ${message}`)
      console.error("Refund error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const amountInUnits = (refundAmount / 100).toFixed(2)

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      setRefundAmount(Math.round(value * 100))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remboursement</DialogTitle>
          <DialogDescription>
            Effectuez un remboursement total ou partiel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant initial :</span>
              <span className="font-medium tabular-nums">
                {formatPrice(payment.amount, payment.currency)}
              </span>
            </div>
            {payment.refundedAmount && payment.refundedAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Déjà remboursé :</span>
                <span className="font-medium tabular-nums">
                  {formatPrice(payment.refundedAmount, payment.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">Remboursement max :</span>
              <span className="font-semibold tabular-nums">
                {formatPrice(maxRefundAmount, payment.currency)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refundAmount">Montant du remboursement</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {payment.currency === "EUR" ? "€" : "$"}
              </span>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={(maxRefundAmount / 100).toFixed(2)}
                value={amountInUnits}
                onChange={handleAmountChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Max : {formatPrice(maxRefundAmount, payment.currency)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Saisissez le motif du remboursement..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundAmount(maxRefundAmount)}
            >
              Total
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundAmount(Math.round(maxRefundAmount / 2))}
            >
              50%
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleRefund}
            disabled={isSubmitting || refundAmount <= 0 || refundAmount > maxRefundAmount}
          >
            {isSubmitting
              ? "Traitement..."
              : `Rembourser ${formatPrice(refundAmount, payment.currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
