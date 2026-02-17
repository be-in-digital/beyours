/**
 * Deliveroo API types
 * Based on Deliveroo Partner API
 */

// === Authentication ===

export interface DeliverooCredentials {
  clientId: string
  clientSecret: string
  sandboxMode?: boolean
}

export interface DeliverooToken {
  accessToken: string
  expiresAt: number
}

// === API URLs ===

export const DELIVEROO_URLS = {
  production: {
    auth: "https://auth.developers.deliveroo.com",
    orderApi: "https://api.developers.deliveroo.com",
    menuApi: "https://api.developers.deliveroo.com",
    siteApi: "https://api.developers.deliveroo.com",
  },
  sandbox: {
    auth: "https://auth.developers.deliveroo.com",
    orderApi: "https://api-sandbox.developers.deliveroo.com",
    menuApi: "https://api-sandbox.developers.deliveroo.com",
    siteApi: "https://api-sandbox.developers.deliveroo.com",
  },
} as const

export type DeliverooApiType = "order" | "menu" | "site"

// === Menu types ===

export interface DeliverooMenuListResponse {
  menus: DeliverooMenuSummary[]
}

export interface DeliverooMenuSummary {
  id: string
  name?: string
}

export interface DeliverooMenuResponse {
  categories: DeliverooCategory[]
  items: DeliverooMenuItem[]
  modifier_groups?: DeliverooModifierGroup[]
}

export interface DeliverooCategory {
  id: string
  name: string
  item_ids?: string[]
}

export interface DeliverooMenuItem {
  id: string
  name: string
  description?: string
  image_url?: string
  price: DeliverooPrice
  modifier_group_ids?: string[]
}

export interface DeliverooModifierGroup {
  id: string
  name: string
  modifiers: DeliverooModifierItem[]
}

export interface DeliverooModifierItem {
  id: string
  name: string
  price?: DeliverooPrice
}

export interface DeliverooPrice {
  fractional: number
  currency_code: string
}

// === V2 Menu fallback ===

export interface DeliverooMenuV2Response {
  categories: DeliverooCategory[]
  items: DeliverooMenuItem[]
  modifier_groups?: DeliverooModifierGroup[]
}

// === Webhook types ===

export interface DeliverooOrderWebhook {
  event_type: "order.created" | "order.updated" | "order.cancelled"
  event_id: string
  timestamp: string
  order: DeliverooWebhookOrder
}

export interface DeliverooWebhookOrder {
  order: {
    id: string
    site_id: string
    brand_id: string
    status: string
    order_type: "delivery" | "collection"
    created_at: string
    updated_at: string
    customer: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
    }
    delivery_address?: {
      address_line_1?: string
      address_line_2?: string
      city?: string
      postcode?: string
      country?: string
      latitude?: number
      longitude?: number
    }
    delivery_instructions?: string
    items: Array<{
      id: string
      name: string
      quantity: number
      price: DeliverooPrice
      options?: Array<{
        id?: string
        name: string
        price?: DeliverooPrice
      }>
      notes?: string
    }>
    payment: {
      subtotal: DeliverooPrice
      tax?: DeliverooPrice
      delivery_fee?: DeliverooPrice
      total: DeliverooPrice
    }
    notes?: string
  }
}

export interface DeliverooMenuWebhook {
  event_type: "menu.upload_completed" | "menu.upload_failed" | "menu.validation_error"
  event_id: string
  timestamp: string
  brand_id: string
  site_id?: string
  menu_id?: string
  error?: {
    code: string
    message: string
  }
}
