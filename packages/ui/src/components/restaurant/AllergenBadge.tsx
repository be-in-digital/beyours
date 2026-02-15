import * as React from "react"
import { Wheat, Milk, Nut, Fish, Egg, Leaf } from "lucide-react"
import { cn } from "../../lib/utils"

export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "shellfish"
  | "eggs"
  | "soy"
  | "fish"
  | "vegetarian"
  | "vegan"

export interface AllergenBadgeProps {
  allergen: Allergen
  className?: string
  showLabel?: boolean
}

const allergenConfig: Record<
  Allergen,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  gluten: { icon: Wheat, label: "Gluten" },
  dairy: { icon: Milk, label: "Dairy" },
  nuts: { icon: Nut, label: "Nuts" },
  shellfish: { icon: Fish, label: "Shellfish" },
  eggs: { icon: Egg, label: "Eggs" },
  soy: { icon: Leaf, label: "Soy" },
  fish: { icon: Fish, label: "Fish" },
  vegetarian: { icon: Leaf, label: "Vegetarian" },
  vegan: { icon: Leaf, label: "Vegan" },
}

const AllergenBadge: React.FC<AllergenBadgeProps> = ({
  allergen,
  className,
  showLabel = false,
}) => {
  const config = allergenConfig[allergen]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs",
        className
      )}
      title={config.label}
    >
      <Icon className="h-3 w-3" />
      {showLabel && <span>{config.label}</span>}
    </div>
  )
}

export { AllergenBadge }
