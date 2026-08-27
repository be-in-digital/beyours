"use client"

import { DashboardHeader } from "./dashboard-header"
import { StatCardsGrid } from "./stat-cards-grid"
import { OrdersChart } from "./orders-chart"
import { OrderBreakdown } from "./order-breakdown"
import { RecentOrdersTable } from "./recent-orders-table"
import { QuickActions } from "./quick-actions"
import { DashboardSkeleton } from "./dashboard-skeleton"
import { useDashboardStats } from "./use-dashboard-stats"
import { ResolvingStore } from "../../components/resolving-store"

/** Rendering only — the state lives behind useDashboardStats. */
export function DashboardPage() {
  const { storeId, stats, orders } = useDashboardStats()

  if (!storeId) return <ResolvingStore />

  if (!stats) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <DashboardHeader />
      <div data-tour="dashboard-stats">
        <StatCardsGrid today={stats.today} yesterday={stats.yesterday} />
      </div>
      <div data-tour="dashboard-charts" className="space-y-6">
        <OrdersChart data={stats.last7Days} />
        <OrderBreakdown byType={stats.byType} bySource={stats.bySource} />
      </div>
      <div data-tour="dashboard-recent">
        <RecentOrdersTable orders={orders.slice(0, 10)} />
      </div>
      <div data-tour="dashboard-actions">
        <QuickActions />
      </div>
    </div>
  )
}
