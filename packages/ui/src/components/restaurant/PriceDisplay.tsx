import * as React from "react"
import { cn } from "../../lib/utils"

export interface PriceDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  amount: number
  currency?: string
  currencySymbol?: string
  locale?: string
  originalAmount?: number
  showDiscount?: boolean
}

const PriceDisplay = React.forwardRef<HTMLDivElement, PriceDisplayProps>(
  (
    {
      className,
      amount,
      currency = "EUR",
      currencySymbol,
      locale = "fr-FR",
      originalAmount,
      showDiscount = true,
      ...props
    },
    ref
  ) => {
    const formatPrice = (value: number) => {
      if (currencySymbol) {
        return `${currencySymbol}${value.toFixed(2)}`
      }
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(value)
    }

    const hasDiscount = showDiscount && originalAmount && originalAmount > amount

    return (
      <div
        ref={ref}
        className={cn("flex items-baseline gap-2", className)}
        {...props}
      >
        <span className="text-lg font-bold">{formatPrice(amount)}</span>
        {hasDiscount && (
          <>
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(originalAmount)}
            </span>
            <span className="text-sm font-medium text-destructive">
              -
              {Math.round(((originalAmount - amount) / originalAmount) * 100)}%
            </span>
          </>
        )}
      </div>
    )
  }
)
PriceDisplay.displayName = "PriceDisplay"

export { PriceDisplay }
