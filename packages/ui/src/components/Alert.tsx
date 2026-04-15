import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"
import { cn } from "../lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        warning:
          "border-yellow-500/50 text-yellow-900 dark:border-yellow-500 [&>svg]:text-yellow-600",
        success:
          "border-green-500/50 text-green-900 dark:border-green-500 [&>svg]:text-green-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const variantIcons = {
  default: Info,
  destructive: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string
  icon?: React.ReactNode
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", title, icon, children, ...props }, ref) => {
    const Icon = variant ? variantIcons[variant] : variantIcons.default

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon !== null && (icon || <Icon className="h-4 w-4" />)}
        <div>
          {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
          <div className="text-sm [&_p]:leading-relaxed">{children}</div>
        </div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
