"use client"

import { useRef, useState, useEffect } from "react"

export function useFlashDetection(readyIds: string[]): Set<string> {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())

  // Detect new IDs and update state during render (React allows setState during render
  // if it's conditional and won't cause infinite loops)
  const newIds = new Set<string>()
  for (const id of readyIds) {
    if (!prevIdsRef.current.has(id)) {
      newIds.add(id)
    }
  }

  if (newIds.size > 0 && newIds.size !== flashingIds.size) {
    prevIdsRef.current = new Set(readyIds)
    setFlashingIds(newIds)
  }

  // Auto-clear flashing after 3 seconds
  useEffect(() => {
    if (flashingIds.size === 0) return
    const timer = setTimeout(() => setFlashingIds(new Set()), 3000)
    return () => clearTimeout(timer)
  }, [flashingIds])

  return flashingIds
}
