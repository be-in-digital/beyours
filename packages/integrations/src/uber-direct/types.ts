/**
 * Uber Direct — API types
 *
 * Uber ships two delivery APIs under the same "Uber Direct" name. This module
 * targets the **eats** flavour (`/v1/eats/deliveries/*`, scope
 * `eats.deliveries`), which is the one our quote call already speaks. The DaaS
 * flavour (`/v1/customers/{id}/deliveries`) has a different body and a
 * different auth scope — do not mix the two.
 */

/** A delivery quote, as returned by our `getDeliveryQuote` action. */
export interface UberDirectQuote {
  estimateId: string
  /** Delivery fee in minor currency units. */
  fee: number
  currency: string
  /** Unix ms after which the estimate can no longer be turned into an order. */
  expiresAt: number
  estimatedDeliveryMinutes: number
}

export interface UberDirectContact {
  first_name: string
  last_name: string
  phone: string
  email?: string
}

export interface UberDirectAddress {
  formatted_address?: string
  apt_floor_suite?: string
  location?: {
    latitude: number
    longitude: number
  }
}

export interface UberDirectOrderItem {
  name: string
  quantity: number
  description?: string
  external_id?: string
  /** Unit price in minor currency units. */
  price?: number
  currency_code?: string
}

export interface UberDirectOrderSummary {
  currency_code: string
  /** Order value in minor currency units, excluding the delivery fee. */
  order_value: number
}

/** Body of `POST /v1/eats/deliveries/orders`. */
export interface CreateDeliveryRequest {
  estimate_id: string
  /** Unix ms when the order is ready; `0` means ASAP. */
  pickup_at: number
  external_order_id: string
  external_user_id: string
  order_items: UberDirectOrderItem[]
  order_summary: UberDirectOrderSummary
  pickup: {
    store_id: string
    instructions?: string
  }
  dropoff: {
    address: UberDirectAddress
    contact: UberDirectContact
    instructions?: string
  }
}

/** Response of `POST /v1/eats/deliveries/orders`. */
export interface CreateDeliveryResponse {
  order_id: string
  external_order_id: string
  order_tracking_url?: string
  full_fee?: {
    total: number
    currency_code: string
  }
}

/**
 * Delivery status, verbatim from Uber.
 *
 * `FAILED` covers both a courier who could not complete the drop-off and a
 * delivery Uber cancelled on its side.
 */
export type UberDirectStatus =
  | "SCHEDULED"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "EN_ROUTE_TO_DROPOFF"
  | "ARRIVED_AT_DROPOFF"
  | "COMPLETED"
  | "FAILED"

/** Payload of the `dapi.status_changed` webhook. */
export interface UberDirectStatusWebhook {
  event_id: string
  event_time: number
  event_type: string
  resource_href?: string
  meta: {
    order_id: string
    external_order_id?: string
    status: string
    courier_trip_id?: string
    is_returning?: boolean
  }
}
