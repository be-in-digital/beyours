"use client"

import { Card, CardContent, CardHeader, Skeleton } from "@beindigital-engine/ui"

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-44 rounded" />
        <Skeleton className="h-4 w-56 mt-1.5 rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-7 w-20 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-48 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] rounded-lg" />
        </CardContent>
      </Card>

      {/* Donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40 rounded" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Skeleton className="h-[150px] w-[150px] rounded-full" />
              <div className="flex gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-14 rounded" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent orders */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-36 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
