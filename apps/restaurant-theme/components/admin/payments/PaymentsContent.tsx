"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAdminStoreId } from "@/lib/admin/hooks"
import { formatPrice, formatDate } from "@/lib/admin/formatters"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RefundDialog } from "./RefundDialog"
import { RotateCcw, ExternalLink } from "lucide-react"

type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded" | "partially_refunded"
type PaymentProvider = "stripe" | "sumup" | "paypal" | "square" | "cash"

interface Payment {
  _id: Id<"payments">
  storeId: Id<"stores">
  orderId: Id<"orders">
  amount: number
  currency: string
  provider: PaymentProvider
  status: PaymentStatus
  externalId?: string
  refundedAmount?: number
  refundReason?: string
  metadata?: {
    last4?: string
    brand?: string
    receiptUrl?: string
  }
  createdAt: number
  updatedAt: number
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "outline" },
  succeeded: { label: "Succeeded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "secondary" },
  partially_refunded: { label: "Partially Refunded", variant: "outline" },
}

const PROVIDER_CONFIG: Record<PaymentProvider, { label: string; color: string }> = {
  stripe: { label: "Stripe", color: "bg-purple-100 text-purple-800" },
  sumup: { label: "SumUp", color: "bg-blue-100 text-blue-800" },
  paypal: { label: "PayPal", color: "bg-sky-100 text-sky-800" },
  square: { label: "Square", color: "bg-gray-100 text-gray-800" },
  cash: { label: "Cash", color: "bg-green-100 text-green-800" },
}

interface PaymentsContentProps {
  /** When true, hides the page header for embedded usage within tabs */
  embedded?: boolean
}

export function PaymentsContent({ embedded = false }: PaymentsContentProps) {
  const storeId = useAdminStoreId()
  const payments = useQuery(
    api.payments.getByStore,
    storeId ? { storeId } : "skip"
  )

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [refundingPayment, setRefundingPayment] = useState<Payment | null>(null)

  // Filter payments
  const filteredPayments = useMemo(() => {
    if (!payments) return null

    let filtered = payments

    if (statusFilter !== "all") {
      filtered = filtered.filter((p: any) => p.status === statusFilter)
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter((p: any) => p.provider === providerFilter)
    }

    return filtered
  }, [payments, statusFilter, providerFilter])

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">Please select a store</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payments</h1>
            <p className="text-muted-foreground mt-2">
              View payment transactions and manage refunds.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Status:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="partially_refunded">Partially Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Provider:</label>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="sumup">SumUp</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payments table */}
      {!filteredPayments ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No payments found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment: any) => {
                const canRefund =
                  payment.status === "succeeded" &&
                  payment.provider !== "cash" &&
                  (payment.refundedAmount || 0) < payment.amount

                return (
                  <TableRow key={payment._id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.createdAt)}
                    </TableCell>

                    <TableCell className="font-mono text-sm">
                      {payment.orderId.slice(-8)}
                    </TableCell>

                    <TableCell className="font-semibold">
                      {formatPrice(payment.amount, payment.currency)}
                      {payment.refundedAmount && payment.refundedAmount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Refunded: {formatPrice(payment.refundedAmount, payment.currency)}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={PROVIDER_CONFIG[payment.provider as PaymentProvider].color}
                      >
                        {PROVIDER_CONFIG[payment.provider as PaymentProvider].label}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={STATUS_CONFIG[payment.status as PaymentStatus].variant}>
                        {STATUS_CONFIG[payment.status as PaymentStatus].label}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {payment.metadata?.brand && payment.metadata?.last4 && (
                        <div>{payment.metadata.brand} •••• {payment.metadata.last4}</div>
                      )}
                      {payment.externalId && (
                        <div className="font-mono text-xs">{payment.externalId.slice(0, 16)}...</div>
                      )}
                      {payment.refundReason && (
                        <div className="text-xs italic">Reason: {payment.refundReason}</div>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {payment.metadata?.receiptUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={payment.metadata.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}

                        {canRefund && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRefundingPayment(payment)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Refund
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Refund dialog */}
      {refundingPayment && (
        <RefundDialog
          payment={refundingPayment}
          open={!!refundingPayment}
          onOpenChange={(open) => !open && setRefundingPayment(null)}
        />
      )}
    </div>
  )
}
