"use client"

import { Card, CardContent } from "@be-in-digital/ui"
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

interface Totals {
  /** Money that ARRIVED, not money that was ordered. */
  revenue: number
  /** Orders placed. Deliberately a wider set than `revenue` is drawn from. */
  orderCount: number
  averageBasket: number
  collectedOrderCount: number
  /** Ordered and not yet collected — the gap between the two figures above. */
  uncollected: number
}

interface TodayStats extends Totals {
  activeOrders: number
}

type YesterdayStats = Totals

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
      <span className="text-success inline-flex items-center gap-0.5 text-[11px] font-medium">
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
        isPositive ? "text-success" : "text-red-700 dark:text-red-400"
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
      /* The card used to sum every order that was not cancelled, so an
         abandoned checkout and a table nobody has rung up were takings. It now
         sums what arrived — and says what is missing, because "encaissé" and
         "commandé" differing by 1 700 € with nothing on screen to explain it
         is the more alarming of the two screens. */
      note:
        today.uncollected > 0
          ? `dont ${formatPrice(today.uncollected)} en attente d'encaissement`
          : null,
    },
    {
      title: "Commandes",
      value: today.orderCount.toString(),
      icon: ShoppingCart,
      todayValue: today.orderCount,
      yesterdayValue: yesterday.orderCount,
      showTrend: true,
      note:
        today.collectedOrderCount < today.orderCount
          ? `${today.collectedOrderCount} encaissée${today.collectedOrderCount > 1 ? "s" : ""}`
          : null,
    },
    {
      title: "Panier moyen",
      value: formatPrice(today.averageBasket),
      icon: TrendingUp,
      todayValue: today.averageBasket,
      yesterdayValue: yesterday.averageBasket,
      showTrend: true,
      /* Over the collected orders, which is what makes it divide into the
         first card rather than into the second. */
      note: null,
    },
    {
      title: "À traiter (24h)",
      value: today.activeOrders.toString(),
      icon: Clock,
      todayValue: today.activeOrders,
      yesterdayValue: 0,
      showTrend: false,
      note: null,
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
                {card.note && (
                  <p className="text-muted-foreground text-[11px] tabular-nums">
                    {card.note}
                  </p>
                )}
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
