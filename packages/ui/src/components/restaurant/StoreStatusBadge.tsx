import * as React from "react"
import { STORE_STATUS_VOCABULARY } from "@be-yours/core/status-labels"
import { Badge } from "../Badge"

export type StoreStatus = "open" | "closed" | "temporarily_unavailable"

export interface StoreStatusBadgeProps {
  status: StoreStatus
  className?: string
  /**
   * The word to print, per status, from the caller's i18n layer.
   *
   * Three hardcoded English labels used to be the only thing this badge could
   * say, on a store selector written entirely in French: a diner picking a
   * location read « Temporarily Unavailable » under a French heading.
   * Storefront callers pass `useStoreStatusLabels()` from
   * `@be-yours/restaurant`, which resolves these through `t()` for the
   * locale being rendered.
   */
  labels?: Partial<Record<StoreStatus, string>>
}

/**
 * The colour each status wears, and the word it carries when the caller
 * supplies none — from the same shared vocabulary the storefront hook
 * translates through, for the same reason as `OrderStatusBadge`.
 */
const statusConfig: Record<
  StoreStatus,
  { label: string; className: string }
> = {
  open: {
    label: STORE_STATUS_VOCABULARY.open.label,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  closed: {
    label: STORE_STATUS_VOCABULARY.closed.label,
    className: "bg-red-100 text-red-800 border-red-200",
  },
  temporarily_unavailable: {
    label: STORE_STATUS_VOCABULARY.temporarily_unavailable.label,
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
  labels,
}) => {
  // `??` does not catch what an object literal inherits from
  // `Object.prototype`: `statusConfig["constructor"]` is a function, not
  // undefined, and reading `.className` off it renders garbage.
  const known = Object.hasOwn(statusConfig, status)
  const config = known ? statusConfig[status] : UNKNOWN_STATUS_CONFIG

  // Same reasoning for the override map, which comes from outside this
  // package: only an own key of a known status may replace the default, and
  // an empty string is not a label.
  const override =
    known && labels && Object.hasOwn(labels, status) ? labels[status] : undefined
  const label = override?.trim() ? override : config.label

  return (
    <Badge className={`${config.className} ${className || ""}`}>{label}</Badge>
  )
}

export { StoreStatusBadge }
