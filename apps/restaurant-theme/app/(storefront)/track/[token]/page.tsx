"use client"

import { useParams } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { TrackingHeader } from "./tracking-header"
import { TrackingTimeline } from "./tracking-timeline"
import { TrackingCountdown } from "./tracking-countdown"
import { TrackingStoreInfo } from "./tracking-store-info"
import { TrackingFooter } from "./tracking-footer"
import { Skeleton } from "@/components/ui/skeleton"

export default function TrackingPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const data = useQuery(
    api.kitchenTickets.getByTrackingToken,
    token ? { token } : "skip"
  )

  // Loading
  if (data === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto space-y-4 pt-8">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    )
  }

  // Token invalide
  if (data === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm">
          <p className="text-xl font-bold text-gray-900 mb-2">
            Lien de suivi invalide
          </p>
          <p className="text-sm text-gray-500">
            Ce lien de suivi n&apos;existe pas ou a expire.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto space-y-4 pt-8 pb-4">
      <TrackingHeader
        storeName={data.storeBranding?.name ?? "Restaurant"}
        orderNumber={data.orderNumber}
        orderType={data.orderType}
      />

      <TrackingCountdown
        estimatedReadyAt={data.estimatedReadyAt}
        status={data.status}
      />

      <TrackingTimeline status={data.status} />

      {data.storeBranding && (
        <TrackingStoreInfo
          storeName={data.storeBranding.name}
          address={data.storeBranding.address}
        />
      )}

      <TrackingFooter />
    </div>
  )
}
