"use client"

import { Badge } from "@be-in-digital/ui"
import { cn } from "../lib/utils"

type Status =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "paid"
  | "unpaid"
  | "refunded"
  | "active"
  | "inactive"
  | "draft"

interface StatusBadgeProps {
  status: Status
  className?: string
}

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40",
  preparing: "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  cancelled: "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40",
  unpaid: "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/40",
  refunded: "bg-gray-50 text-gray-600 border-gray-200/60 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800/40",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40",
  inactive: "bg-gray-50 text-gray-600 border-gray-200/60 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800/40",
  draft: "bg-gray-50 text-gray-600 border-gray-200/60 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800/40",
}

/**
 * Minimal status badge with subtle border
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border px-2 py-0.5",
        statusStyles[status] ?? statusStyles.draft,
        className,
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
