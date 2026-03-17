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
 * Return a new stats object with revenue and converted incremented.
 */
export function incrementRevenueStat(
  current: CampaignStats,
  revenueAmount: number
): CampaignStats {
  return {
    ...current,
    revenue: current.revenue + revenueAmount,
    converted: current.converted + 1,
  }
}

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
