import * as React from "react"
import { ORDER_STATUS_VOCABULARY } from "@be-in-digital/core/status-labels"
import { Badge } from "../Badge"

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"

export interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
  /**
   * The word to print, per status, from the caller's i18n layer.
   *
   * The badge used to hold eight hardcoded English labels and no way past
   * them, while both of its mount points are French storefront screens: a
   * diner following their order read « Preparing » and « Out for Delivery »
   * between French sentences, and the translation layer #148 shipped could
   * not reach them. Storefront callers pass `useOrderStatusLabels()` from
   * `@be-in-digital/restaurant`, which resolves these through `t()` for the
   * locale being rendered.
   *
   * Partial on purpose: a caller that has a word for six statuses supplies
   * six, and the rest fall through to the defaults below.
   */
  labels?: Partial<Record<OrderStatus, string>>
}

/**
 * The colour each status wears, and the word it carries when the caller
 * supplies none.
 *
 * The word comes from `@be-in-digital/core/status-labels` — the one
 * vocabulary the storefront hook translates through — so the untranslated
 * fallback and the translated label can never name different things. It is
 * French, because that is the language this product is written in and the one
 * every translation falls back to. The English strings that used to sit here
 * were not a neutral default; they were eight untranslated words on a French
 * page.
 *
 * The colours stay here: they are this design system's, not the vocabulary's.
 */
const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: ORDER_STATUS_VOCABULARY.pending.label,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  confirmed: {
    label: ORDER_STATUS_VOCABULARY.confirmed.label,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  preparing: {
    label: ORDER_STATUS_VOCABULARY.preparing.label,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  ready: {
    label: ORDER_STATUS_VOCABULARY.ready.label,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  out_for_delivery: {
    label: ORDER_STATUS_VOCABULARY.out_for_delivery.label,
    className: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  delivered: {
    label: ORDER_STATUS_VOCABULARY.delivered.label,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  completed: {
    label: ORDER_STATUS_VOCABULARY.completed.label,
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelled: {
    label: ORDER_STATUS_VOCABULARY.cancelled.label,
    className: "bg-red-100 text-red-800 border-red-200",
  },
}

/**
 * An unrecognised status renders as pending rather than throwing.
 *
 * `orders.status` is a `v.union` of eight literals
 * (packages/convex-schema/src/tables/orders.ts:22), and this component now
 * declares all eight. It used to declare six, and the single caller papered
 * over the gap by folding `out_for_delivery` and `completed` onto `delivered`
 * — which showed a purple "Delivered" badge for an order still in the van,
 * sixteen lines above a label reading "En livraison". The fold is gone.
 *
 * The guard stays for the ninth status somebody adds to the schema later:
 * reading `.className` off `undefined` takes the order page down.
 *
 * Pending is the safe reading of "we do not know what this is": it is the one
 * that does not tell a customer their order is further along than it is.
 */
const UNKNOWN_STATUS_CONFIG = statusConfig.pending

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
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

export { OrderStatusBadge }
