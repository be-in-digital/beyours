"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  error?: string
  description?: string
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, error, description, id, ...props }, ref) => {
    const switchId = id || React.useId()

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label
            htmlFor={switchId}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          >
            <input
              id={switchId}
              type="checkbox"
              ref={ref}
              className="peer sr-only"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={
                error ? `${switchId}-error` : description ? `${switchId}-description` : undefined
              }
              {...props}
            />
            <span className="pointer-events-none absolute h-full w-full rounded-full bg-input transition-colors peer-checked:bg-primary" />
            <span className="pointer-events-none absolute left-0.5 inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform peer-checked:translate-x-5" />
          </label>
          {label && (
            <label
              htmlFor={switchId}
              className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
              {props.required && <span className="ml-1 text-destructive">*</span>}
            </label>
          )}
        </div>
        {description && !error && (
          <p id={`${switchId}-description`} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={`${switchId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
