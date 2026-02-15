"use client"

import * as React from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

export interface CartItemProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  price: string | number
  quantity: number
  options?: string[]
  image?: string
  onQuantityChange?: (quantity: number) => void
  onRemove?: () => void
  disabled?: boolean
}

const CartItem = React.forwardRef<HTMLDivElement, CartItemProps>(
  (
    {
      className,
      name,
      price,
      quantity,
      options,
      image,
      onQuantityChange,
      onRemove,
      disabled,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex gap-4 border-b py-4 last:border-0",
        disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {/* Image */}
      {image && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-muted">
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h4 className="font-medium">{name}</h4>
          {options && options.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {options.join(", ")}
            </p>
          )}
        </div>
        <p className="font-semibold">{price}</p>
      </div>

      {/* Quantity Controls */}
      <div className="flex flex-col items-end justify-between">
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {onQuantityChange && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={disabled || quantity <= 1}
              className="h-8 w-8"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onQuantityChange(quantity + 1)}
              disabled={disabled}
              className="h-8 w-8"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
)
CartItem.displayName = "CartItem"

export { CartItem }
