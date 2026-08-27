"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex/react"
import {
  Card,
  CardContent,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@be-in-digital/ui"
import { RotateCcw, ExternalLink } from "lucide-react"
import { RefundDialog } from "./refund-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { formatPrice, formatDate } from "../../lib/formatters"
import type {
  Payment,
  PaymentStatus,
  PaymentProvider,
  BadgeVariant,
} from "../../lib/types"
import { ResolvingStore } from "../../components/resolving-store"

const STATUS_CONFIG: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "En attente", variant: "secondary" },
  processing: { label: "En cours", variant: "outline" },
  succeeded: { label: "Réussi", variant: "default" },
  failed: { label: "Échoué", variant: "destructive" },
  refunded: { label: "Remboursé", variant: "secondary" },
  partially_refunded: { label: "Partiellement remboursé", variant: "outline" },
}

const PROVIDER_CONFIG: Record<PaymentProvider, { label: string; color: string }> = {
  stripe: { label: "Stripe", color: "bg-purple-100 text-purple-800" },
  sumup: { label: "SumUp", color: "bg-blue-100 text-blue-800" },
  paypal: { label: "PayPal", color: "bg-sky-100 text-sky-800" },
  square: { label: "Square", color: "bg-gray-100 text-gray-800" },
  cash: { label: "Espèces", color: "bg-green-100 text-green-800" },
}

interface PaymentsPageProps {
  embedded?: boolean
}

export function PaymentsPage({ embedded = false }: PaymentsPageProps) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  const storeId = useAdminStoreId()
  const payments = useQuery(
    api?.payments?.getByStore ?? ("skip" as never),
    storeId ? { storeId } : "skip"
  ) as Payment[] | undefined

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [refundingPayment, setRefundingPayment] = useState<Payment | null>(null)

  const filteredPayments = useMemo(() => {
    if (!payments) return null

    let filtered = payments

    if (statusFilter !== "all") {
      filtered = filtered.filter((p: Payment) => p.status === statusFilter)
    }

    if (providerFilter !== "all") {
      filtered = filtered.filter((p: Payment) => p.provider === providerFilter)
    }

    return filtered
  }, [payments, statusFilter, providerFilter])

  if (!storeId) return <ResolvingStore />

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Paiements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Consultez les transactions et gérez les remboursements.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Statut :</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="processing">En cours</SelectItem>
              <SelectItem value="succeeded">Réussi</SelectItem>
              <SelectItem value="failed">Échoué</SelectItem>
              <SelectItem value="refunded">Remboursé</SelectItem>
              <SelectItem value="partially_refunded">Partiellement remboursé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Fournisseur :</label>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="sumup">SumUp</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="cash">Espèces</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payments table */}
      {!filteredPayments ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Aucun paiement trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Date</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">N° commande</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Montant</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Fournisseur</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Statut</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Détails</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground/60 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment: Payment) => {
                const canRefund =
                  payment.status === "succeeded" &&
                  payment.provider !== "cash" &&
                  (payment.refundedAmount || 0) < payment.amount

                return (
                  <TableRow key={payment._id}>
                    <TableCell className="text-xs">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.orderId.slice(-8)}
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">
                      {formatPrice(payment.amount, payment.currency)}
                      {payment.refundedAmount && payment.refundedAmount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Remboursé : {formatPrice(payment.refundedAmount, payment.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${PROVIDER_CONFIG[payment.provider]?.color || ""}`}
                      >
                        {PROVIDER_CONFIG[payment.provider]?.label || payment.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[payment.status]?.variant || "outline"} className="text-xs">
                        {STATUS_CONFIG[payment.status]?.label || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payment.metadata?.brand && payment.metadata?.last4 && (
                        <div>{payment.metadata.brand} •••• {payment.metadata.last4}</div>
                      )}
                      {payment.externalId && (
                        <div className="font-mono text-[10px]">{payment.externalId.slice(0, 16)}...</div>
                      )}
                      {payment.refundReason && (
                        <div className="text-[10px] italic">Motif : {payment.refundReason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payment.metadata?.receiptUrl && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                            <a href={payment.metadata.receiptUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        {canRefund && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setRefundingPayment(payment)}
                          >
                            <RotateCcw className="mr-1.5 h-3 w-3" />
                            Rembourser
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
