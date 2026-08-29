/**
 * What an establishment will take an order for.
 *
 * Two settings the dashboard writes and nothing read:
 * `globalSettings.minimumOrderAmount` and `globalSettings.delivery.radius`. A
 * 3,30 € order passed against a 15 € minimum, and a delivery forty kilometres
 * out was accepted — the courier quote would come back at whatever it came back
 * at, and the kitchen would find out when the rider did.
 *
 * Kept pure, like every other refusal on this path: what a restaurant declines
 * to serve is a rule, and a rule is worth a test.
 */

export type ZoneRejectionReason = "below_minimum" | "outside_radius" | "not_located"

export class OrderZoneRejectedError extends Error {
  readonly reason: ZoneRejectionReason

  constructor(reason: ZoneRejectionReason, message: string) {
    super(message)
    this.name = "OrderZoneRejectedError"
    this.reason = reason
  }
}

/** Kilometres between two points, on a sphere the size of the Earth. */
export function distanceInKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Refuse an order worth less than the establishment will cook for. */
export function assertMeetsMinimum(params: {
  subtotal: number
  /** In cents. Absent or zero means no minimum. */
  minimumOrderAmount?: number
  formatAmount?: (cents: number) => string
}): void {
  const minimum = params.minimumOrderAmount
  if (!minimum || minimum <= 0) return
  if (params.subtotal >= minimum) return

  const shown = params.formatAmount
    ? params.formatAmount(minimum)
    : `${(minimum / 100).toFixed(2).replace(".", ",")} €`

  throw new OrderZoneRejectedError(
    "below_minimum",
    `Commande minimum de ${shown} requise.`
  )
}

/**
 * Refuse a delivery further out than the establishment goes.
 *
 * An address with no coordinates cannot be measured. It is refused rather than
 * waved through: a saved address without a geocode is exactly how a forty
 * kilometre delivery would slip past, and the checkout can locate it.
 */
export function assertWithinDeliveryRadius(params: {
  /** `delivery.radius` in km. Absent or zero means no limit. */
  radiusKm?: number
  store?: { latitude?: number; longitude?: number }
  dropoff?: { latitude?: number; longitude?: number }
}): void {
  const radius = params.radiusKm
  if (!radius || radius <= 0) return

  const storeLat = params.store?.latitude
  const storeLng = params.store?.longitude
  // An establishment that never geocoded its own address cannot measure
  // anything. That is the owner's gap, not the customer's: no refusal.
  if (storeLat === undefined || storeLng === undefined) return

  const lat = params.dropoff?.latitude
  const lng = params.dropoff?.longitude
  if (lat === undefined || lng === undefined) {
    throw new OrderZoneRejectedError(
      "not_located",
      "L'adresse de livraison doit être localisée : sélectionnez-la dans les suggestions."
    )
  }

  const distance = distanceInKm(
    { latitude: storeLat, longitude: storeLng },
    { latitude: lat, longitude: lng }
  )

  if (distance > radius) {
    throw new OrderZoneRejectedError(
      "outside_radius",
      `Cette adresse est hors de notre zone de livraison (${radius} km).`
    )
  }
}
