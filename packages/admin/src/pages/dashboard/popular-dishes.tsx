"use client"

/**
 * « Plats populaires » — what the kitchen actually made over the period.
 *
 * One of the three metrics `apps/site` named and the product did not have: a
 * `grep -riE 'plats populaires|topProduct'` over `apps/themes` and `packages`
 * returned nothing at all. There was no product-level aggregation anywhere in
 * the engine.
 *
 * RANKED ON UNITS, and the column order says so. Ranking on revenue answers a
 * different question — the 38 € plateau outranks the burger the establishment
 * sells forty of — so both figures are shown and only units are the sort. See
 * `topProducts` in `dashboardStats.ts`.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@be-in-digital/ui"
import { UtensilsCrossed } from "lucide-react"
import { formatPrice } from "../../lib/formatters"
import type { DashboardProduct } from "./use-dashboard-stats"

interface PopularDishesProps {
  products: DashboardProduct[]
  /** True when the server stopped at its read cap, so the ranking is a floor. */
  truncated: boolean
}

export function PopularDishes({ products, truncated }: PopularDishesProps) {
  const most = products[0]?.quantity ?? 0

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
          Plats populaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucun plat vendu sur la période.
          </p>
        ) : (
          <ol className="space-y-3">
            {products.map((product, index) => (
              <li
                key={product.productId ?? `name:${product.name}`}
                className="space-y-1"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">
                    <span className="mr-2 text-muted-foreground tabular-nums">
                      {index + 1}.
                    </span>
                    {product.name}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {product.quantity} vendu{product.quantity > 1 ? "s" : ""}
                  </span>
                </div>
                {/* A bar rather than a number alone: a ranking is about the gaps
                    between the rows, and eight numbers in a column do not show
                    one. Widths are relative to the top dish. */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-chart-1"
                      style={{
                        width: `${most > 0 ? (product.quantity / most) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatPrice(product.revenue)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {truncated && (
          <p className="mt-4 text-xs text-muted-foreground">
            La période dépasse le nombre de commandes lues en une fois : ce
            classement porte sur les plus récentes.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
