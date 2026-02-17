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
