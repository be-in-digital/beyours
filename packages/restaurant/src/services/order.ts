/**
 * Order Service
 *
 * Pure business logic functions for order operations
 * No side effects, no Convex calls - operates on data only
 */

import type { OrderStatus, CartItem } from '../types'
import {
  canTransitionOrderStatus,
  getNextOrderStatuses,
} from '@be-in-digital/convex-schema'

/**
 * Get valid next statuses from current status
 *
 * Delegates to the status machine in `@be-in-digital/convex-schema`. This file
 * used to carry its own copy of the table, which had drifted from the one the
 * admin UI applies — `ready` could not be sent out for delivery here while the
 * UI offered exactly that button.
 */
export const getNextStatus = (currentStatus: OrderStatus): OrderStatus[] => {
  return [...getNextOrderStatuses(currentStatus)]
}

/**
 * Check if status transition is valid
 */
export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean => {
  return canTransitionOrderStatus(from, to)
}

/**
 * Estimate preparation time based on cart items
 * Returns estimated minutes
 */
export const estimatePreparationTime = (items: CartItem[]): number => {
  // Default prep time per item type (in minutes)
  const DEFAULT_PREP_TIME = 5

  // Calculate total prep time (max prep time of all items, not sum)
  // In reality, kitchen prepares items in parallel
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  // Base time + time per item
  const baseTime = 10
  const itemTime = totalItems * DEFAULT_PREP_TIME

  // Cap at 60 minutes max
  return Math.min(baseTime + itemTime, 60)
}

/**
 * Format order number for display
 */
export const formatOrderNumber = (orderNumber: string): string => {
  // If order number is numeric, format as #0001
  if (/^\d+$/.test(orderNumber)) {
    return `#${orderNumber.padStart(4, '0')}`
  }
  return orderNumber
}

/**
 * Get Tailwind color class for order status
 */
export const getOrderStatusColor = (status: OrderStatus): string => {
  const colorMap: Record<OrderStatus, string> = {
    pending: 'text-yellow-600 bg-yellow-50',
    confirmed: 'text-blue-600 bg-blue-50',
    preparing: 'text-purple-600 bg-purple-50',
    ready: 'text-green-600 bg-green-50',
    out_for_delivery: 'text-indigo-600 bg-indigo-50',
    delivered: 'text-green-600 bg-green-50',
    completed: 'text-gray-600 bg-gray-50',
    cancelled: 'text-red-600 bg-red-50',
  }

  return colorMap[status] || 'text-gray-600 bg-gray-50'
}

/**
 * Get human-readable label for order status
 */
export const getOrderStatusLabel = (status: OrderStatus): string => {
  const labelMap: Record<OrderStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }

  return labelMap[status] || status
}

/**
 * Check if order is still active (not completed or cancelled)
 */
export const isOrderActive = (status: OrderStatus): boolean => {
  return !['completed', 'cancelled'].includes(status)
}
