import * as React from "react"
import { Flame } from "lucide-react"
import { cn } from "../../lib/utils"

export interface SpiceLevelIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  level: number
  maxLevel?: number
  /**
   * Accessible name. Defaults to French, matching the storefront this renders
   * on; pass a string to override, e.g. `` `Spice level: ${level}/5` ``.
   * "Piquant", not "piment": the scale measures heat, not the vegetable.
   */
  label?: string
}

/**
 * The row of flames is one image with one name.
 *
 * It used to carry only a `title`, which is not a reliable accessible name on a
 * non-interactive element and never surfaces on touch — so the spice level was
 * invisible to a screen reader and to a phone. `role="img"` plus `aria-label`
 * names it once; the individual flames are decoration and stay hidden.
 *
 * No `title`: it would carry the same sentence as `aria-label`, and accname
 * then makes it the accessible *description*, so the level is announced twice.
 * Five flames with three filled already say it to anyone who can see them.
 */
const SpiceLevelIndicator = React.forwardRef<
  HTMLDivElement,
  SpiceLevelIndicatorProps
>(({ className, level, maxLevel = 5, label, ...props }, ref) => {
  const name = label ?? `Niveau de piquant : ${level}/${maxLevel}`

  return (
    <div
      ref={ref}
      role="img"
      aria-label={name}
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    >
      {Array.from({ length: maxLevel }, (_, index) => (
        <Flame
          key={index}
          aria-hidden
          className={cn(
            "h-4 w-4",
            /* The lit flames are the meaning here, so 1.4.11 applies to them:
               `text-orange-500` measured 2.83:1 on the light page and
               `--warning` is the token that carries the same idea at a ratio
               the design system holds. The unlit ones were
               `text-muted-foreground/30` — 1.48:1, an outline nobody can see,
               which is what made a level of 2 out of 5 look like a level of 2
               out of 2. */
            index < level
              ? "fill-warning text-warning"
              : "text-muted-foreground"
          )}
        />
      ))}
    </div>
  )
})
SpiceLevelIndicator.displayName = "SpiceLevelIndicator"

export { SpiceLevelIndicator }
