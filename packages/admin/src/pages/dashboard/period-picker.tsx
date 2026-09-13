"use client"

/**
 * How far back the overview looks.
 *
 * WHAT THIS REPLACES: nothing — and that was the defect. Every window on this
 * screen was a literal (`for (let i = 6; i >= 0; i--)`, a fixed thirty days),
 * while the site copy sold « analyse des tendances et des performances par
 * période ». The figures were real; the period was not a choice.
 */

import { Button } from "@be-in-digital/ui"
import { cn } from "../../lib/utils"
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  type DashboardPeriod,
} from "./use-dashboard-stats"

interface PeriodPickerProps {
  period: DashboardPeriod
  onChange: (period: DashboardPeriod) => void
}

export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
  return (
    // `group`, not `radiogroup`: these are buttons that change a view, and a
    // screen reader announcing "radio button, 1 of 3" invites the reader to
    // expect a form they have to submit.
    <div
      role="group"
      aria-label="Période affichée"
      className="inline-flex items-center gap-1 rounded-lg border border-border/50 p-1"
    >
      {DASHBOARD_PERIODS.map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={value === period ? "secondary" : "ghost"}
          // The state is on the control itself, not only in its colour: which
          // period is showing is the one thing this widget says, and saying it
          // in a background shade alone says it to nobody using a reader.
          aria-pressed={value === period}
          onClick={() => onChange(value)}
          className={cn("h-7 px-3 text-xs", value === period && "font-semibold")}
        >
          {DASHBOARD_PERIOD_LABELS[value]}
        </Button>
      ))}
    </div>
  )
}
