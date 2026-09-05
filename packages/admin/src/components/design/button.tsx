"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

/**
 * SCRATCH — adversarial proof only. A second design system, deliberately.
 * Old-generation geometry: h-10 and the ring-offset focus treatment that the
 * convergence deleted.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: { default: "bg-primary text-primary-foreground hover:bg-primary/90" },
      size: { default: "h-10 px-4 py-2" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />
}

export { buttonVariants }
