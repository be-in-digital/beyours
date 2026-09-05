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

/**
 * The original price and the whole-percent markdown, or `null` when there is
 * no discount worth showing.
 *
 * Every rejection here is a string the storefront used to print: `Infinity`
 * gave "-NaN%", a negative amount gave "-150%", `amount === originalAmount`
 * gave a struck-through price identical to the price, and anything under half
 * a percent rounded to "-0%".
 */
function resolveDiscount(
  amount: number,
  originalAmount: number | undefined
): { original: number; percent: number } | null {
  if (originalAmount === undefined) return null
  if (!Number.isFinite(amount) || !Number.isFinite(originalAmount)) return null
  if (amount < 0) return null
  // Redundant while `amount >= 0` holds — `originalAmount > amount >= 0`
  // already implies it — but it is the clause that keeps a zero or negative
  // original out of the division if that precondition is ever relaxed.
  if (originalAmount <= 0) return null
  if (originalAmount <= amount) return null

  const percent = Math.round(((originalAmount - amount) / originalAmount) * 100)
  return percent > 0 ? { original: originalAmount, percent } : null
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
     * as a literal `0` next to the price — the storefront showed "12,50 €0".
     *
     * Guarding only `originalAmount` would leave the same hole on the other
     * operand, so the whole condition is coerced. And the arithmetic below
     * needs two finite, sane numbers: `Infinity` passed a naive `> 0` check
     * and printed "-NaN%", a negative amount printed "-150%", and a 0.4%
     * markdown rounded to a meaningless "-0%". Resolving the discount once,
     * to an object or to nothing, keeps every one of those out of the tree.
     */
    const discount = resolveDiscount(amount, originalAmount)
    const hasDiscount = Boolean(showDiscount) && discount !== null

    return (
      <div
        ref={ref}
        className={cn("flex items-baseline gap-2", className)}
        {...props}
      >
        <span className="text-lg font-bold">{formatPrice(amount)}</span>
        {hasDiscount && discount && (
          <>
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(discount.original)}
            </span>
            <span className="text-sm font-medium text-destructive">
              -{discount.percent}%
            </span>
          </>
        )}
      </div>
    )
  }
)
PriceDisplay.displayName = "PriceDisplay"

export { PriceDisplay }
