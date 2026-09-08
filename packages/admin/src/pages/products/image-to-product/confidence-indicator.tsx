"use client"

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"

interface ConfidenceIndicatorProps {
  value: number // 0-1
  className?: string
}

/**
 * How sure the model was about one extracted field.
 *
 * The band used to be a hue and nothing else — green, then yellow, then red —
 * which is WCAG 1.4.1: on a screen whose whole job is "which of these
 * suggestions do I need to check?", the answer was given in colour alone. The
 * percentage beside it is the raw number, not the verdict; a reviewer who
 * cannot separate the three hues has to know the thresholds to read it.
 *
 * Each band now carries a distinct SHAPE as well, and the indicator names
 * itself. `role="img"` + `aria-label` replaces the old `title`, which is not a
 * reliable accessible name on a plain div and never surfaces on touch — and
 * which, kept alongside a label, would only be announced a second time as the
 * description.
 *
 * French, like the rest of this screen.
 */
const LOW_CONFIDENCE_BAND = {
  fromPercent: 0,
  barClassName: "bg-red-500",
  iconClassName: "text-red-600",
  icon: AlertTriangle,
  label: "confiance faible",
} as const

const CONFIDENCE_BANDS = [
  {
    /** Read as: this band starts here. Ordered high to low. */
    fromPercent: 80,
    barClassName: "bg-green-500",
    iconClassName: "text-green-600",
    icon: CheckCircle2,
    label: "confiance élevée",
  },
  {
    fromPercent: 50,
    barClassName: "bg-yellow-500",
    iconClassName: "text-yellow-600",
    icon: HelpCircle,
    label: "confiance moyenne",
  },
  LOW_CONFIDENCE_BAND,
] as const

type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number]

/**
 * The lowest band is named rather than reached for by index: a confidence
 * below zero should not fall off the end of the list, and `tsc` is right to
 * refuse an index it cannot check.
 */
function bandFor(percent: number): ConfidenceBand {
  return (
    CONFIDENCE_BANDS.find((band) => percent >= band.fromPercent) ??
    LOW_CONFIDENCE_BAND
  )
}

export function ConfidenceIndicator({ value, className }: ConfidenceIndicatorProps) {
  const percent = Math.round(value * 100)
  const band = bandFor(percent)
  const BandIcon = band.icon

  return (
    <div
      role="img"
      aria-label={`Confiance : ${percent} % — ${band.label}`}
      className={`flex items-center gap-1.5 ${className ?? ""}`}
    >
      {/* Literal class strings, never derived: Tailwind scans source text, so
          a name assembled at runtime gets no CSS generated for it. */}
      <BandIcon aria-hidden className={`h-3 w-3 shrink-0 ${band.iconClassName}`} />
      <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${band.barClassName}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{percent}%</span>
    </div>
  )
}
