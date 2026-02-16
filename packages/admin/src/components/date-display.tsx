"use client"

import { useEffect, useState } from "react"

interface DateDisplayProps {
  timestamp: number
  className?: string
  showAbsolute?: boolean
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: now - timestamp > 365 * 24 * 60 * 60 * 1000 ? "numeric" : undefined,
  }).format(new Date(timestamp))
}

function getAbsoluteDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

/**
 * Relative date display with auto-update
 */
export function DateDisplay({ timestamp, className, showAbsolute = true }: DateDisplayProps) {
  const [relativeTime, setRelativeTime] = useState("")

  useEffect(() => {
    const updateTime = () => setRelativeTime(getRelativeTime(timestamp))
    updateTime()

    const diff = Date.now() - timestamp
    const interval = diff < 60_000 ? 10_000 : diff < 3_600_000 ? 60_000 : 300_000
    const timer = setInterval(updateTime, interval)
    return () => clearInterval(timer)
  }, [timestamp])

  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={showAbsolute ? getAbsoluteDate(timestamp) : undefined}
      className={className}
    >
      {relativeTime}
    </time>
  )
}
