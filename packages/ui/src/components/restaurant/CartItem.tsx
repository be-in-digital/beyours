"use client"

import * as React from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../Button"

/**
 * Each label takes the item's name, because a cart holds more than one line.
 * Constant labels would give a four-item cart four buttons called "Retirer du
 * panier" and no way to tell which one deletes the pizza — the buttons list a
 * screen-reader user pulls up (NVDA `b`, the VoiceOver rotor) shows names,
 * not surrounding text.
 */
export interface CartItemLabels {
  /** Accessible name of the remove button. */
  remove: (name: string) => string
  /** Accessible name of the minus button. */
  decrease: (name: string) => string
  /** Accessible name of the plus button. */
  increase: (name: string) => string
  /** Names the quantity group, and the live announcement of its value. */
  quantity: (name: string) => string
}

/**
 * French by default: the cart is customer-facing. The wording matches the
 * storefront's own cart sheet. Pass `labels` to override.
 */
const DEFAULT_LABELS: CartItemLabels = {
  remove: (name) => `Retirer ${name} du panier`,
  decrease: (name) => `Diminuer la quantité de ${name}`,
  increase: (name) => `Augmenter la quantité de ${name}`,
  quantity: (name) => `Quantité de ${name}`,
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
 *
 * Naming them is not enough on its own. Pressing plus leaves focus on the
 * button while the count changes in a `<span>` nobody is looking at, so the
 * press is silent. The live region below announces the new quantity.
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
    const quantityLabel = text.quantity(name)

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-4 border-b py-4 last:border-0",
          // `pointer-events-none` beside the dimming, not instead of it. A
          // line at half opacity that can still be clicked is a control that
          // looks inactive and is not, and its `text-muted-foreground` reads
          // 1.99:1 through that opacity — which WCAG 1.4.3 exempts only for a
          // component that really is inactive. Saying so makes it true.
          disabled && "pointer-events-none opacity-50",
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
              aria-label={text.remove(name)}
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
              aria-label={quantityLabel}
              className="flex items-center gap-2"
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={text.decrease(name)}
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={disabled || quantity <= 1}
                className="h-8 w-8"
              >
                <Minus className="h-3 w-3" aria-hidden />
              </Button>
              <span aria-hidden className="w-8 text-center font-medium">
                {quantity}
              </span>
              <span role="status" aria-live="polite" className="sr-only">
                {`${quantityLabel} : ${quantity}`}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={text.increase(name)}
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
