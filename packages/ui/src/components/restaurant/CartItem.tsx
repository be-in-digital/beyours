"use client"

import * as React from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

export interface CartItemLabels {
  /** Accessible name of the remove button. */
  remove: string
  /** Accessible name of the minus button. */
  decrease: string
  /** Accessible name of the plus button. */
  increase: string
  /** Names the quantity group, and prefixes the announced quantity. */
  quantity: string
}

/**
 * French by default: the cart is customer-facing. Pass `labels` to override.
 */
const DEFAULT_LABELS: CartItemLabels = {
  remove: "Retirer du panier",
  decrease: "Diminuer la quantité",
  increase: "Augmenter la quantité",
  quantity: "Quantité",
}

export interface CartItemProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  price: string | number
  quantity: number
  options?: string[]
  image?: string
  onQuantityChange?: (quantity: number) => void
  onRemove?: () => void
  disabled?: boolean
  /** Accessible names for the icon-only controls. Partially overridable. */
  labels?: Partial<CartItemLabels>
}

/**
 * The remove, minus and plus controls render nothing but an icon, so each one
 * needs an `aria-label`: without it a screen reader announces three unnamed
 * buttons and the destructive one is indistinguishable from the other two.
 */
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
      labels,
      ...props
    },
    ref
  ) => {
    const text = { ...DEFAULT_LABELS, ...labels }

    return (
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
              aria-label={text.remove}
              onClick={onRemove}
              disabled={disabled}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}

          {onQuantityChange && (
            <div
              role="group"
              aria-label={text.quantity}
              className="flex items-center gap-2"
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={text.decrease}
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={disabled || quantity <= 1}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" aria-hidden />
              </Button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                aria-label={text.increase}
                onClick={() => onQuantityChange(quantity + 1)}
                disabled={disabled}
                className="h-8 w-8"
              >
                <Plus className="h-3 w-3" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }
)
CartItem.displayName = "CartItem"

export { CartItem }
