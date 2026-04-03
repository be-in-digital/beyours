"use client"

import { Card, CardContent, CardHeader, Skeleton } from "@be-in-digital/ui"

type LoadingVariant = "table" | "cards" | "form" | "detail"

interface LoadingStateProps {
  variant?: LoadingVariant
  count?: number
}

/**
 * Page header skeleton (h1 + subtitle)
 */
function HeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-4 w-72 mt-1.5" />
    </div>
  )
}

/**
 * Tab bar skeleton
 */
function TabBarSkeleton({ tabs = 4 }: { tabs?: number }) {
  return (
    <div className="flex gap-1 border-b border-border/50 pb-px">
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-9 rounded-md ${i === 0 ? "w-24 bg-muted" : "w-20"}`}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton-based loading states for admin pages.
 * Each variant mirrors the real page layout structure.
 */
export function LoadingState({ variant = "table", count = 5 }: LoadingStateProps) {
  switch (variant) {
    // Pages with header + search/filters + table rows (orders, products, stores)
    case "table":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <HeaderSkeleton />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>

          <TabBarSkeleton tabs={5} />

          <Card className="border-border/50">
            <CardContent className="p-0">
              {/* Table header */}
              <div className="flex items-center gap-4 border-b px-4 py-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24 hidden md:block" />
                <Skeleton className="h-3 w-16 hidden md:block" />
                <Skeleton className="h-3 w-16 ml-auto" />
                <Skeleton className="h-3 w-20" />
              </div>
              {/* Table rows */}
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 border-b last:border-0 px-4 py-3.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28 hidden md:block" />
                  <Skeleton className="h-5 w-16 rounded-full hidden md:block" />
                  <Skeleton className="h-4 w-14 ml-auto" />
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )

    // Pages with header + grid of cards (categories, languages, team, payments)
    case "cards":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <HeaderSkeleton />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )

    // Pages with header + tabs + form content (settings, design, games)
    case "form":
      return (
        <div className="space-y-6">
          <HeaderSkeleton />
          <TabBarSkeleton tabs={4} />

          <Card className="border-border/50">
            <CardContent className="p-6 space-y-6">
              {/* 2-column form fields */}
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>

              {/* Switches section */}
              <div className="space-y-3">
                <Skeleton className="h-3.5 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between border border-border/50 rounded-lg px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-9 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>

              <Skeleton className="h-9 w-48 rounded-md" />
            </CardContent>
          </Card>
        </div>
      )

    // Pages with header + tabs + card detail content (store-detail)
    case "detail":
      return (
        <div className="space-y-6">
          <HeaderSkeleton />
          <TabBarSkeleton tabs={4} />

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      )

    default:
      return null
  }
}
