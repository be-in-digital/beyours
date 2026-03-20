/**
 * Kitchen Service
 *
 * Pure business logic functions for kitchen operations
 * No side effects, no Convex calls - operates on data only
 */

import type {
  OrderDoc,
  OrderItem,
  KitchenTicketInput,
  KitchenTicketItem,
  KitchenTicketPriority,
  KitchenTicketStatus,
} from '../types'

/**
 * Create kitchen ticket from order
 */
export const createTicketFromOrder = (order: OrderDoc, storeId: string): KitchenTicketInput => {
  // Convert order items to kitchen ticket items
  const items: KitchenTicketItem[] = order.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    options: item.selectedOptions.map((opt) => `${opt.optionName}: ${opt.choiceName}`),
    notes: item.notes,
  }))

  // Determine priority
  const priority = getPriorityLevel(order)

  return {
    storeId,
    orderId: order._id,
    station: undefined, // Can be set based on item categories
    priority,
    items,
    orderNumber: order.orderNumber,
    orderType: order.type,
    source: order.source,
    estimatedPrepTime: order.estimatedPrepTime,
  }
}

/**
 * Assign items to stations based on product categories
 */
export const assignStation = (
  items: OrderItem[],
  stationMapping: Record<string, string>
): Record<string, OrderItem[]> => {
  const stations: Record<string, OrderItem[]> = {}

  items.forEach((item) => {
    // Determine station from mapping (based on productId or category)
    const station = stationMapping[item.productId] ?? 'general'

    if (!stations[station]) {
      stations[station] = []
    }

    stations[station].push(item)
  })

  return stations
}

/**
 * Get priority level for order
 */
export const getPriorityLevel = (order: OrderDoc): KitchenTicketPriority => {
  // VIP: delivery orders from external platforms
  if (order.source === 'uber_eats' || order.source === 'deliveroo') {
    return 'vip'
  }

  // Urgent: delivery orders or scheduled orders
  if (order.type === 'delivery' || order.scheduledFor) {
    return 'urgent'
  }

  // Normal: pickup and dine-in
  return 'normal'
}

/**
 * Get color for kitchen ticket status
 */
export const getTicketColor = (status: KitchenTicketStatus): string => {
  const colorMap: Record<KitchenTicketStatus, string> = {
    pending: 'bg-yellow-100 border-yellow-400',
    in_progress: 'bg-blue-100 border-blue-400',
    ready: 'bg-green-100 border-green-400',
    completed: 'bg-gray-100 border-gray-400',
  }

  return colorMap[status] || 'bg-gray-100 border-gray-400'
}

/**
 * Calculate elapsed time since ticket creation
 * Returns minutes
 */
export const calculateElapsedTime = (createdAt: number): number => {
  const now = Date.now()
  const elapsed = now - createdAt
  return Math.floor(elapsed / 1000 / 60) // Convert to minutes
}

/**
 * Check if ticket is overdue
 */
export const isOverdue = (createdAt: number, maxPrepTime: number): boolean => {
  const elapsed = calculateElapsedTime(createdAt)
  return elapsed > maxPrepTime
}
