"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

export interface QuantitySelectorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

const QuantitySelector = React.forwardRef<HTMLDivElement, QuantitySelectorProps>(
  (
    { className, value, onChange, min = 1, max = 99, disabled, ...props },
    ref
  ) => {
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
        className={cn("flex items-center gap-2", className)}
        {...props}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="h-8 w-8"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <input
          type="number"
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
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="h-8 w-8"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    )
  }
)
QuantitySelector.displayName = "QuantitySelector"

export { QuantitySelector }
