"use client"

import { use, useState } from "react"
import { useQuery, useMutation, useAction } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { formatPrice, formatOrderNumber, formatDate } from "../../lib/formatters"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Button,
} from "@be-in-digital/ui"
import { OrderStatusActions } from "./order-status-actions"
import { UberDirectPanel } from "./uber-direct-panel"
import { ArrowLeft, RotateCcw, Banknote, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { adminRoutes } from "../../config/admin-routes"
import type {
  InvoiceRefusalReason,
  Order,
  OrderStatus,
  OrderType,
  OrderPaymentStatus,
  OrderItem,
  OrderItemOption,
  Payment,
  BadgeVariant,
} from "../../lib/types"
import { hasPermission, type Role } from "@be-in-digital/core"
import {
  ORDER_STATUS_CONFIG,
  ORDER_PAYMENT_STATUS_CONFIG,
  INVOICE_REFUSAL_LABELS,
} from "../../lib/vocabulary"
import { refundControlState } from "../../lib/refund-eligibility"
import { RefundControl } from "../payments/refund-control"
import { useAdminAuthStore } from "../../stores/admin-auth-store"

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>
}

/**
 * Get badge for order status
 */
function getStatusBadge(status: OrderStatus) {
  const config = ORDER_STATUS_CONFIG[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Get badge for order type
 */
function getTypeBadge(type: OrderType) {
  const typeConfig: Record<OrderType, { variant: BadgeVariant; label: string }> = {
    delivery: { variant: "default", label: "Livraison" },
    pickup: { variant: "secondary", label: "À emporter" },
    dine_in: { variant: "outline", label: "Sur place" },
  }

  const config = typeConfig[type]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

/**
 * Get badge for payment status
 *
 * Falls back rather than indexing blind: an order carrying a status newer than
 * this build must not render an empty badge.
 */
function getPaymentBadge(status: OrderPaymentStatus) {
  const config = ORDER_PAYMENT_STATUS_CONFIG[status] ?? {
    className: "bg-gray-100 text-gray-800",
    label: status,
  }
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Inline refund dialog for order detail page
 */
function OrderRefundDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: Payment
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)
  // An action, not a mutation: the refund calls the payment provider before
  // anything is recorded. `payments.refund` was a database-only patch that
  // reported success while the customer was never paid back. It was deleted;
  // this dialog kept calling it, so the button threw on every click.
  const refundPayment = useAction(api?.payments?.refundPayment ?? ("skip" as never))

  const maxRefundAmount = payment.amount - (payment.refundedAmount || 0)
  const [refundAmount, setRefundAmount] = useState(maxRefundAmount)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRefund = async () => {
    if (refundAmount <= 0 || refundAmount > maxRefundAmount) return

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
          </div>

          <div className="space-y-2">
            <Label htmlFor="refundReason">Motif (optionnel)</Label>
            <Textarea
              id="refundReason"
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

/**
 * Order detail page content component
 * Displays comprehensive order information in a two-column layout
 */
export function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const api = useAdminApiStore((s) => s.api)

  const [showRefundDialog, setShowRefundDialog] = useState(false)

  // Convex IDs are long alphanumeric strings — skip query for known sub-routes
  // or values that clearly aren't valid document IDs
  const isValidOrderId = orderId.length > 10 && /^[a-z0-9]+$/i.test(orderId)

  // Fetch order details
  const order = useQuery(
    api?.orders?.getById ?? ("skip" as never),
    isValidOrderId ? { id: orderId } : "skip"
  ) as Order | null | undefined

  // Fetch associated payments
  const globalSettings = useQuery(
    api?.globalSettings?.get ?? ("skip" as never),
    api ? {} : "skip"
  )
  const payments = useQuery(
    api?.payments?.getByOrder ?? ("skip" as never),
    order ? { orderId: order._id } : "skip"
  ) as Payment[] | undefined

  // Find the primary payment (first succeeded or most recent)
  const primaryPayment = payments?.find(
    (p: Payment) =>
      p.status === "succeeded" ||
      p.status === "partially_refunded"
  ) ?? payments?.[0]

  // Check if refund is possible
  /**
   * Cash was offered at checkout and never recorded: no `payments` row was ever
   * written for it, so the order stayed "en attente" for ever and the "Espèces"
   * filter on the payments page could never match. Somebody at the counter has
   * to say the notes arrived.
   */
  const markCashPaid = useMutation(api?.orders?.markCashPaid ?? ("skip" as never))
  const [isMarkingCashPaid, setIsMarkingCashPaid] = useState(false)

  const canMarkCashPaid =
    order?.paymentMethod === "cash" &&
    order?.paymentStatus === "pending" &&
    order?.status !== "cancelled"

  const handleMarkCashPaid = async () => {
    if (!order) return
    setIsMarkingCashPaid(true)
    try {
      await markCashPaid({ orderId: order._id })
      toast.success("Paiement en espèces enregistré")
    } catch (error) {
      toast.error("Échec de l'enregistrement du paiement")
      console.error(error)
    } finally {
      setIsMarkingCashPaid(false)
    }
  }

  // `payments:read` gets a role onto this screen; `payments:refund` is what the
  // server checks on the click. They are not the same set of people.
  const role = useAdminAuthStore((s) => s.role)
  const refund = refundControlState(primaryPayment, role)

  /**
   * The catch-up issuance for a paid order with no invoice and nothing
   * refusing one — an order that settled while `globalSettings.seller` was
   * still incomplete, or before invoicing shipped. The automatic path only
   * runs at settlement, so once the owner completes the identity the backlog
   * would otherwise stay invoiceless for ever, silently (#375).
   * `invoices.issueForOrder` is idempotent and re-checks every refusal
   * server-side; `payments:write` is the permission it enforces.
   */
  const issueInvoice = useMutation(api?.invoices?.issueForOrder ?? ("skip" as never))
  const [isIssuingInvoice, setIsIssuingInvoice] = useState(false)
  // Explicit nulls mean `orders.getById` computed the surface and nothing
  // refuses an invoice; absent fields mean a query that computed nothing.
  const invoiceSurfaceComputed =
    order?.invoiceNumber !== undefined || order?.invoiceRefusal !== undefined
  const invoiceIssuableNow =
    invoiceSurfaceComputed &&
    order?.invoiceNumber == null &&
    order?.invoiceRefusal == null
  const canIssueInvoice = hasPermission(role as Role, "payments:write")

  const handleIssueInvoice = async () => {
    if (!order) return
    setIsIssuingInvoice(true)
    try {
      const result = await issueInvoice({ orderId: order._id })
      if (result?.issued) {
        toast.success(`Facture ${result.number} émise`)
      } else {
        toast.error(
          result?.reason
            ? INVOICE_REFUSAL_LABELS[result.reason as InvoiceRefusalReason]
            : "Émission refusée"
        )
      }
    } catch (error) {
      toast.error("Échec de l'émission de la facture")
      console.error(error)
    } finally {
      setIsIssuingInvoice(false)
    }
  }

  /**
   * Cancelling a paid order leaves the money with the restaurant: the payment
   * rows are untouched and the order parks on `refund_pending`. Nothing else
   * on this page says so — the operator would see a cancelled order and assume
   * the customer had been paid back.
   */
  const awaitingRefund = order?.paymentStatus === "refund_pending"

  if (!isValidOrderId || order === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Commande introuvable.</p>
      </div>
    )
  }

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Chargement des détails de la commande...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={adminRoutes.orders}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            Commande {formatOrderNumber(order.orderNumber)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passée le {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(order.status)}
          {getTypeBadge(order.type)}
        </div>
      </div>

      {/* Refund owed but not yet sent — see `awaitingRefund` above. */}
      {awaitingRefund && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-900">
              Remboursement à effectuer
            </p>
            <p className="text-sm text-amber-800">
              Cette commande a été annulée après paiement. Aucun remboursement n&apos;a
              encore été envoyé au client.
              {!refund.visible &&
                " Effectuez-le depuis le tableau de bord de votre prestataire, ou rendez les espèces au comptoir."}
            </p>
          </div>
          {primaryPayment && (
            <RefundControl state={refund} className="shrink-0">
              <Button
                size="sm"
                disabled={refund.disabled}
                onClick={() => setShowRefundDialog(true)}
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                Rembourser le client
              </Button>
            </RefundControl>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Order items and customer info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Articles de la commande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produit</TableHead>
                    <TableHead className="text-xs text-center">Qté</TableHead>
                    <TableHead className="text-xs text-right">Prix</TableHead>
                    <TableHead className="text-xs text-right">Sous-total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item: OrderItem, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm">
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.selectedOptions.map((opt: OrderItemOption, i: number) => (
                                <div key={i}>
                                  {opt.optionName}: {opt.choiceName}
                                  {opt.priceModifier !== 0 &&
                                    ` (${formatPrice(opt.priceModifier)})`}
                                </div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-xs text-muted-foreground italic mt-1">
                              Note : {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                      <TableCell className="text-sm text-right">
                        {formatPrice(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-medium">
                        {formatPrice(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Order Summary */}
              <div className="mt-6 space-y-2 border-t border-border/50 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">dont TVA</span>
                    <span>{formatPrice(order.taxAmount)}</span>
                  </div>
                )}
                {order.deliveryFee && order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frais de livraison</span>
                    <span>{formatPrice(order.deliveryFee)}</span>
                  </div>
                )}
                {/* The discount was stored on the order and rendered nowhere:
                    neither view added up to the total below. */}
                {order.discountAmount !== undefined && order.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Réduction</span>
                    <span className="text-success">-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold border-t border-border/50 pt-2">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informations client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Nom</div>
                <div className="text-sm font-medium">{order.customerInfo.name}</div>
              </div>
              {order.customerInfo.email && (
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="text-sm font-medium">{order.customerInfo.email}</div>
                </div>
              )}
              {order.customerInfo.phone && (
                <div>
                  <div className="text-xs text-muted-foreground">Téléphone</div>
                  <div className="text-sm font-medium">{order.customerInfo.phone}</div>
                </div>
              )}
              {order.type === "dine_in" && order.tableNumber && (
                <div>
                  <div className="text-xs text-muted-foreground">Table</div>
                  <div className="text-sm font-medium">{order.tableNumber}</div>
                </div>
              )}
              {order.deliveryAddress && (
                <div>
                  <div className="text-xs text-muted-foreground">Adresse de livraison</div>
                  <div className="text-sm font-medium">
                    {order.deliveryAddress.street}
                    <br />
                    {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
                    <br />
                    {order.deliveryAddress.country}
                  </div>
                  {order.deliveryAddress.instructions && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      Instructions : {order.deliveryAddress.instructions}
                    </div>
                  )}
                </div>
              )}
              {order.notes && (
                <div>
                  <div className="text-xs text-muted-foreground">Notes de commande</div>
                  <div className="text-sm font-medium">{order.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Status and payment info */}
        <div className="space-y-6">
          {/* Status Actions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Statut de la commande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusActions orderId={order._id} currentStatus={order.status} />
            </CardContent>
          </Card>

          {/* Uber Direct courier — renders itself away on non-delivery orders */}
          <UberDirectPanel
            api={api}
            orderId={order._id}
            orderType={order.type}
            uberDirectDeliveryId={order.uberDirectDeliveryId}
            uberDirectStatus={order.uberDirectStatus}
            uberDirectTrackingUrl={order.uberDirectTrackingUrl}
            uberDirectFee={order.uberDirectFee}
            uberDirectFailedAt={order.uberDirectFailedAt}
            enabled={
              globalSettings?.integrations?.uberDirect?.enabled === true
            }
          />

          {/* Payment Information */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informations de paiement
              </CardTitle>
              {canMarkCashPaid && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={isMarkingCashPaid}
                  onClick={handleMarkCashPaid}
                >
                  <Banknote className="mr-1.5 h-3 w-3" />
                  Encaisser en espèces
                </Button>
              )}
              {primaryPayment && (
                <RefundControl state={refund}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={refund.disabled}
                    onClick={() => setShowRefundDialog(true)}
                  >
                    <RotateCcw className="mr-1.5 h-3 w-3" />
                    Rembourser
                  </Button>
                </RefundControl>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Statut du paiement</div>
                <div className="mt-1">{getPaymentBadge(order.paymentStatus)}</div>
              </div>
              {order.paymentMethod && (
                <div>
                  <div className="text-xs text-muted-foreground">Moyen de paiement</div>
                  <div className="text-sm font-medium capitalize">{order.paymentMethod}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Source de la commande</div>
                <div className="text-sm font-medium capitalize">{order.source}</div>
              </div>
              {primaryPayment?.refundedAmount && primaryPayment.refundedAmount > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Montant remboursé</div>
                  <div className="text-sm font-medium text-warning">
                    {formatPrice(primaryPayment.refundedAmount, primaryPayment.currency)}
                  </div>
                </div>
              )}
              {primaryPayment?.refundReason && (
                <div>
                  <div className="text-xs text-muted-foreground">Motif du remboursement</div>
                  <div className="text-sm font-medium italic">{primaryPayment.refundReason}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice — the fiscal document, the reason none exists, or the
              catch-up for a backlog order nothing refuses any more. Rendered
              only when `orders.getById` computed the surface: an order read
              through `list`/`recent` says nothing rather than something
              wrong (#375). */}
          {order.paymentStatus === "paid" && invoiceSurfaceComputed && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Facture
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {invoiceIssuableNow ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Aucune facture n&apos;a été émise pour cette commande.
                        Rien ne s&apos;oppose à son émission aujourd&apos;hui.
                      </p>
                      {canIssueInvoice && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={isIssuingInvoice}
                          onClick={handleIssueInvoice}
                        >
                          Générer la facture
                        </Button>
                      )}
                    </div>
                  ) : order.invoiceRefusal != null ? (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Facture non émise</AlertTitle>
                      <AlertDescription>
                        {INVOICE_REFUSAL_LABELS[order.invoiceRefusal]}
                        {order.invoiceRefusal === "seller_incomplete" && (
                          <>
                            {" "}
                            <Link
                              href={`${adminRoutes.settings}?tab=billing`}
                              className="font-medium underline underline-offset-2"
                            >
                              Compléter l&apos;identité de l&apos;établissement
                            </Link>
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div>
                      <div className="text-xs text-muted-foreground">Numéro</div>
                      <div className="text-sm font-medium">{order.invoiceNumber}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Timestamps */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Créée</div>
                <div className="text-sm font-medium">{formatDate(order.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dernière mise à jour</div>
                <div className="text-sm font-medium">{formatDate(order.updatedAt)}</div>
              </div>
              {order.completedAt && (
                <div>
                  <div className="text-xs text-muted-foreground">Terminée</div>
                  <div className="text-sm font-medium">{formatDate(order.completedAt)}</div>
                </div>
              )}
              {order.cancelledAt && (
                <div>
                  <div className="text-xs text-muted-foreground">Annulée</div>
                  <div className="text-sm font-medium">{formatDate(order.cancelledAt)}</div>
                </div>
              )}
              {order.cancellationReason && (
                <div>
                  <div className="text-xs text-muted-foreground">Motif d&apos;annulation</div>
                  <div className="text-sm font-medium">{order.cancellationReason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Refund Dialog */}
      {primaryPayment && (
        <OrderRefundDialog
          payment={primaryPayment}
          open={showRefundDialog}
          onOpenChange={setShowRefundDialog}
        />
      )}
    </div>
  )
}
