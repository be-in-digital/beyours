"use client"

import { PieChart as PieChartIcon } from "lucide-react"
import { Cell, Pie, PieChart } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@be-yours/ui"

interface OrderBreakdownProps {
  byType: { name: string; value: number; label: string }[]
  bySource: { name: string; value: number; label: string }[]
  /**
   * True when the server stopped at its read cap, so these slices are a sample
   * of the window rather than all of it.
   *
   * A busy establishment can take more orders in thirty days than Convex will
   * read in one transaction. The sample is the most recent orders, so the
   * proportions stay meaningful — but a pie chart that quietly describes ten
   * days while its caption says thirty is the kind of wrong nobody can see.
   */
  truncated?: boolean
}

const typeChartConfig = {
  delivery: { label: "Livraison", color: "var(--color-chart-1)" },
  pickup: { label: "À emporter", color: "var(--color-chart-2)" },
  dine_in: { label: "Sur place", color: "var(--color-chart-3)" },
} satisfies ChartConfig

const sourceChartConfig = {
  website: { label: "Site web", color: "var(--color-chart-1)" },
  uber_eats: { label: "Uber Eats", color: "var(--color-chart-2)" },
  deliveroo: { label: "Deliveroo", color: "var(--color-chart-4)" },
  pos: { label: "Caisse", color: "var(--color-chart-5)" },
} satisfies ChartConfig

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

function DonutChart({
  data,
  config,
}: {
  data: { name: string; value: number; label: string }[]
  config: ChartConfig
}) {
  const isEmpty = data.length === 0 || data.every((item) => item.value === 0)

  if (isEmpty) {
    return (
      <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <PieChartIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-xs">Aucune donnée</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <ChartContainer config={config} className="h-[180px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-[11px]">
        {data.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="text-muted-foreground">
              {item.label} ({item.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OrderBreakdown({ byType, bySource, truncated }: OrderBreakdownProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Par type de commande
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={byType} config={typeChartConfig} />
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Par source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={bySource} config={sourceChartConfig} />
          </CardContent>
        </Card>
      </div>

      {truncated && (
        <p className="text-xs text-muted-foreground" data-testid="breakdown-truncated">
          Répartition calculée sur vos commandes les plus récentes, pas sur les
          30 jours complets — votre volume dépasse ce qui peut être analysé en
          une fois.
        </p>
      )}
    </div>
  )
}
