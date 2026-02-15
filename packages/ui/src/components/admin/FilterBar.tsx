"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { Badge } from "../Badge"
import { Button } from "../Button"

export interface Filter {
  id: string
  label: string
}

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  filters: Filter[]
  onRemoveFilter: (filterId: string) => void
  onClearAll?: () => void
}

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  ({ className, filters, onRemoveFilter, onClearAll, ...props }, ref) => {
    if (filters.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...props}
      >
        <span className="text-sm text-muted-foreground">Filters:</span>
        {filters.map((filter) => (
          <Badge
            key={filter.id}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {filter.label}
            <button
              type="button"
              onClick={() => onRemoveFilter(filter.id)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {onClearAll && filters.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>
    )
  }
)
FilterBar.displayName = "FilterBar"

export { FilterBar }
