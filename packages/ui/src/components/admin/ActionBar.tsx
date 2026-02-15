import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "../../lib/utils"
import { Input } from "../Input"

export interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode
  searchPlaceholder?: string
  onSearch?: (query: string) => void
}

const ActionBar = React.forwardRef<HTMLDivElement, ActionBarProps>(
  (
    { className, actions, searchPlaceholder = "Search...", onSearch, ...props },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = React.useState("")

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      setSearchQuery(query)
      onSearch?.(query)
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
        {...props}
      >
        {/* Search */}
        {onSearch && (
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    )
  }
)
ActionBar.displayName = "ActionBar"

export { ActionBar }
