/**
 * Unified order format used internally across all platform integrations.
 * Platform-specific mappers convert to this format.
 */

export type PlatformType = "uberEats" | "deliveroo"

export interface UnifiedOrderItem {
  externalId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  modifiers: UnifiedOrderModifier[]
}

export interface UnifiedOrderModifier {
  externalId: string
  name: string
  quantity: number
  price: number
}

export interface UnifiedOrderCustomer {
  name: string
  phone?: string
  email?: string
}

export interface UnifiedOrderDelivery {
  type: "delivery" | "pickup"
  address?: {
    street: string
    city: string
    postalCode: string
    country: string
    latitude?: number
    longitude?: number
    instructions?: string
  }
  estimatedDeliveryTime?: string
  driverNotes?: string
}

export interface UnifiedOrder {
  externalOrderId: string
  platform: PlatformType
  storeExternalId: string
  displayId: string
  status: UnifiedOrderStatus
  type: "delivery" | "pickup" | "dine_in"
  customer: UnifiedOrderCustomer
  items: UnifiedOrderItem[]
  delivery?: UnifiedOrderDelivery
  subtotal: number
  taxAmount: number
  deliveryFee: number
  discountAmount: number
  total: number
  currency: string
  notes?: string
  scheduledFor?: string
  placedAt: string
  rawData: string // JSON-serialized original payload
}

export type UnifiedOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "denied"
