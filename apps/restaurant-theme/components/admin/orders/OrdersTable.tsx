"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPrice, formatOrderNumber, formatDate } from "@/lib/admin/formatters"
import type { Id } from "@/convex/_generated/dataModel"

/**
 * Order type definition
 */
type Order = {
  _id: Id<"orders">
  orderNumber: string
  customerInfo: {
    name: string
    email?: string
    phone?: string
  }
  type: "delivery" | "pickup" | "dine_in"
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "completed"
    | "cancelled"
  items: Array<{
    productId: Id<"products">
    productName: string
    quantity: number
    unitPrice: number
    selectedOptions?: Array<{
      optionId: string
      optionName: string
      choiceId: string
      choiceName: string
      priceModifier: number
    }>
    subtotal: number
    notes?: string
  }>
  total: number
  paymentMethod?: string
  paymentStatus: "pending" | "paid" | "failed" | "refunded"
  createdAt: number
}

type OrdersTableProps = {
  orders: Order[]
  isLoading: boolean
}

/**
 * Get badge variant and label for order status
 */
function getStatusBadge(status: Order["status"]) {
  const statusConfig: Record<
    Order["status"],
    { className: string; label: string }
  > = {
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
function getTypeBadge(type: Order["type"]) {
  const typeConfig: Record<Order["type"], { variant: "default" | "secondary" | "outline"; label: string }> = {
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
function getPaymentBadge(status: Order["paymentStatus"]) {
  const paymentConfig: Record<
    Order["paymentStatus"],
    { className: string; label: string }
  > = {
    pending: { className: "bg-yellow-100 text-yellow-800", label: "En attente" },
    paid: { className: "bg-green-100 text-green-800", label: "Payé" },
    failed: { className: "bg-red-100 text-red-800", label: "Échoué" },
    refunded: { className: "bg-gray-100 text-gray-800", label: "Remboursé" },
  }

  const config = paymentConfig[status]
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
        <p className="text-muted-foreground">Chargement des commandes...</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Aucune commande trouvée.</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Commande</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Articles</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Paiement</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order._id} className="cursor-pointer">
              <TableCell>
                <Link
                  href={`/orders/${order._id}`}
                  className="font-medium hover:underline"
                >
                  {formatOrderNumber(order.orderNumber)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`} className="hover:underline">
                  {order.customerInfo.name}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`}>
                  {getTypeBadge(order.type)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`}>
                  {getTotalItems(order.items)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`} className="font-medium">
                  {formatPrice(order.total)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`}>
                  {getStatusBadge(order.status)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/orders/${order._id}`}>
                  {getPaymentBadge(order.paymentStatus)}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
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
