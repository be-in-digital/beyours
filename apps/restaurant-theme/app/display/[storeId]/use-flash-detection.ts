"use client"

import { useRef, useState, useEffect } from "react"

export function useFlashDetection(readyIds: string[]): Set<string> {
  const prevIdsRef = useRef<Set<string>>(new Set())
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const prevIds = prevIdsRef.current
    const newIds = new Set<string>()

    for (const id of readyIds) {
      if (!prevIds.has(id)) {
        newIds.add(id)
      }
    }

    if (newIds.size > 0) {
      setFlashingIds(newIds)
      const timer = setTimeout(() => setFlashingIds(new Set()), 3000)
      return () => clearTimeout(timer)
    }

    prevIdsRef.current = new Set(readyIds)
  }, [readyIds])

  return flashingIds
}
