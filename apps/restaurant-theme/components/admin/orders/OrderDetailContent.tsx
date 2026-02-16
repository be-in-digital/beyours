"use client"

import { use } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatPrice, formatOrderNumber, formatDate } from "@/lib/admin/formatters"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { OrderStatusActions } from "./OrderStatusActions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

type OrderDetailContentProps = {
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
    pending: { className: "bg-yellow-100 text-yellow-800", label: "Pending" },
    confirmed: { className: "bg-blue-100 text-blue-800", label: "Confirmed" },
    preparing: { className: "bg-orange-100 text-orange-800", label: "Preparing" },
    ready: { className: "bg-green-100 text-green-800", label: "Ready" },
    out_for_delivery: { className: "bg-purple-100 text-purple-800", label: "Out for Delivery" },
    delivered: { className: "bg-green-100 text-green-800", label: "Delivered" },
    completed: { className: "bg-gray-100 text-gray-800", label: "Completed" },
    cancelled: { className: "bg-red-100 text-red-800", label: "Cancelled" },
  }

  const config = statusConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Get badge for order type
 */
function getTypeBadge(type: "delivery" | "pickup" | "dine_in") {
  const typeConfig = {
    delivery: { variant: "default" as const, label: "Delivery" },
    pickup: { variant: "secondary" as const, label: "Pickup" },
    dine_in: { variant: "outline" as const, label: "Dine In" },
  }

  const config = typeConfig[type]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

/**
 * Get badge for payment status
 */
function getPaymentBadge(status: "pending" | "paid" | "failed" | "refunded") {
  const paymentConfig = {
    pending: { className: "bg-yellow-100 text-yellow-800", label: "Pending" },
    paid: { className: "bg-green-100 text-green-800", label: "Paid" },
    failed: { className: "bg-red-100 text-red-800", label: "Failed" },
    refunded: { className: "bg-gray-100 text-gray-800", label: "Refunded" },
  }

  const config = paymentConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}

/**
 * Order detail page content component
 * Displays comprehensive order information in a two-column layout
 */
export function OrderDetailContent({ params }: OrderDetailContentProps) {
  const { orderId } = use(params)

  // Fetch order details
  const order = useQuery(api.orders.getById, {
    id: orderId as Id<"orders">,
  })

  if (order === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading order details...</p>
      </div>
    )
  }

  if (order === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Order not found.</p>
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
          <h1 className="text-3xl font-bold">
            Order {formatOrderNumber(order.orderNumber)}
          </h1>
          <p className="text-muted-foreground mt-1">
            Placed {formatDate(order.createdAt)}
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
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
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
                            <div className="text-sm text-muted-foreground italic mt-1">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Order Summary */}
              <div className="mt-6 space-y-2 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatPrice(order.taxAmount)}</span>
                  </div>
                )}
                {order.deliveryFee && order.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatPrice(order.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Name</div>
                <div className="font-medium">{order.customerInfo.name}</div>
              </div>
              {order.customerInfo.email && (
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{order.customerInfo.email}</div>
                </div>
              )}
              {order.customerInfo.phone && (
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{order.customerInfo.phone}</div>
                </div>
              )}
              {order.deliveryAddress && (
                <div>
                  <div className="text-sm text-muted-foreground">Delivery Address</div>
                  <div className="font-medium">
                    {order.deliveryAddress.street}
                    <br />
                    {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
                    <br />
                    {order.deliveryAddress.country}
                  </div>
                  {order.deliveryAddress.instructions && (
                    <div className="text-sm text-muted-foreground italic mt-1">
                      Instructions: {order.deliveryAddress.instructions}
                    </div>
                  )}
                </div>
              )}
              {order.notes && (
                <div>
                  <div className="text-sm text-muted-foreground">Order Notes</div>
                  <div className="font-medium">{order.notes}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Status and payment info */}
        <div className="space-y-6">
          {/* Status Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusActions orderId={order._id} currentStatus={order.status} />
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Payment Status</div>
                <div className="mt-1">{getPaymentBadge(order.paymentStatus)}</div>
              </div>
              {order.paymentMethod && (
                <div>
                  <div className="text-sm text-muted-foreground">Payment Method</div>
                  <div className="font-medium capitalize">{order.paymentMethod}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground">Order Source</div>
                <div className="font-medium capitalize">{order.source}</div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Created</div>
                <div className="font-medium">{formatDate(order.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Updated</div>
                <div className="font-medium">{formatDate(order.updatedAt)}</div>
              </div>
              {order.completedAt && (
                <div>
                  <div className="text-muted-foreground">Completed</div>
                  <div className="font-medium">{formatDate(order.completedAt)}</div>
                </div>
              )}
              {order.cancelledAt && (
                <div>
                  <div className="text-muted-foreground">Cancelled</div>
                  <div className="font-medium">{formatDate(order.cancelledAt)}</div>
                </div>
              )}
              {order.cancellationReason && (
                <div>
                  <div className="text-muted-foreground">Cancellation Reason</div>
                  <div className="font-medium">{order.cancellationReason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
