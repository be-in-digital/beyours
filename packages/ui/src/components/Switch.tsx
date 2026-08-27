"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  error?: string
  description?: string
  /** Radix-compatible callback fired on toggle */
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, error, description, id, onCheckedChange, onChange, checked, defaultChecked, ...props }, ref) => {
    const isControlled = checked !== undefined
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
    const isChecked = isControlled ? checked : internalChecked

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked)
      }
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }
    const switchId = id || React.useId()

    // The core toggle element using inline styles for checked state
    // (Tailwind peer-checked: variants are not generated for package dependencies)
    const switchElement = (
      <label
        htmlFor={switchId}
        style={{ minWidth: "2.75rem" }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          props.disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <input
          id={switchId}
          type="checkbox"
          // The control looks like a switch and behaves like one, but a bare
          // checkbox input is announced as "case à cocher". `switch` is a valid
          // role for a checkbox input and says what the user actually sees; the
          // checked state still comes from the native element, so there is no
          // `aria-checked` to keep in sync.
          role="switch"
          ref={ref}
          className="sr-only"
          checked={isControlled ? checked : undefined}
          defaultChecked={!isControlled ? defaultChecked : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={
            error ? `${switchId}-error` : description ? `${switchId}-description` : undefined
          }
          onChange={handleChange}
          {...props}
        />
        {/* Track */}
        <span
          className="pointer-events-none absolute h-full w-full rounded-full transition-colors"
          style={{ backgroundColor: isChecked ? "hsl(var(--primary))" : "hsl(var(--input))" }}
        />
        {/* Thumb */}
        <span
          className="pointer-events-none absolute inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
          style={{
            left: "2px",
            transform: isChecked ? "translateX(1.25rem)" : "translateX(0)",
          }}
        />
      </label>
    )

    // Render just the toggle when used inline (no label/description/error)
    if (!label && !description && !error) {
      return switchElement
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {switchElement}
          {label && (
            <label
              htmlFor={switchId}
              className="cursor-pointer text-sm font-medium leading-none"
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
