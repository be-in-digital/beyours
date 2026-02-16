"use client"

import { use } from "react"
import { useQuery } from "convex/react"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { formatPrice, formatOrderNumber, formatDate } from "../../lib/formatters"
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@beindigital-engine/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@beindigital-engine/ui"
import { OrderStatusActions } from "./order-status-actions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@beindigital-engine/ui"
import Link from "next/link"

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>
}

/**
 * Get badge for order status
 */
function getStatusBadge(
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "completed"
    | "cancelled"
) {
  const statusConfig = {
    pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
    confirmed: { className: "bg-blue-100 text-blue-800", label: "Confirmée" },
    preparing: { className: "bg-orange-100 text-orange-800", label: "En préparation" },
    ready: { className: "bg-green-100 text-green-800", label: "Prête" },
    out_for_delivery: { className: "bg-purple-100 text-purple-800", label: "En livraison" },
    delivered: { className: "bg-green-100 text-green-800", label: "Livrée" },
    completed: { className: "bg-gray-100 text-gray-800", label: "Terminée" },
    cancelled: { className: "bg-red-100 text-red-800", label: "Annulée" },
  }

  const config = statusConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Get badge for order type
 */
function getTypeBadge(type: "delivery" | "pickup" | "dine_in") {
  const typeConfig = {
    delivery: { variant: "default" as const, label: "Livraison" },
    pickup: { variant: "secondary" as const, label: "À emporter" },
    dine_in: { variant: "outline" as const, label: "Sur place" },
  }

  const config = typeConfig[type]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

/**
 * Get badge for payment status
 */
function getPaymentBadge(status: "pending" | "paid" | "failed" | "refunded") {
  const paymentConfig = {
    pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
    paid: { className: "bg-green-100 text-green-800", label: "Payé" },
    failed: { className: "bg-red-100 text-red-800", label: "Échoué" },
    refunded: { className: "bg-gray-100 text-gray-800", label: "Remboursé" },
  }

  const config = paymentConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Order detail page content component
 * Displays comprehensive order information in a two-column layout
 */
export function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = use(params)
  const api = useAdminApiStore((s) => s.api) as Record<string, any> | null

  // Fetch order details
  const order = useQuery(
    api?.orders?.getById ?? ("skip" as any),
    { id: orderId }
  )

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Chargement des détails de la commande...</p>
      </div>
    )
  }

  if (order === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Commande introuvable.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/orders">
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
                  {order.items.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm">
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {item.selectedOptions.map((opt: any, i: number) => (
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

          {/* Payment Information */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informations de paiement
              </CardTitle>
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
                  <div className="text-xs text-muted-foreground">Motif d'annulation</div>
                  <div className="text-sm font-medium">{order.cancellationReason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
