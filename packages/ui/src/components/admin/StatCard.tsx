import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { Card, CardContent } from "../Card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  label: string
  value: string | number
  trend?: {
    value: number
    isPositive?: boolean
  }
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, icon, label, value, trend, ...props }, ref) => (
    <Card ref={ref} className={className} {...props}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  // The design system's own semantic inks, which clear AA in
                  // both schemes and follow an establishment's branding.
                  // `text-green-600` was 3.15:1 on the light admin page and
                  // `text-red-600` 4.23:1 on the dark one.
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>
                  {trend.isPositive ? "+" : ""}
                  {trend.value}%
                </span>
              </div>
            )}
          </div>
          {/* `bg-accent text-accent-foreground` is the system's pale-brand pair
              and is measured as such; `bg-primary/10 text-primary` was the same
              idea spelled by hand, at 4.38:1. */}
          {icon && (
            <div className="rounded-lg bg-accent p-3 text-accent-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
)
StatCard.displayName = "StatCard"

export { StatCard }
