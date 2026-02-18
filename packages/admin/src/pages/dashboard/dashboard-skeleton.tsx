"use client"

import { Card, CardContent, CardHeader, Skeleton } from "@beindigital-engine/ui"

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header — matches DashboardHeader: h1 (text-xl) + p (text-sm) */}
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 mt-1.5" />
      </div>

      {/* Stat cards — matches StatCardsGrid: 4 cards, 1/2/4 grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders chart — matches OrdersChart: title + 240px chart area */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent>
          <div className="flex h-[240px] items-end gap-[clamp(4px,2vw,12px)] px-2 pt-4 pb-6">
            {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <Skeleton
                  className="w-full rounded-t-md"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-3 w-6" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order breakdown — matches OrderBreakdown: 2 donut cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="flex h-[180px] items-center justify-center">
                  <div className="relative h-[150px] w-[150px]">
                    <Skeleton className="h-full w-full rounded-full" />
                    <div className="absolute inset-0 m-auto h-[100px] w-[100px] rounded-full bg-card" />
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent orders — matches RecentOrdersTable: header row + 5 data rows */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b pb-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20 hidden md:block" />
              <Skeleton className="h-3 w-16 hidden md:block" />
              <Skeleton className="h-3 w-14 ml-auto" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20 hidden lg:block" />
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24 hidden md:block" />
                <Skeleton className="h-5 w-16 rounded-full hidden md:block" />
                <Skeleton className="h-4 w-14 ml-auto" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-1.5 w-1.5 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-3 w-20 hidden lg:block" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions — matches QuickActions: title + 3 action cards */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/50 p-3.5"
            >
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
