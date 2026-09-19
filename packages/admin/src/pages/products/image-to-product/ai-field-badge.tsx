"use client"

import type { AiFieldSource } from "@be-yours/convex-schema/types"
import { Badge } from "@be-yours/ui"
import { Eye, Sparkles, Lightbulb } from "lucide-react"

const CONFIG: Record<AiFieldSource, { label: string; icon: typeof Eye; variant: "default" | "secondary" | "outline" }> = {
  detected: { label: "Detecte", icon: Eye, variant: "default" },
  generated: { label: "Genere", icon: Sparkles, variant: "secondary" },
  inferred: { label: "Deduit", icon: Lightbulb, variant: "outline" },
}

interface AiFieldBadgeProps {
  source: AiFieldSource
  className?: string
}

export function AiFieldBadge({ source, className }: AiFieldBadgeProps) {
  const config = CONFIG[source]
  if (!config) return null
  const { label, icon: Icon, variant } = config

  return (
    <Badge variant={variant} className={`text-[10px] px-1.5 py-0 gap-0.5 font-normal ${className ?? ""}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  )
}
