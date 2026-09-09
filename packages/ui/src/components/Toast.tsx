"use client"

/**
 * A toast box. Not a toast system — this package has no such thing, and the one
 * the product uses is `sonner`, mounted in each app's `app/providers.tsx`.
 *
 * WHAT WAS HERE. A second, entirely separate toast system: a `ToastContext`
 * defaulting to `undefined`, a `ToastProvider` that supplied it, and a
 * `useToast` hook that threw "useToast must be used within ToastProvider" when
 * it was absent. `ToastProvider` was mounted in no app, in no package and in no
 * test, so the hook did not merely go unused — every possible caller of it got
 * the throw. It was on the published API of `@be-in-digital/ui` by way of
 * `components/index.ts`, so a client site pinning this package could import
 * `useToast`, wire a screen to it, and discover at runtime that the only
 * behaviour it has is to crash.
 *
 * `Toast` itself stays, and the distinction matters. It is presentational —
 * variants, a title, a description, an optional close button — and it needs no
 * provider to render. It is also one of the twenty consumer-free components
 * `tasks/reference-themes-divergence.md` deliberately keeps, on the reasoning
 * that removing a name from a published package is a breaking major that buys
 * nothing but a shorter barrel. A hook whose every call throws is a different
 * claim from an export nobody happens to import, and only the first one was
 * removed here.
 */

import * as React from "react"
import { X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-500 bg-green-50 text-green-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onClose, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && (
          <div className="text-sm opacity-90">{description}</div>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Fermer la notification"
          onClick={onClose}
          /* `text-muted-foreground`, not `text-foreground/50`: the modifier
             multiplied the ratio down to 3.78:1 on the close button of every
             toast, and the token means the same thing at a ratio the matrix
             test holds. See the sweep's own header — never soften text with a
             `/NN`. */
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
)
Toast.displayName = "Toast"

export { Toast, toastVariants }
