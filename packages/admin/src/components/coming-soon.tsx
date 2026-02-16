"use client"

import { Clock } from "lucide-react"

interface ComingSoonProps {
  title: string
  description?: string
}

/**
 * Placeholder for features under development
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-5 max-w-sm">
        <div className="mx-auto w-14 h-14 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
          <Clock className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description ?? "Cette fonctionnalité arrive bientôt. Restez à l'écoute !"}
          </p>
        </div>
      </div>
    </div>
  )
}
