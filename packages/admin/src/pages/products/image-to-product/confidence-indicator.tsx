"use client"

interface ConfidenceIndicatorProps {
  value: number // 0-1
  className?: string
}

export function ConfidenceIndicator({ value, className }: ConfidenceIndicatorProps) {
  const percent = Math.round(value * 100)
  const color =
    percent >= 80 ? "bg-green-500" :
    percent >= 50 ? "bg-yellow-500" :
    "bg-red-500"

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`} title={`Confiance: ${percent}%`}>
      <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  )
}
