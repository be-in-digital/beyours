import * as React from "react"
import { cn } from "../../lib/utils"
import { Badge } from "../Badge"
import { Button } from "../Button"
import { Card, CardContent, CardFooter } from "../Card"

export interface ProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  description?: string
  price: string | number
  image?: string
  badge?: {
    text: string
    variant?: "default" | "secondary" | "destructive" | "outline"
  }
  onAddToCart?: () => void
  disabled?: boolean
}

const ProductCard = React.forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      className,
      name,
      description,
      price,
      image,
      badge,
      onAddToCart,
      disabled,
      ...props
    },
    ref
  ) => (
    <Card
      ref={ref}
      className={cn("overflow-hidden transition-shadow hover:shadow-md", className)}
      {...props}
    >
      {/* Image */}
      {image && (
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover"
          />
          {badge && (
            <div className="absolute right-2 top-2">
              <Badge variant={badge.variant}>{badge.text}</Badge>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-4">
        <h3 className="font-semibold leading-tight">{name}</h3>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        <p className="mt-2 text-lg font-bold">{price}</p>
      </CardContent>

      {onAddToCart && (
        <CardFooter className="p-4 pt-0">
          <Button
            onClick={onAddToCart}
            disabled={disabled}
            className="w-full"
            size="sm"
          >
            {disabled ? "Sold Out" : "Add to Cart"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
)
ProductCard.displayName = "ProductCard"

export { ProductCard }
