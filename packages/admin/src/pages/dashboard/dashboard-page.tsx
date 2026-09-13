"use client"

import { DashboardHeader } from "./dashboard-header"
import { SellerIncompleteBanner } from "./seller-incomplete-banner"
import { StatCardsGrid } from "./stat-cards-grid"
import { OrdersChart } from "./orders-chart"
import { OrderBreakdown } from "./order-breakdown"
import { RecentOrdersTable } from "./recent-orders-table"
import { QuickActions } from "./quick-actions"
import { DashboardSkeleton } from "./dashboard-skeleton"
import { PeriodPicker } from "./period-picker"
import { PopularDishes } from "./popular-dishes"
import { PeakHours } from "./peak-hours"
import { ReturnRate } from "./return-rate"
import { useDashboardStats } from "./use-dashboard-stats"
import { ResolvingStore } from "../../components/resolving-store"

/** Rendering only — the state lives behind useDashboardStats. */
export function DashboardPage() {
  const { storeId, stats, orders, period, setPeriod, analyticsDenied } =
    useDashboardStats()

  if (!storeId) return <ResolvingStore />

  /*
   * A role without `analytics:read` gets the screen and not the figures.
   *
   * `/dashboard` is where every login lands, so this cannot be a redirect or a
   * blank page: `kitchen`, `waiter` and `delivery` all hold `orders:read` and
   * work from the recent-orders table and the quick actions below. What they do
   * not hold is the establishment's turnover, average basket and best-selling
   * dishes, which is what `analytics:read` is for and what nothing enforced
   * until now.
   *
   * Said rather than merely absent. A screen that silently dropped its own
   * charts reads as broken, and the operator cannot tell a missing right from a
   * missing feature.
   */
  if (analyticsDenied) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <SellerIncompleteBanner />
        <div className="rounded-lg border border-border/50 bg-muted/30 p-6">
          <p className="text-sm font-medium">Chiffres réservés à la direction</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre rôle ne donne pas accès au chiffre d'affaires, au panier moyen
            ni aux statistiques de l'établissement. Les commandes en cours
            restent ci-dessous.
          </p>
        </div>
        <div data-tour="dashboard-recent">
          <RecentOrdersTable orders={orders} />
        </div>
        <div data-tour="dashboard-actions">
          <QuickActions />
        </div>
      </div>
    )
  }

  if (!stats) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <DashboardHeader />
      <SellerIncompleteBanner />
      <div data-tour="dashboard-stats">
        <StatCardsGrid today={stats.today} yesterday={stats.yesterday} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Tendances et performances
        </h2>
        <PeriodPicker period={period} onChange={setPeriod} />
      </div>
      <div data-tour="dashboard-charts" className="space-y-6">
        <OrdersChart data={stats.days} />
        <div className="grid gap-6 lg:grid-cols-2">
          <PeakHours hourly={stats.hourly} />
          <PopularDishes
            products={stats.topProducts}
            truncated={stats.truncated}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ReturnRate diners={stats.diners} />
          <OrderBreakdown
            byType={stats.byType}
            bySource={stats.bySource}
            truncated={stats.truncated}
          />
        </div>
      </div>
      <div data-tour="dashboard-recent">
        {/* Already bounded by `orders.recent`; slicing here would be a second
            bound over rows the server never sent. */}
        <RecentOrdersTable orders={orders} />
      </div>
      <div data-tour="dashboard-actions">
        <QuickActions />
      </div>
    </div>
  )
}
