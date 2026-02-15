/**
 * useOrderStatus Hook
 *
 * Helper hook for order status display
 */

'use client'

import { useMemo } from 'react'
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  isOrderActive,
  getNextStatus,
} from '../services/order'
import type { OrderStatus } from '../types'

/**
 * Order status display info
 */
interface OrderStatusInfo {
  label: string
  color: string
  isActive: boolean
  nextStatuses: OrderStatus[]
}

/**
 * Get order status display information
 */
export const useOrderStatus = (status: OrderStatus): OrderStatusInfo => {
  return useMemo(
    () => ({
      label: getOrderStatusLabel(status),
      color: getOrderStatusColor(status),
      isActive: isOrderActive(status),
      nextStatuses: getNextStatus(status),
    }),
    [status]
  )
}
