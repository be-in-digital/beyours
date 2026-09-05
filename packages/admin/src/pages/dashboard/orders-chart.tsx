"use client"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@be-in-digital/ui"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { BarChart3 } from "lucide-react"
import { formatPrice } from "../../lib/formatters"

interface DayData {
  day: string
  revenue: number
  orders: number
}

interface OrdersChartProps {
  data: DayData[]
}

const chartConfig = {
  revenue: {
    label: "Chiffre d'affaires",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

export function OrdersChart({ data }: OrdersChartProps) {
  const hasData = data.some((d) => d.orders > 0)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Revenus des 7 derniers jours
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2">
            <BarChart3 className="text-muted-foreground/30 h-10 w-10" />
            <p className="text-muted-foreground text-xs">
              Aucune donnée sur les 7 derniers jours
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tickFormatter={(value: number) => `${(value / 100).toFixed(0)}€`}
                className="text-[11px]"
                width={45}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatPrice(value as number)}
                    labelFormatter={(label) => `${label}`}
                  />
                }
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
