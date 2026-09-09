"use client"

import { useState } from "react"
import { usePaginatedQuery } from "convex/react"
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
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import { refundControlState } from "../../lib/refund-eligibility"
import { RefundControl } from "./refund-control"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { PAYMENT_STATUS_LABELS } from "../../lib/vocabulary"

/* The badge VARIANT is this table's, the label is not.
 *
 * `lib/vocabulary.ts` owns every status word an operator reads, and this file
 * spelled six of them out again — four of which it shares with the order
 * payment statuses declared there. They agreed; a copy that agrees is the one
 * that drifts on the next status added. A shadcn variant is a styling decision
 * about this table and stays here. */
const STATUS_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  pending: "secondary",
  processing: "outline",
  succeeded: "default",
  failed: "destructive",
  refunded: "secondary",
  partially_refunded: "outline",
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; variant: BadgeVariant }> =
  Object.fromEntries(
    (Object.keys(STATUS_VARIANT) as PaymentStatus[]).map((status) => [
      status,
      { label: PAYMENT_STATUS_LABELS[status]!, variant: STATUS_VARIANT[status] },
    ]),
  ) as Record<PaymentStatus, { label: string; variant: BadgeVariant }>

const PROVIDER_CONFIG: Record<PaymentProvider, { label: string; color: string }> = {
  stripe: { label: "Stripe", color: "bg-purple-100 text-purple-800" },
  sumup: { label: "SumUp", color: "bg-blue-100 text-blue-800" },
  paypal: { label: "PayPal", color: "bg-sky-100 text-sky-800" },
  /* Kept: a payment row can only carry a provider the schema allows, and
     "square" is one of them. Nothing writes such a row today, but a badge
     that renders "undefined" for a row that does exist is worse than one
     that is never used. The matching filter option was removed — Square is
     announced as forthcoming in Paramètres, and a filter over past
     payments that can never match anything is not an announcement. */
  square: { label: "Square", color: "bg-gray-100 text-gray-800" },
  cash: { label: "Espèces", color: "bg-green-100 text-green-800" },
}

/**
 * The two guards, then the ledger.
 *
 * `usePaginatedQuery` needs a real function reference on its very first render
 * and `api` is injected by the admin layout a render later, so the query lives
 * in a child that is not mounted until there is something to query with — the
 * same shape `MessagesPage` uses, and for the same reason.
 */
export function PaymentsPage() {
  const api = useAdminApiStore((s) => s.api)
  const storeId = useAdminStoreId()

  if (!storeId || !api) return <ResolvingStore />

  return <PaymentsLedger api={api} storeId={storeId} />
}

function PaymentsLedger({
  api,
  storeId,
}: {
  // The Convex API is injected at runtime and has no static type here.
  api: any
  storeId: string
}) {
  // `payments:read` gets a role onto this screen; `payments:refund` is what the
  // server checks on the click. They are not the same set of people.
  const role = useAdminAuthStore((s) => s.role)

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [providerFilter, setProviderFilter] = useState<string>("all")
  const [refundingPayment, setRefundingPayment] = useState<Payment | null>(null)

  /**
   * Both filters go to the server.
   *
   * They used to be applied here, over every payment the establishment had ever
   * taken — the screen downloaded the whole ledger on every load and narrowed it
   * in the browser. Narrowing after the read saves nothing: the read is the
   * cost, and past ~16k rows Convex refuses the transaction outright. Each
   * filter is an equality the schema now indexes, so a page of fifteen reads
   * fifteen rows whether the store took a hundred payments or a hundred
   * thousand.
   */
  const { results, status, loadMore } = usePaginatedQuery(
    api.payments.getByStore,
    {
      storeId,
      ...(statusFilter === "all" ? {} : { status: statusFilter }),
      ...(providerFilter === "all" ? {} : { provider: providerFilter }),
    },
    { initialNumItems: ADMIN_PAGE_SIZE }
  )

  const filteredPayments = status === "LoadingFirstPage" ? null : (results as Payment[])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Paiements</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Consultez les transactions et gérez les remboursements.
        </p>
      </div>

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
              {(Object.keys(STATUS_VARIANT) as PaymentStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_CONFIG[status].label}
                </SelectItem>
              ))}
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
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">Date</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">N° commande</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">Montant</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">Fournisseur</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">Statut</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground">Détails</TableHead>
                <TableHead className="text-[11px] uppercase tracking-widest text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment: Payment) => {
                const refund = refundControlState(payment, role)

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
                        <RefundControl state={refund}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={refund.disabled}
                            onClick={() => setRefundingPayment(payment)}
                          >
                            <RotateCcw className="mr-1.5 h-3 w-3" />
                            Rembourser
                          </Button>
                        </RefundControl>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(ADMIN_PAGE_SIZE)}
          >
            {status === "LoadingMore" ? "Chargement…" : "Charger plus"}
          </Button>
        </div>
      ) : null}

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
