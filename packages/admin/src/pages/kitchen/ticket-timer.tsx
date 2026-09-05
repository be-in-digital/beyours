"use client"

import { useState, useEffect } from "react"
import { cn } from "@be-in-digital/ui"

interface TicketTimerProps {
  createdAt: number
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

  // Determine color based on elapsed time
  const getColorClass = (minutes: number): string => {
    if (minutes < 10) {
      return "text-muted-foreground"
    } else if (minutes < 20) {
      return "text-yellow-600"
    } else {
      return "text-red-600 font-semibold"
    }
  }

  return (
    <div className={cn("text-sm", getColorClass(elapsedMinutes))}>
      {formatElapsed(elapsedMinutes)}
    </div>
  )
}
