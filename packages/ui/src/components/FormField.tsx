import * as React from "react"
import { cn } from "../lib/utils"

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  error?: string
  description?: string
  required?: boolean
  children: React.ReactNode
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, error, description, required, children, id, ...props }, ref) => {
    const fieldId = id || React.useId()

    return (
      <div ref={ref} className={cn("w-full space-y-2", className)} {...props}>
        {label && (
          <label
            htmlFor={fieldId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </label>
        )}
        <div id={fieldId}>{children}</div>
        {description && !error && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export { FormField }
