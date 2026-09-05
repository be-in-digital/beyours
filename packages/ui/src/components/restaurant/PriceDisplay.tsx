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

    /**
     * `showDiscount && originalAmount && originalAmount > amount` yielded the
     * *number* `0` when `originalAmount` was 0, and JSX renders `{0 && ...}`
     * as a literal `0` next to the price. Compare against 0 so the guard is a
     * boolean and a zero original amount simply means "no discount".
     */
    const hasDiscount =
      showDiscount &&
      originalAmount !== undefined &&
      originalAmount > 0 &&
      originalAmount > amount

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
