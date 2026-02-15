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

const StoreStatusBadge: React.FC<StoreStatusBadgeProps> = ({
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

export { StoreStatusBadge }
