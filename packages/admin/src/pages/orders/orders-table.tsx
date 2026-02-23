"use client"

import Link from "next/link"
import { Badge } from "@beindigital-engine/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@beindigital-engine/ui"
import { formatPrice, formatOrderNumber, formatDate } from "../../lib/formatters"
import type {
  Order,
  OrderStatus,
  OrderType,
  OrderPaymentStatus,
  OrderSource,
  BadgeVariant,
} from "../../lib/types"

type OrdersTableProps = {
  orders: Order[]
  isLoading: boolean
}

/**
 * Get badge variant and label for order status
 */
function getStatusBadge(status: OrderStatus) {
  const statusConfig: Record<OrderStatus, { className: string; label: string }> = {
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
 * Get badge variant and label for order type
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
 * Get badge variant and label for payment status
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
 * Get badge for order source
 */
function getSourceBadge(source: OrderSource) {
  const sourceConfig: Record<OrderSource, { className: string; label: string }> = {
    website: { className: "bg-blue-50 text-blue-700", label: "Site web" },
    uber_eats: { className: "bg-green-50 text-green-700", label: "Uber Eats" },
    deliveroo: { className: "bg-cyan-50 text-cyan-700", label: "Deliveroo" },
    pos: { className: "bg-slate-50 text-slate-700", label: "Caisse" },
  }

  const config = sourceConfig[source]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Calculate total items count from order items
 */
function getTotalItems(items: Order["items"]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Orders table component
 * Displays orders in a table with columns for key information
 */
export function OrdersTable({ orders, isLoading }: OrdersTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Chargement des commandes...</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Aucune commande trouvée.</p>
      </div>
    )
  }

  return (
    <div className="border border-border/50 rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">N° Commande</TableHead>
            <TableHead className="text-xs">Client</TableHead>
            <TableHead className="text-xs">Source</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Articles</TableHead>
            <TableHead className="text-xs">Total</TableHead>
            <TableHead className="text-xs">Statut</TableHead>
            <TableHead className="text-xs">Paiement</TableHead>
            <TableHead className="text-xs">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order._id} className="cursor-pointer">
              <TableCell className="text-sm">
                <Link
                  href={`/orders/${order._id}`}
                  className="font-medium hover:underline"
                >
                  {formatOrderNumber(order.orderNumber)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`} className="hover:underline">
                  {order.customerInfo.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`}>
                  {getSourceBadge(order.source)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`}>
                  {getTypeBadge(order.type)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`}>
                  {getTotalItems(order.items)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`} className="font-medium">
                  {formatPrice(order.total)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`}>
                  {getStatusBadge(order.status)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/orders/${order._id}`}>
                  {getPaymentBadge(order.paymentStatus)}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <Link href={`/orders/${order._id}`}>
                  {formatDate(order.createdAt)}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
