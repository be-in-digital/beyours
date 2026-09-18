"use client"

import { useState, useEffect } from "react"
import { AlertOctagon, AlertTriangle } from "lucide-react"
import { cn } from "@be-yours/ui"

interface TicketTimerProps {
  createdAt: number
}

/**
 * How long a ticket has been waiting, as three bands.
 *
 * The bands used to be a hue and nothing else — grey, then yellow-600, then
 * red-600 — which is WCAG 1.4.1: the one thing a kitchen screen has to say
 * from across the room was said in colour alone. About one man in twelve
 * cannot separate that yellow from that red, and the elapsed figure does not
 * help him: "14m" and "25m" are both just numbers unless you already know
 * where this kitchen's thresholds sit.
 *
 * Each band therefore carries a distinct SHAPE — nothing, a triangle, an
 * octagon — and the two that mean something carry an accessible name as well.
 * The colour stays: it is the fastest cue for everyone who can see it, it is
 * just no longer the only one.
 *
 * The label is French because this screen is (« Cuisine (KDS) », « Non
 * imprimée », « Réimprimer »).
 */
const URGENCY_BANDS = [
  {
    /** Under ten minutes: the normal case, and it earns no marker at all. */
    fromMinutes: 0,
    className: "text-muted-foreground",
    icon: null,
    label: null,
  },
  {
    fromMinutes: 10,
    className: "text-yellow-600 font-medium",
    icon: AlertTriangle,
    label: "Ticket à surveiller",
  },
  {
    fromMinutes: 20,
    className: "text-red-600 font-semibold",
    icon: AlertOctagon,
    label: "Ticket en retard",
  },
] as const

type UrgencyBand = (typeof URGENCY_BANDS)[number]

function bandFor(minutes: number): UrgencyBand {
  // Last band whose threshold the ticket has crossed.
  let band: UrgencyBand = URGENCY_BANDS[0]
  for (const candidate of URGENCY_BANDS) {
    if (minutes >= candidate.fromMinutes) band = candidate
  }
  return band
}

export function TicketTimer({ createdAt }: TicketTimerProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  useEffect(() => {
    // Calculate initial elapsed time
    const updateElapsed = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - createdAt) / 1000 / 60) // minutes
      setElapsedMinutes(elapsed)
    }

    // Update immediately
    updateElapsed()

    // Update every minute
    const interval = setInterval(updateElapsed, 60000)

    return () => clearInterval(interval)
  }, [createdAt])

  // Format elapsed time. Beyond 24h the exact figure is noise ("2237h 47m"):
  // the ticket is stale data, not a rush to prioritize — cap the display.
  //
  // The cap lived only in the packaged copy, which nothing rendered; the copy
  // the apps mounted never had it. Lifting the live screen over the package
  // would have deleted the fix, so it is restored here and held by a test.
  const formatElapsed = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    if (minutes >= 24 * 60) {
      return "+24h"
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const band = bandFor(elapsedMinutes)
  const BandIcon = band.icon

  return (
    <div className={cn("flex items-center gap-1 text-sm", band.className)}>
      {/*
        `role="img"` + `aria-label` rather than an sr-only span: the elapsed
        figure is the only text this component prints, and a test asserts that
        (`kitchen-screen.test.tsx` compares textContent exactly). An SVG carries
        no text node, so the name reaches assistive technology without reaching
        the string.
      */}
      {BandIcon && (
        <BandIcon
          role="img"
          aria-label={band.label ?? undefined}
          className="h-3.5 w-3.5 shrink-0"
        />
      )}
      {formatElapsed(elapsedMinutes)}
    </div>
  )
}
