"use client"

import { MapPin, ExternalLink } from "lucide-react"

interface TrackingStoreInfoProps {
  storeName: string
  address?: {
    street: string
    city: string
    postalCode: string
    country: string
    latitude?: number
    longitude?: number
  }
}

export function TrackingStoreInfo({
  storeName,
  address,
}: TrackingStoreInfoProps) {
  if (!address) return null

  const mapsUrl =
    address.latitude && address.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${address.street}, ${address.postalCode} ${address.city}`
        )}`

  return (
    <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 shadow-2xl shadow-black/[0.04]">
      <h2 className="text-lg font-black uppercase tracking-tighter mb-6">Restaurant</h2>

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-[#0D5C3F] flex-shrink-0">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-zinc-900 leading-tight">{storeName}</p>
          <p className="text-sm text-zinc-400 mt-1 font-medium">
            {address.street}, {address.postalCode} {address.city}
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#0D5C3F] hover:text-[#0a4d35] transition-colors"
          >
            Voir sur Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
