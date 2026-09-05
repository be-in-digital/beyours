"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

export interface QuantitySelectorLabels {
  /** Names the control as a whole. */
  group: string
  /** Accessible name of the minus button. */
  decrease: string
  /** Accessible name of the plus button. */
  increase: string
  /** Accessible name of the number input. */
  input: string
}

/**
 * French by default: this control sits on the storefront, next to
 * `PriceDisplay`, which already formats in `fr-FR`. Pass `labels` to override.
 */
const DEFAULT_LABELS: QuantitySelectorLabels = {
  group: "Quantité",
  decrease: "Diminuer la quantité",
  increase: "Augmenter la quantité",
  input: "Quantité",
}

export interface QuantitySelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Accessible names for the three controls. Partially overridable. */
  labels?: Partial<QuantitySelectorLabels>
}

/**
 * Every control here carries an accessible name.
 *
 * The two buttons render nothing but an icon and the input had no label of any
 * kind, so a screen reader announced three unnamed controls — "button",
 * "button", "spin button" — and a blind diner could not tell which one added an
 * item. Icons are `aria-hidden`; the name comes from `aria-label`.
 *
 * Naming them is not enough on its own. Pressing plus leaves focus on the
 * button while the value changes in an input nobody is looking at, so the
 * press is silent. The live region below announces the new value.
 */
const QuantitySelector = React.forwardRef<HTMLDivElement, QuantitySelectorProps>(
  (
    {
      className,
      value,
      onChange,
      min = 1,
      max = 99,
      disabled,
      labels,
      ...props
    },
    ref
  ) => {
    const text = { ...DEFAULT_LABELS, ...labels }

    const handleDecrement = () => {
      if (value > min) {
        onChange(value - 1)
      }
    }

    const handleIncrement = () => {
      if (value < max) {
        onChange(value + 1)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value, 10)
      if (!isNaN(newValue) && newValue >= min && newValue <= max) {
        onChange(newValue)
      }
    }

    return (
      <div
        ref={ref}
        role="group"
        aria-label={text.group}
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={text.decrease}
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </Button>

        <input
          type="number"
          aria-label={text.input}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          min={min}
          max={max}
          className="h-8 w-12 rounded-md border border-input bg-background text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={text.increase}
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Button>

        <span role="status" aria-live="polite" className="sr-only">
          {`${text.group} : ${value}`}
        </span>
      </div>
    )
  }
)
QuantitySelector.displayName = "QuantitySelector"

export { QuantitySelector }
