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

/**
 * An unrecognised status renders as pending rather than throwing.
 *
 * `orders.status` is a `v.union` of eight literals
 * (packages/convex-schema/src/tables/orders.ts:22); this component declares
 * six. `out_for_delivery` and `completed` reach it only because the single
 * caller folds them onto `delivered` before rendering. Drop that fold, or add
 * a ninth status to the schema, and reading `.className` off `undefined` takes
 * the order page down — the same crash `StoreStatusBadge` and `AllergenBadge`
 * already carry the guard for.
 *
 * Pending is the safe reading of "we do not know what this is": it is the one
 * that does not tell a customer their order is further along than it is.
 */
const UNKNOWN_STATUS_CONFIG = statusConfig.pending

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  className,
}) => {
  // `??` does not catch what an object literal inherits from
  // `Object.prototype`: `statusConfig["constructor"]` is a function, not
  // undefined, and reading `.className` off it renders garbage.
  const config = Object.hasOwn(statusConfig, status)
    ? statusConfig[status]
    : UNKNOWN_STATUS_CONFIG

  return (
    <Badge className={`${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  )
}

export { OrderStatusBadge }
