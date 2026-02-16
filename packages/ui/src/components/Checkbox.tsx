"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string
  error?: string
  description?: string
  /** Radix-compatible callback fired on toggle */
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, description, id, onCheckedChange, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e)
      onCheckedChange?.(e.target.checked)
    }
    const checkboxId = id || React.useId()

    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="relative flex items-center">
            <input
              id={checkboxId}
              type="checkbox"
              ref={ref}
              className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={
                error ? `${checkboxId}-error` : description ? `${checkboxId}-description` : undefined
              }
              onChange={handleChange}
              {...props}
            />
            <Check className="pointer-events-none absolute left-0 top-0 h-4 w-4 hidden text-primary-foreground peer-checked:block" />
            <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 hidden rounded bg-primary peer-checked:block" />
          </div>
          {label && (
            <label
              htmlFor={checkboxId}
              className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
              {props.required && <span className="ml-1 text-destructive">*</span>}
            </label>
          )}
        </div>
        {description && !error && (
          <p id={`${checkboxId}-description`} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {error && (
          <p id={`${checkboxId}-error`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
