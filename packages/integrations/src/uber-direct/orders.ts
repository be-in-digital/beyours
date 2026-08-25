/**
 * Uber Direct — building the create-delivery request
 *
 * Kept as a pure function so the payload can be asserted without a network
 * call: everything that can go wrong here is a shape or a rounding problem,
 * and both are cheap to test.
 */

import type {
  CreateDeliveryRequest,
  UberDirectOrderItem,
  UberDirectQuote,
} from "./types"

/** The slice of an order this module needs. */
export interface DeliverableOrder {
  _id: string
  orderNumber: string
  customerId?: string
  customerInfo: {
    name: string
    email?: string
    phone?: string
  }
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    externalId?: string
    notes?: string
  }>
  subtotal: number
  deliveryAddress?: {
    street: string
    city: string
    postalCode: string
    country: string
    latitude?: number
    longitude?: number
    instructions?: string
  }
  uberDirectEstimateId?: string
}

export interface BuildDeliveryOptions {
  /** Uber store id — the `customerId` of our Uber Direct settings. */
  uberStoreId: string
  quote: Pick<UberDirectQuote, "estimateId">
  currency?: string
  /** Unix ms when the food is ready. `0` (the default) means ASAP. */
  pickupAt?: number
  pickupInstructions?: string
}

export class UberDirectPayloadError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = "UberDirectPayloadError"
  }
}

/**
 * Split a free-form name into the first/last pair Uber requires.
 *
 * Uber marks both as required, and a single-word name is common enough on a
 * restaurant order that failing on it would block real deliveries. A trailing
 * dot stands in for the missing half — it is accepted, and it keeps the
 * courier's screen readable.
 */
export function splitCustomerName(fullName: string): {
  first_name: string
  last_name: string
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: "Client", last_name: "." }
  }
  if (parts.length === 1) {
    return { first_name: parts[0]!, last_name: "." }
  }
  return {
    first_name: parts[0]!,
    last_name: parts.slice(1).join(" "),
  }
}

/** One line of the manifest the courier carries. */
function toOrderItem(
  item: DeliverableOrder["items"][number],
  currency: string
): UberDirectOrderItem {
  return {
    name: item.productName,
    quantity: item.quantity,
    price: Math.round(item.unitPrice),
    currency_code: currency,
    ...(item.externalId ? { external_id: item.externalId } : {}),
    ...(item.notes ? { description: item.notes } : {}),
  }
}

/**
 * Build the body of `POST /v1/eats/deliveries/orders`.
 *
 * Throws rather than sending a half-formed request: a delivery created against
 * a bad address costs a courier trip and a refund, so every precondition Uber
 * marks as required is checked here first.
 */
export function buildCreateDeliveryRequest(
  order: DeliverableOrder,
  options: BuildDeliveryOptions
): CreateDeliveryRequest {
  const currency = options.currency ?? "EUR"

  if (!order.deliveryAddress) {
    throw new UberDirectPayloadError(
      "Order has no delivery address",
      "MISSING_DELIVERY_ADDRESS"
    )
  }
  if (!order.customerInfo.phone) {
    throw new UberDirectPayloadError(
      "Uber Direct requires a customer phone number to hand the order over",
      "MISSING_CUSTOMER_PHONE"
    )
  }
  if (order.items.length === 0) {
    throw new UberDirectPayloadError(
      "Order has no items to deliver",
      "EMPTY_ORDER"
    )
  }

  const address = order.deliveryAddress
  const formatted = [
    address.street,
    `${address.postalCode} ${address.city}`.trim(),
    address.country,
  ]
    .filter(Boolean)
    .join(", ")

  const hasCoordinates =
    typeof address.latitude === "number" && typeof address.longitude === "number"

  return {
    estimate_id: options.quote.estimateId,
    pickup_at: options.pickupAt ?? 0,
    // The order number, not the document id: this is what the courier and Uber
    // support read back to us over the phone.
    external_order_id: order.orderNumber,
    external_user_id: order.customerId ?? order.orderNumber,
    order_items: order.items.map((item) => toOrderItem(item, currency)),
    order_summary: {
      currency_code: currency,
      order_value: Math.round(order.subtotal),
    },
    pickup: {
      store_id: options.uberStoreId,
      ...(options.pickupInstructions
        ? { instructions: options.pickupInstructions }
        : {}),
    },
    dropoff: {
      address: {
        formatted_address: formatted,
        ...(hasCoordinates
          ? {
              location: {
                latitude: address.latitude!,
                longitude: address.longitude!,
              },
            }
          : {}),
      },
      contact: {
        ...splitCustomerName(order.customerInfo.name),
        phone: order.customerInfo.phone,
        ...(order.customerInfo.email ? { email: order.customerInfo.email } : {}),
      },
      ...(address.instructions ? { instructions: address.instructions } : {}),
    },
  }
}

/**
 * Whether a quote is still usable.
 *
 * Uber rejects an expired estimate, and the rejection costs a round trip; the
 * caller should re-quote instead.
 */
export function isQuoteUsable(
  quote: Pick<UberDirectQuote, "expiresAt">,
  now: number = Date.now()
): boolean {
  return quote.expiresAt > now
}
