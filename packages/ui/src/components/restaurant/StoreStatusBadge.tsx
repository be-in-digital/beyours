import * as React from "react"
import { Badge } from "../Badge"

export type StoreStatus = "open" | "closed" | "temporarily_unavailable"

export interface StoreStatusBadgeProps {
  status: StoreStatus
  className?: string
}

const statusConfig: Record<
  StoreStatus,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  closed: {
    label: "Closed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  temporarily_unavailable: {
    label: "Temporarily Unavailable",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
}

/**
 * An unrecognised status renders as closed rather than throwing.
 *
 * The prop type only admits the three published statuses, but the value comes
 * out of a database: a `draft` establishment, or a status added to the schema
 * later, reaches this component as a string TypeScript never saw. Reading
 * `.className` off the resulting `undefined` took down the whole storefront —
 * a blank page, not a wrong badge.
 *
 * Closed is the safe reading of "we do not know what this is": it is the one
 * that does not tell a customer the place is taking orders.
 */
const UNKNOWN_STATUS_CONFIG = statusConfig.closed

const StoreStatusBadge: React.FC<StoreStatusBadgeProps> = ({
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

export { StoreStatusBadge }
