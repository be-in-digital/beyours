"use client"

import Link from "next/link"
import { formatPrice, formatDate, formatOrderNumber } from "@/lib/admin"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"

type OrderType = "delivery" | "pickup" | "dine_in"

interface Order {
  _id: string
  orderNumber: string
  customerInfo: {
    name: string
    email?: string
    phone?: string
  }
  type: OrderType
  status: OrderStatus
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  total: number
  createdAt: number
}

interface RecentOrdersTableProps {
  orders: Order[]
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const variants: Record<OrderStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "outline", label: "En attente" },
    confirmed: { variant: "default", label: "Confirmée" },
    preparing: { variant: "secondary", label: "En préparation" },
    ready: { variant: "default", label: "Prête" },
    out_for_delivery: { variant: "secondary", label: "En livraison" },
    delivered: { variant: "default", label: "Livrée" },
    completed: { variant: "secondary", label: "Terminée" },
    cancelled: { variant: "destructive", label: "Annulée" },
  }

  const config = variants[status] || variants.pending

  return <Badge variant={config.variant}>{config.label}</Badge>
}

function OrderTypeBadge({ type }: { type: OrderType }) {
  const labels: Record<OrderType, string> = {
    delivery: "Livraison",
    pickup: "À emporter",
    dine_in: "Sur place",
  }

  return <Badge variant="outline">{labels[type]}</Badge>
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Commandes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Aucune commande pour le moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commandes récentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Commande</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Articles</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Statut</TableHead>
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
                <TableCell>{order.customerInfo.name}</TableCell>
                <TableCell>
                  <OrderTypeBadge type={order.type} />
                </TableCell>
                <TableCell className="text-right">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(order.total)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(order.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
