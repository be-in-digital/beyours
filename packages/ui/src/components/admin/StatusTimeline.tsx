import * as React from "react"
import { cn } from "../../lib/utils"

export interface TimelineItem {
  id: string
  status: string
  timestamp: string
  description?: string
}

export interface StatusTimelineProps
  extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[]
}

const StatusTimeline = React.forwardRef<HTMLDivElement, StatusTimelineProps>(
  ({ className, items, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-4", className)} {...props}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={item.id} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-2 top-6 h-full w-0.5 bg-border" />
            )}

            {/* Timeline dot */}
            <div className="relative z-10 mt-1 h-4 w-4 flex-shrink-0 rounded-full border-2 border-primary bg-background" />

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{item.status}</p>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
                <time className="text-sm text-muted-foreground">
                  {item.timestamp}
                </time>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
)
StatusTimeline.displayName = "StatusTimeline"

export { StatusTimeline }
