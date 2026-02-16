"use client"

import { Skeleton } from "../ui/skeleton"

type LoadingVariant = "table" | "cards" | "form" | "detail"

interface LoadingStateProps {
  variant?: LoadingVariant
  count?: number
}

/**
 * Skeleton-based loading states for the admin
 */
export function LoadingState({ variant = "table", count = 5 }: LoadingStateProps) {
  switch (variant) {
    case "table":
      return (
        <div className="space-y-4">
          <div className="flex gap-6 pb-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex gap-6 py-3">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-28 rounded" />
            </div>
          ))}
        </div>
      )

    case "cards":
      return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 p-5 space-y-3">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
          ))}
        </div>
      )

    case "form":
      return (
        <div className="max-w-2xl space-y-6">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )

    case "detail":
      return (
        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
          ))}
        </div>
      )

    default:
      return null
  }
}
