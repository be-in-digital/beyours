"use client"

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
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
        Restaurant
      </h3>
      <p className="font-bold text-gray-900">{storeName}</p>
      <p className="text-sm text-gray-600">
        {address.street}, {address.postalCode} {address.city}
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        Voir sur Google Maps
      </a>
    </div>
  )
}
