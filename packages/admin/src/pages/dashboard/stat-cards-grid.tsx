"use client"

import { Card, CardContent } from "@beindigital-engine/ui"
import { formatPrice } from "../../lib/formatters"
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react"
import { cn } from "../../lib/utils"

interface TodayStats {
  revenue: number
  orderCount: number
  averageBasket: number
  activeOrders: number
}

interface YesterdayStats {
  revenue: number
  orderCount: number
  averageBasket: number
}

interface StatCardsGridProps {
  today: TodayStats
  yesterday: YesterdayStats
}

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px]">
        <Minus className="h-3 w-3" />
      </span>
    )
  }

  if (previous === 0) {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5 text-[11px] font-medium">
        <ArrowUpRight className="h-3 w-3" />
        Nouveau
      </span>
    )
  }

  const change = ((current - previous) / previous) * 100
  const isPositive = change >= 0

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change).toFixed(0)}%
    </span>
  )
}

export function StatCardsGrid({ today, yesterday }: StatCardsGridProps) {
  const cards = [
    {
      title: "Chiffre d'affaires",
      value: formatPrice(today.revenue),
      icon: DollarSign,
      todayValue: today.revenue,
      yesterdayValue: yesterday.revenue,
      showTrend: true,
    },
    {
      title: "Commandes",
      value: today.orderCount.toString(),
      icon: ShoppingCart,
      todayValue: today.orderCount,
      yesterdayValue: yesterday.orderCount,
      showTrend: true,
    },
    {
      title: "Panier moyen",
      value: formatPrice(today.averageBasket),
      icon: TrendingUp,
      todayValue: today.averageBasket,
      yesterdayValue: yesterday.averageBasket,
      showTrend: true,
    },
    {
      title: "Commandes actives",
      value: today.activeOrders.toString(),
      icon: Clock,
      todayValue: today.activeOrders,
      yesterdayValue: 0,
      showTrend: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="border-border/50 bg-card transition-colors hover:bg-accent/30"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                  {card.title}
                </p>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {card.value}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">vs hier</span>
                  {card.showTrend && (
                    <TrendIndicator current={card.todayValue} previous={card.yesterdayValue} />
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
