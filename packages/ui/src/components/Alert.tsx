import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
        // `warning` and `success` came from the old package copy, which also
        // carried a `title` prop and an icon map for them. Those two are not
        // ported: one call site used them and the other already writes its own
        // icon, so the composable form is the one API. The variants themselves
        // stay, because the product needs them — `store-detail-page.tsx` was
        // hand-rolling an amber alert out of `variant="default"` plus five
        // colour overrides, which is what a missing variant looks like.
        //
        // Literal colours rather than tokens: `app/globals.css` defines
        // `--destructive` and the five `--chart-*` and no `--warning` or
        // `--success`, and inventing tokens here would put them out of reach of
        // per-establishment branding for no gain.
        warning:
          "text-amber-900 bg-card [&>svg]:text-amber-600 *:data-[slot=alert-description]:text-amber-800/90 dark:text-amber-200 dark:[&>svg]:text-amber-400",
        success:
          "text-emerald-900 bg-card [&>svg]:text-emerald-600 *:data-[slot=alert-description]:text-emerald-800/90 dark:text-emerald-200 dark:[&>svg]:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
