"use client"

import Link from "next/link"
import { Badge } from "@be-in-digital/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-in-digital/ui"
import { formatPrice, formatOrderNumber, formatDate } from "../../lib/formatters"
import type {
  Order,
  OrderStatus,
  OrderType,
  OrderPaymentStatus,
  BadgeVariant,
} from "../../lib/types"
import { ORDER_STATUS_CONFIG, ORDER_PAYMENT_STATUS_CONFIG } from "../../lib/vocabulary"

type OrdersTableProps = {
  orders: Order[]
  isLoading: boolean
  /**
   * What to say when there is nothing to show.
   *
   * The default reads "Aucune commande trouvée", which is a claim about the
   * establishment's whole history. The list is paginated, so a search that
   * matches nothing on the page loaded so far has found nothing *yet* — and
   * saying otherwise sends an owner looking for an order they were told does
   * not exist.
   */
  emptyMessage?: string
}

/**
 * Get badge variant and label for order status
 */
function getStatusBadge(status: OrderStatus) {
  const config = ORDER_STATUS_CONFIG[status]
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
 * Calculate total items count from order items
 */
function getTotalItems(items: Order["items"]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/**
 * Orders table component
 * Displays orders in a table with columns for key information
 */
export function OrdersTable({ orders, isLoading, emptyMessage }: OrdersTableProps) {
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
        <p className="text-sm text-muted-foreground">{emptyMessage ?? "Aucune commande trouvée."}</p>
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
                  href={`/dashboard/orders/${order._id}`}
                  className="font-medium hover:underline"
                >
                  {formatOrderNumber(order.orderNumber)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`} className="hover:underline">
                  {order.customerInfo.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`}>
                  {getTypeBadge(order.type)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`}>
                  {getTotalItems(order.items)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`} className="font-medium">
                  {formatPrice(order.total)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`}>
                  {getStatusBadge(order.status)}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                <Link href={`/dashboard/orders/${order._id}`}>
                  {getPaymentBadge(order.paymentStatus)}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <Link href={`/dashboard/orders/${order._id}`}>
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
