import * as React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "../lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
}

const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, items, separator, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      className={cn("flex", className)}
      {...props}
    >
      <ol className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={index} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <a
                  href={item.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  className={cn(
                    "text-sm",
                    isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="text-muted-foreground">
                  {separator || <ChevronRight className="h-4 w-4" />}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
)
Breadcrumb.displayName = "Breadcrumb"

export { Breadcrumb }
