"use client"

import { use, useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { formatPrice, formatOrderNumber, formatDate } from "../../lib/formatters"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@be-in-digital/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-in-digital/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@be-in-digital/ui"
import { Input, Label, Textarea } from "@be-in-digital/ui"
import { OrderStatusActions } from "./order-status-actions"
import { UberDirectPanel } from "./uber-direct-panel"
import { ArrowLeft, RotateCcw } from "lucide-react"
import { Button } from "@be-in-digital/ui"
import { toast } from "sonner"
import Link from "next/link"
import { adminRoutes } from "../../config/admin-routes"
import type {
  Order,
  OrderStatus,
  OrderType,
  OrderPaymentStatus,
  OrderItem,
  OrderItemOption,
  Payment,
  BadgeVariant,
} from "../../lib/types"
import { ORDER_STATUS_CONFIG } from "../../lib/vocabulary"

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
 */
function getPaymentBadge(status: OrderPaymentStatus) {
  const paymentConfig: Record<OrderPaymentStatus, { className: string; label: string }> = {
    pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
    paid: { className: "bg-green-100 text-green-800", label: "Payé" },
    failed: { className: "bg-red-100 text-red-800", label: "Échoué" },
    refunded: { className: "bg-gray-100 text-gray-800", label: "Remboursé" },
    partially_refunded: { className: "bg-orange-100 text-orange-800", label: "Partiellement remboursé" },
  }

  const config = paymentConfig[status]
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
  const refundMutation = useMutation(api?.payments?.refund ?? ("skip" as never))

  const maxRefundAmount = payment.amount - (payment.refundedAmount || 0)
  const [refundAmount, setRefundAmount] = useState(maxRefundAmount)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRefund = async () => {
    if (refundAmount <= 0 || refundAmount > maxRefundAmount) return

    setIsSubmitting(true)
    try {
      await refundMutation({
        id: payment._id,
        amount: refundAmount,
        reason: reason.trim() || undefined,
      })

      toast.success(
        `Remboursement de ${formatPrice(refundAmount, payment.currency)} traité avec succès`
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
  const canRefund = primaryPayment
    ? primaryPayment.status === "succeeded" &&
      primaryPayment.provider !== "cash" &&
      (primaryPayment.refundedAmount || 0) < primaryPayment.amount
    : false

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
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatPrice(order.taxAmount)}</span>
                  </div>
                )}
                {order.deliveryFee && order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frais de livraison</span>
                    <span>{formatPrice(order.deliveryFee)}</span>
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
              {canRefund && primaryPayment && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowRefundDialog(true)}
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Rembourser
                </Button>
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
                  <div className="text-sm font-medium text-orange-600">
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
