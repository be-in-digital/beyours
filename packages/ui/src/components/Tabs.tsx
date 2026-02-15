"use client"

import * as React from "react"
import { cn } from "../lib/utils"

export interface Tab {
  value: string
  label: string
  disabled?: boolean
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[]
  value: string
  onValueChange: (value: string) => void
  children?: React.ReactNode
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, value, onValueChange, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-4", className)} {...props}>
      <div className="border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.value === value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => !tab.disabled && onValueChange(tab.value)}
                disabled={tab.disabled}
                className={cn(
                  "whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  tab.disabled && "cursor-not-allowed opacity-50"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
)
Tabs.displayName = "Tabs"

export { Tabs }
