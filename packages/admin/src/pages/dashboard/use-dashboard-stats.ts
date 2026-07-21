"use client"

/**
 * Dashboard state behind one narrow interface — the `use-store-detail`
 * pattern applied here: queries, time windows and aggregates live in this
 * hook; the page only renders. The interface is the test surface.
 */

import { useMemo } from "react"
import { useQuery } from "convex/react"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { ORDER_TYPE_LABELS, ORDER_SOURCE_LABELS } from "../../lib/vocabulary"

type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready"
  | "out_for_delivery" | "delivered" | "completed" | "cancelled"

type OrderType = "delivery" | "pickup" | "dine_in"
type OrderSource = "website" | "uber_eats" | "deliveroo" | "pos"

export interface DashboardOrder {
  _id: string
  status: OrderStatus
  type: OrderType
  source?: OrderSource
  createdAt: number
  total: number
  orderNumber: string
  customerInfo: { name: string; email?: string; phone?: string }
  items: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>
}

export interface DashboardStats {
  today: { revenue: number; orderCount: number; averageBasket: number; activeOrders: number }
  yesterday: { revenue: number; orderCount: number; averageBasket: number }
  last7Days: Array<{ day: string; revenue: number; orders: number }>
  byType: Array<{ name: string; value: number; label: string }>
  bySource: Array<{ name: string; value: number; label: string }>
}

const DAY_NAMES: Record<number, string> = {
  0: "Dim", 1: "Lun", 2: "Mar", 3: "Mer", 4: "Jeu", 5: "Ven", 6: "Sam",
}

export function computeDashboardStats(orders: DashboardOrder[]): DashboardStats {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayTs = todayStart.getTime()

  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayTs = yesterdayStart.getTime()

  const thirtyDaysAgo = new Date(todayStart)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysTs = thirtyDaysAgo.getTime()

  const validOrders = orders.filter((o) => o.status !== "cancelled")

  const todayOrders = validOrders.filter((o) => o.createdAt >= todayTs)
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0)
  const todayCount = todayOrders.length
  const todayAvg = todayCount > 0 ? todayRevenue / todayCount : 0

  // Bounded to the last 24h: an order stuck in "pending" since last week is
  // abandoned data, not work to do — an unbounded count reads absurd next to
  // the "today" cards.
  const activeStatuses: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"]
  const dayAgoTs = Date.now() - 24 * 60 * 60 * 1000
  const activeOrders = orders.filter(
    (o) => activeStatuses.includes(o.status) && o.createdAt >= dayAgoTs
  )

  const yesterdayOrders = validOrders.filter(
    (o) => o.createdAt >= yesterdayTs && o.createdAt < todayTs
  )
  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + o.total, 0)
  const yesterdayCount = yesterdayOrders.length
  const yesterdayAvg = yesterdayCount > 0 ? yesterdayRevenue / yesterdayCount : 0

  const last7Days: Array<{ day: string; revenue: number; orders: number }> = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayOrders = validOrders.filter(
      (o) => o.createdAt >= dayStart.getTime() && o.createdAt < dayEnd.getTime()
    )

    last7Days.push({
      day: DAY_NAMES[dayStart.getDay()] ?? "",
      revenue: dayOrders.reduce((sum, o) => sum + o.total, 0),
      orders: dayOrders.length,
    })
  }

  const recentOrders = validOrders.filter((o) => o.createdAt >= thirtyDaysTs)
  const typeCounts: Record<string, number> = {}
  const sourceCounts: Record<string, number> = {}

  for (const order of recentOrders) {
    typeCounts[order.type] = (typeCounts[order.type] || 0) + 1
    const source = order.source || "website"
    sourceCounts[source] = (sourceCounts[source] || 0) + 1
  }

  const byType = Object.entries(typeCounts).map(([name, value]) => ({
    name,
    value,
    label: ORDER_TYPE_LABELS[name as OrderType] || name,
  }))

  const bySource = Object.entries(sourceCounts).map(([name, value]) => ({
    name,
    value,
    label: ORDER_SOURCE_LABELS[name] || name,
  }))

  return {
    today: { revenue: todayRevenue, orderCount: todayCount, averageBasket: todayAvg, activeOrders: activeOrders.length },
    yesterday: { revenue: yesterdayRevenue, orderCount: yesterdayCount, averageBasket: yesterdayAvg },
    last7Days,
    byType,
    bySource,
  }
}

export function useDashboardStats(): {
  storeId: string | null
  stats: DashboardStats | null
  orders: DashboardOrder[]
} {
  const storeId = useAdminStoreId()
  const { api } = useAdminApiStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryRef = storeId && api?.orders?.list ? api.orders.list : ("skip" as any)
  const orders = useQuery(queryRef, storeId ? { storeId } : "skip") as
    | DashboardOrder[]
    | undefined

  const stats = useMemo(
    () => (orders ? computeDashboardStats(orders) : null),
    [orders]
  )

  return { storeId, stats, orders: orders ?? [] }
}
