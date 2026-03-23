"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { formatPrice, formatDate, formatOrderNumber } from "../../lib/formatters"
import { cn } from "../../lib/utils"
import { adminRoutes } from "../../config/admin-routes"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Button,
} from "@beindigital-engine/ui"

type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready"
  | "out_for_delivery" | "delivered" | "completed" | "cancelled"

type OrderType = "delivery" | "pickup" | "dine_in"

interface Order {
  _id: string
  orderNumber: string
  customerInfo: { name: string; email?: string; phone?: string }
  type: OrderType
  status: OrderStatus
  items: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>
  total: number
  createdAt: number
}

interface RecentOrdersTableProps {
  orders: Order[]
}

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  preparing: "bg-violet-500",
  ready: "bg-emerald-500",
  out_for_delivery: "bg-indigo-500",
  delivered: "bg-emerald-600",
  completed: "bg-emerald-600",
  cancelled: "bg-red-500",
}

const statusLabels: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
}

const typeLabels: Record<OrderType, string> = {
  delivery: "Livraison",
  pickup: "À emporter",
  dine_in: "Sur place",
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Commandes récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8 text-sm">
            Aucune commande pour le moment.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Commandes récentes
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-xs h-7">
          <Link href={adminRoutes.orders} className="text-muted-foreground hover:text-foreground">
            Voir tout <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-medium">N° Commande</TableHead>
              <TableHead className="text-[11px] font-medium hidden md:table-cell">Client</TableHead>
              <TableHead className="text-[11px] font-medium hidden md:table-cell">Type</TableHead>
              <TableHead className="text-[11px] font-medium text-right">Total</TableHead>
              <TableHead className="text-[11px] font-medium">Statut</TableHead>
              <TableHead className="text-[11px] font-medium hidden lg:table-cell">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order._id} className="group cursor-pointer">
                <TableCell className="py-3">
                  <Link
                    href={adminRoutes.orderDetail(order._id)}
                    className="text-sm font-medium hover:underline"
                  >
                    {formatOrderNumber(order.orderNumber)}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {order.customerInfo.name}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {typeLabels[order.type]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {formatPrice(order.total)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusColors[order.status])} />
                    <span className="text-xs">{statusLabels[order.status]}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground hidden lg:table-cell text-xs">
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
