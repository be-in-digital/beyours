/**
 * Stats utilities
 *
 * Atomic stat increments for campaigns/automations.
 * Subscriber metadata incremental update after each order.
 */

export type StatField =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed"
  | "converted"

export interface CampaignStats {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  unsubscribed: number
  converted: number
  revenue: number
}

export interface SubscriberMetadata {
  language?: string
  city?: string
  totalOrders: number
  totalSpent: number
  lastOrderAt?: number
  averageOrderValue: number
  favoriteProducts: string[]
  orderTypes: string[]
}

export interface OrderForMetadata {
  amount: number // in cents
  type: string
  productIds: string[]
  orderedAt: number
}

/**
 * Return a new stats object with a single field incremented.
 * Does not mutate the original.
 */
export function incrementCampaignStats(
  current: CampaignStats,
  field: StatField,
  amount = 1
): CampaignStats {
  return {
    ...current,
    [field]: current[field] + amount,
  }
}

/**
 * REMOVED: `incrementRevenueStat`.
 *
 * The pure half of the `incrementRevenue` removal. #397 deleted the Convex
 * mutation that patched `stats.revenue` and `stats.converted`, and left a
 * tombstone in `packages/convex-functions/src/emailCampaigns.ts` explaining
 * why: nothing in the product writes a `converted` email event and no order
 * carries the campaign that led to it, so the attribution a "revenu attribué"
 * figure is made of does not exist in this schema. This function computed the
 * same `{ revenue + amount, converted + 1 }` shape for a caller that was
 * removed on the other side of the package boundary, and had none of its own.
 *
 * As there, `CampaignStats.revenue` and `.converted` stay: existing rows carry
 * them, and wiring a real producer later means adding the producer.
 */

/**
 * Compute derived metrics from raw stats.
 */
export function computeStatRates(stats: CampaignStats): {
  openRate: number
  clickRate: number
  bounceRate: number
  unsubscribeRate: number
} {
  const base = stats.delivered || 1
  return {
    openRate: Math.round((stats.opened / base) * 100 * 10) / 10,
    clickRate: Math.round((stats.clicked / base) * 100 * 10) / 10,
    bounceRate: Math.round((stats.bounced / base) * 100 * 10) / 10,
    unsubscribeRate: Math.round((stats.unsubscribed / base) * 100 * 10) / 10,
  }
}

/**
 * Incrementally update subscriber metadata after a confirmed order.
 * Does not mutate the original.
 */
export function calculateSubscriberMetadata(
  current: SubscriberMetadata,
  order: OrderForMetadata
): SubscriberMetadata {
  const newTotalOrders = current.totalOrders + 1
  const newTotalSpent = current.totalSpent + order.amount
  const newAvg = Math.round(newTotalSpent / newTotalOrders)

  const orderTypes = current.orderTypes.includes(order.type)
    ? current.orderTypes
    : [...current.orderTypes, order.type]

  // Merge product IDs, keep last 10 (most recent first)
  const merged = [...new Set([...order.productIds, ...current.favoriteProducts])].slice(0, 10)

  return {
    ...current,
    totalOrders: newTotalOrders,
    totalSpent: newTotalSpent,
    lastOrderAt: order.orderedAt,
    averageOrderValue: newAvg,
    favoriteProducts: merged,
    orderTypes,
  }
}
