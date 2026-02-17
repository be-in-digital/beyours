/**
 * Uber Eats API types
 * Based on Uber Eats Partner API v2
 */

// === Authentication ===

export interface UberEatsCredentials {
  clientId: string
  clientSecret: string
  sandboxMode?: boolean
}

export interface UberEatsToken {
  accessToken: string
  tokenType: string
  expiresAt: number
  scope: string
}

// === API URLs ===

export const UBER_EATS_URLS = {
  production: {
    auth: "https://login.uber.com/oauth/v2/token",
    api: "https://api.uber.com",
  },
  sandbox: {
    auth: "https://login.uber.com/oauth/v2/token",
    api: "https://api.uber.com",
  },
} as const

// === Webhook ===

export interface UberEatsWebhookEvent {
  event_id: string
  event_type: UberEatsEventType
  event_time: number
  meta: {
    resource_id: string
    resource_href: string
    status: string
    user_id?: string
  }
  resource_href: string
}

export type UberEatsEventType =
  | "orders.notification"
  | "orders.cancel"
  | "orders.scheduled"
  | "eats.order.status_update"
  | "eats.store.status_update"

// === Orders ===

export interface UberEatsOrder {
  id: string
  display_id: string
  external_reference_id?: string
  current_state: string
  type: "PICK_UP" | "DINE_IN" | "DELIVERY_BY_UBER" | "DELIVERY_BY_RESTAURANT"
  store: {
    id: string
    name: string
    external_reference_id?: string
  }
  eater: {
    first_name: string
    last_name: string
    phone?: string
    phone_code?: string
  }
  eaters?: Array<{
    first_name: string
    last_name: string
  }>
  cart: {
    items: UberEatsCartItem[]
    special_instructions?: string
    fulfillment_issues?: unknown[]
  }
  payment: {
    charges: {
      total: UberEatsMoney
      sub_total: UberEatsMoney
      tax: UberEatsMoney
      total_fee: UberEatsMoney
      delivery_fee?: UberEatsMoney
      bag_fee?: UberEatsMoney
      small_order_fee?: UberEatsMoney
      tip?: UberEatsMoney
      cash_amount_due?: UberEatsMoney
      promotions?: {
        total: UberEatsMoney
        external_promotions_total?: UberEatsMoney
      }
    }
    accounting: {
      tax_remittance: {
        tax: UberEatsMoney
        total_tax_rate?: number
      }
    }
  }
  placed_at: string
  estimated_ready_for_pickup_at?: string
  delivery_info?: {
    estimated_delivery_time?: string
  }
  packaging?: {
    disclaimer?: string
  }
  brand?: {
    id: string
    name: string
  }
}

export interface UberEatsCartItem {
  id: string
  instance_id: string
  title: string
  external_data?: string
  quantity: number
  price: UberEatsMoney
  selected_modifier_groups?: UberEatsModifierGroup[]
  special_instructions?: string
  special_requests?: string[]
}

export interface UberEatsModifierGroup {
  id: string
  title: string
  external_data?: string
  selected_items: UberEatsModifierItem[]
}

export interface UberEatsModifierItem {
  id: string
  title: string
  external_data?: string
  quantity: number
  price: UberEatsMoney
}

export interface UberEatsMoney {
  amount: number
  currency_code: string
  formatted_amount: string
}

// === Menu ===

export interface UberEatsMenu {
  menus: UberEatsMenuSection[]
}

export interface UberEatsMenuSection {
  id: string
  title: {
    translations: Record<string, string>
  }
  service_availability: UberEatsServiceAvailability[]
  category_ids: string[]
}

export interface UberEatsServiceAvailability {
  day_of_week: string
  time_periods: Array<{
    start_time: string
    end_time: string
  }>
}

export interface UberEatsCategory {
  id: string
  title: {
    translations: Record<string, string>
  }
  entities: Array<{
    id: string
    type: "ITEM"
  }>
}

export interface UberEatsItem {
  id: string
  external_data?: string
  title: {
    translations: Record<string, string>
  }
  description?: {
    translations: Record<string, string>
  }
  image_url?: string
  price_info: {
    price: number
    overrides?: Array<{
      context_type: string
      context_value: string
      price: number
    }>
  }
  tax_info?: {
    tax_rate: number
  }
  modifier_group_ids?: {
    ids: string[]
  }
  quantity_info?: {
    quantity: {
      max_permitted: number
      min_permitted: number
    }
  }
  suspension_info?: {
    suspension: {
      reason: string
      suspend_until?: number
    }
  }
  nutritional_info?: {
    calories?: {
      lower_range: number
      upper_range: number
    }
    allergens?: Array<{
      type: string
    }>
  }
}

// === Store Status ===

export type UberEatsStoreStatus = "ONLINE" | "PAUSED" | "OFFLINE"

export interface UberEatsStoreStatusUpdate {
  status: UberEatsStoreStatus
  reason?: string
}

// === Order Actions ===

export interface UberEatsAcceptOrderPayload {
  reason?: string
}

export interface UberEatsDenyOrderPayload {
  reason: {
    explanation: string
    code: UberEatsDenyReasonCode
  }
}

export type UberEatsDenyReasonCode =
  | "STORE_CLOSED"
  | "ITEM_AVAILABILITY"
  | "ITEM_ISSUE"
  | "STORE_BUSY"
  | "SPECIAL_INSTRUCTIONS"
  | "OTHER"

export interface UberEatsCancelOrderPayload {
  reason: {
    explanation: string
    code: UberEatsCancelReasonCode
  }
}

export type UberEatsCancelReasonCode =
  | "OUT_OF_ITEMS"
  | "KITCHEN_CLOSED"
  | "CUSTOMER_CALLED_TO_CANCEL"
  | "RESTAURANT_TOO_BUSY"
  | "CANNOT_COMPLETE_CUSTOMER_NOTE"
  | "OTHER"

// === Status mapping ===

export const UBER_EATS_STATUS_MAP: Record<string, string> = {
  CREATED: "pending",
  ACCEPTED: "confirmed",
  DENIED: "denied",
  IN_PROGRESS: "preparing",
  READY_FOR_PICKUP: "ready",
  PICKED_UP: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  FINISHED: "completed",
} as const
