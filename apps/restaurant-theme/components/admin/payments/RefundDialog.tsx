"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatPrice } from "@/lib/admin/formatters"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Payment {
  _id: Id<"payments">
  amount: number
  currency: string
  refundedAmount?: number
}

interface RefundDialogProps {
  payment: Payment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RefundDialog({ payment, open, onOpenChange }: RefundDialogProps) {
  const refundMutation = useMutation(api.payments.refund)

  const maxRefundAmount = payment.amount - (payment.refundedAmount || 0)
  const [refundAmount, setRefundAmount] = useState(maxRefundAmount)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRefund = async () => {
    // Validate amount
    if (refundAmount <= 0) {
      toast.error("Refund amount must be greater than 0")
      return
    }

    if (refundAmount > maxRefundAmount) {
      toast.error(
        `Refund amount cannot exceed ${formatPrice(maxRefundAmount, payment.currency)}`
      )
      return
    }

    setIsSubmitting(true)

    try {
      await refundMutation({
        id: payment._id,
        amount: refundAmount,
        reason: reason.trim() || undefined,
      })

      toast.success(
        `Refund of ${formatPrice(refundAmount, payment.currency)} processed successfully`
      )
      onOpenChange(false)

      // Reset form
      setRefundAmount(maxRefundAmount)
      setReason("")
    } catch (error) {
      toast.error("Failed to process refund")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Convert cents to display value
  const amountInDollars = (refundAmount / 100).toFixed(2)

  // Handle amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      // Convert dollars to cents
      setRefundAmount(Math.round(value * 100))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund Payment</DialogTitle>
          <DialogDescription>
            Process a full or partial refund for this payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original amount info */}
          <div className="text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original amount:</span>
              <span className="font-medium">
                {formatPrice(payment.amount, payment.currency)}
              </span>
            </div>
            {payment.refundedAmount && payment.refundedAmount > 0 && (
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Already refunded:</span>
                <span className="font-medium">
                  {formatPrice(payment.refundedAmount, payment.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between mt-1 border-t pt-1">
              <span className="text-muted-foreground">Max refund:</span>
              <span className="font-semibold">
                {formatPrice(maxRefundAmount, payment.currency)}
              </span>
            </div>
          </div>

          {/* Refund amount input */}
          <div className="space-y-2">
            <Label htmlFor="refundAmount">Refund Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {payment.currency === "EUR" ? "€" : "$"}
              </span>
              <Input
                id="refundAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={(maxRefundAmount / 100).toFixed(2)}
                value={amountInDollars}
                onChange={handleAmountChange}
                className="pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the amount to refund (max: {formatPrice(maxRefundAmount, payment.currency)})
            </p>
          </div>

          {/* Reason textarea */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this refund..."
              rows={3}
            />
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundAmount(maxRefundAmount)}
            >
              Full Refund
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefundAmount(Math.round(maxRefundAmount / 2))}
            >
              Half Refund
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={isSubmitting || refundAmount <= 0 || refundAmount > maxRefundAmount}
          >
            {isSubmitting
              ? "Processing..."
              : `Refund ${formatPrice(refundAmount, payment.currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
