"use client"

/**
 * « Heures de pointe » — the trading day hour by hour.
 *
 * The second of the three metrics the site named and the engine did not have:
 * there was no time-of-day bucketing anywhere.
 *
 * ALL 24 HOURS, INCLUDING THE EMPTY ONES. A restaurant closed between 15:00 and
 * 18:00 has a real trough there, and a chart that dropped the empty bars would
 * draw the afternoon as a continuation of lunch. The server always returns 24
 * entries for the same reason — see `hourlyLoad`.
 *
 * The hours are the establishment's own local hours, derived from the local
 * midnights this screen computes. No timezone is sent anywhere: over a period
 * that straddles a DST change, one offset would be wrong for part of it.
 */

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@be-in-digital/ui"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Clock } from "lucide-react"
import type { DashboardHour } from "./use-dashboard-stats"

interface PeakHoursProps {
  hourly: DashboardHour[]
}

const chartConfig = {
  orders: {
    label: "Commandes",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

/** `14` → `14 h`, the way a French service sheet writes it. */
function hourLabel(hour: number): string {
  return `${hour} h`
}

export function PeakHours({ hourly }: PeakHoursProps) {
  const busiest = hourly.reduce<DashboardHour | null>(
    (best, entry) => (best === null || entry.orders > best.orders ? entry : best),
    null
  )
  const hasData = busiest !== null && busiest.orders > 0

  const data = hourly.map((entry) => ({
    hour: hourLabel(entry.hour),
    orders: entry.orders,
    revenue: entry.revenue,
  }))

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" aria-hidden="true" />
          Heures de pointe
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucune commande sur la période.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm">
              Le coup de feu est à{" "}
              <span className="font-semibold">{hourLabel(busiest.hour)}</span> —{" "}
              {busiest.orders} commande{busiest.orders > 1 ? "s" : ""} sur la
              période.
            </p>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  // Every third hour: 24 labels on a phone overlap into a smear,
                  // and the gridlines carry the rest.
                  interval={2}
                  tickMargin={8}
                  className="text-xs"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="var(--color-chart-2)" radius={2} />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}
