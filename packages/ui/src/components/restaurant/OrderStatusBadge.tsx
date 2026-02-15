import * as React from "react"
import { Badge } from "../Badge"

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled"

export interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  preparing: {
    label: "Preparing",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  ready: {
    label: "Ready",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  delivered: {
    label: "Delivered",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-200",
  },
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  className,
}) => {
  const config = statusConfig[status]

  return (
    <Badge className={`${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  )
}

export { OrderStatusBadge }
