"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "../lib/utils"

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "size"> {
  value: string
  onValueChange: (value: string) => void
  /** Container size variant */
  size?: "sm" | "default"
}

/**
 * Reusable search input with built-in search icon and clear button.
 * Designed to be consistent across all admin pages.
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onValueChange, size = "default", placeholder, ...props }, ref) => {
    const isSmall = size === "sm"

    return (
      <div className={cn("relative w-full", className)}>
        {value ? (
          <button
            type="button"
            onClick={() => onValueChange("")}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors rounded-sm z-10",
              isSmall ? "left-2.5 p-0.5" : "left-3 p-0.5"
            )}
            aria-label="Effacer la recherche"
          >
            <X className={isSmall ? "h-3 w-3" : "h-4 w-4"} />
          </button>
        ) : (
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
              isSmall ? "left-2.5 h-3 w-3" : "left-3 h-4 w-4"
            )}
          />
        )}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex w-full rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            isSmall ? "h-8 pl-8 pr-2 text-xs" : "h-9 pl-9 pr-3",
          )}
          {...props}
        />
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
