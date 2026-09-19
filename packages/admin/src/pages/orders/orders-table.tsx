"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { MouseEvent } from "react"
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-yours/ui"
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
  // Before the early returns: a hook may not sit behind a conditional.
  const router = useRouter()

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

  /*
   * A click anywhere on the row opens that order (#533).
   *
   * The row has always carried `cursor-pointer`, and only the TEXT in each cell
   * was a link — so a click on the cell padding, on the gap after a short badge,
   * or anywhere in the row's blank width did nothing. The pointer promised a
   * navigation the click did not perform, which is worse than a row that never
   * claimed to be clickable.
   *
   * BOTH, NOT EITHER. The anchors are what make a row reachable by keyboard,
   * middle-clickable and openable in a new tab, and a handler substitutes for
   * none of that. The handler is what covers the area no anchor can reach: the
   * cell padding belongs to the table, not to the cell's content.
   *
   * So the handler stands aside whenever the click already landed on something
   * that navigates by itself — otherwise the anchor and the push would both
   * fire, leaving a duplicate history entry and a « retour » that needs pressing
   * twice.
   */
  const openRow = (event: MouseEvent<HTMLTableRowElement>, orderId: string) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("a, button, input, select, textarea, [role='button']")) return
    router.push(`/dashboard/orders/${orderId}`)
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
            <TableRow
              key={order._id}
              className="cursor-pointer"
              onClick={(event) => openRow(event, order._id)}
            >
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
