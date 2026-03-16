"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { TrackingHeader } from "./tracking-header"
import { TrackingTimeline } from "./tracking-timeline"
import { TrackingCountdown } from "./tracking-countdown"
import { TrackingStoreInfo } from "./tracking-store-info"
import { TrackingFooter } from "./tracking-footer"
import { Skeleton } from "@beindigital-engine/ui/components"
import { Package, ArrowLeft, Loader2 } from "lucide-react"

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
      <div className="min-h-screen bg-[#FDFCF6] pt-20">
        <section className="pt-24 pb-20 px-6 md:px-12 bg-[#0D5C3F] rounded-b-[4rem] md:rounded-b-[8rem]">
          <div className="max-w-7xl mx-auto text-center">
            <Skeleton className="h-10 w-48 mx-auto mb-4 rounded-xl" />
            <Skeleton className="h-6 w-64 mx-auto rounded-lg" />
          </div>
        </section>
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-12">
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#0D5C3F]" />
          </div>
        </div>
      </div>
    )
  }

  // Token invalide
  if (data === null) {
    return (
      <div className="min-h-screen bg-[#FDFCF6] pt-20">
        <section className="pt-24 pb-20 px-6 md:px-12 bg-[#0D5C3F] rounded-b-[4rem] md:rounded-b-[8rem]">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none italic">
              Lien <span className="text-orange-500 not-italic">invalide</span>
            </h1>
          </div>
        </section>
        <div className="max-w-2xl mx-auto px-6 md:px-12 py-12 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
          <p className="text-zinc-500 mb-6">
            Ce lien de suivi n&apos;existe pas ou a expiré.
          </p>
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D5C3F] px-8 py-3 font-black uppercase tracking-widest text-white text-xs hover:bg-[#0a4d35] transition-colors"
          >
            Retour au menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans overflow-x-hidden pt-20 transition-colors duration-500">
      {/* Hero */}
      <section className="pt-24 pb-20 px-6 md:px-12 bg-[#0D5C3F] relative overflow-hidden rounded-b-[4rem] md:rounded-b-[8rem]">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <Link
            href="/menu"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au menu
          </Link>

          <TrackingHeader
            storeName={data.storeBranding?.name ?? "Restaurant"}
            orderNumber={data.orderNumber}
            orderType={data.orderType}
          />
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-6 md:px-12 py-12 space-y-8">
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
    </div>
  )
}
