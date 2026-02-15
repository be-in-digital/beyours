import * as React from "react"
import { Flame } from "lucide-react"
import { cn } from "../../lib/utils"

export interface SpiceLevelIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  level: number
  maxLevel?: number
}

const SpiceLevelIndicator = React.forwardRef<
  HTMLDivElement,
  SpiceLevelIndicatorProps
>(({ className, level, maxLevel = 5, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-0.5", className)}
    title={`Spice level: ${level}/${maxLevel}`}
    {...props}
  >
    {Array.from({ length: maxLevel }, (_, index) => (
      <Flame
        key={index}
        className={cn(
          "h-4 w-4",
          index < level
            ? "fill-orange-500 text-orange-500"
            : "text-muted-foreground/30"
        )}
      />
    ))}
  </div>
))
SpiceLevelIndicator.displayName = "SpiceLevelIndicator"

export { SpiceLevelIndicator }
