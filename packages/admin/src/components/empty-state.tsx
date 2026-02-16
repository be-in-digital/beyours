"use client"

import { Button } from "@beindigital-engine/ui"
import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Empty state with optional action button
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-sm space-y-5">
        <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {action && (
          <Button variant="outline" onClick={action.onClick} size="sm">
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
