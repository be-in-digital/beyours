"use client"

import type { ParsingWarning } from "@be-yours/convex-schema/types"
import { AlertTriangle, Info } from "lucide-react"

interface WarningBannerProps {
  warnings: ParsingWarning[]
  className?: string
}

export function WarningBanner({ warnings, className }: WarningBannerProps) {
  if (warnings.length === 0) return null

  const hasWarning = warnings.some((w) => w.severity === "warning")
  const Icon = hasWarning ? AlertTriangle : Info
  const borderColor = hasWarning ? "border-yellow-500/50" : "border-blue-500/50"
  const bgColor = hasWarning ? "bg-yellow-500/5" : "bg-blue-500/5"
  const iconColor = hasWarning ? "text-yellow-500" : "text-blue-500"

  return (
    <div className={`rounded-md border ${borderColor} ${bgColor} p-3 ${className ?? ""}`}>
      <div className="flex gap-2">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="space-y-1">
          {warnings.map((warning, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium">{warning.field}</span>: {warning.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
