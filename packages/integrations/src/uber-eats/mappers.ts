/**
 * Mappers between Uber Eats API format and unified internal format
 * Supports both standard (V1) and simplified (V2) response formats
 */

import type { UnifiedOrder, UnifiedOrderItem, UnifiedOrderModifier } from "../common/types"
import type { UberEatsOrder, UberEatsCartItem, UberEatsMoney } from "./types"
import { UBER_EATS_STATUS_MAP } from "./types"
import type { UnifiedOrderStatus } from "../common/types"

/**
 * Map Uber Eats order type to unified type
 */
function mapOrderType(uberType: string): "delivery" | "pickup" | "dine_in" {
  switch (uberType) {
    case "DELIVERY_BY_UBER":
    case "DELIVERY_BY_RESTAURANT":
    case "DELIVERY":
      return "delivery"
    case "DINE_IN":
      return "dine_in"
    case "PICK_UP":
    case "PICKUP":
    default:
      return "pickup"
  }
}

/**
 * Map Uber Eats status to unified status
 */
function mapStatus(uberStatus: string): UnifiedOrderStatus {
  const normalizedStatus = uberStatus.toLowerCase()
  const mapped = UBER_EATS_STATUS_MAP[uberStatus] ?? UBER_EATS_STATUS_MAP[normalizedStatus]
  return (mapped as UnifiedOrderStatus) ?? "pending"
}

/**
 * Convert Uber Eats money (cents) to standard decimal
 * Safely handles undefined/null/string values
 */
function toDecimal(amount: number | string | undefined | null): number {
  if (amount == null) return 0
  if (typeof amount === "string") return parseFloat(amount) / 100
  return amount / 100
}

/**
 * Extract price from various Uber Eats price formats
 * Handles: UberEatsMoney object, string (cents), undefined
 */
function extractPrice(price: UberEatsMoney | string | { amount?: number } | undefined | null): number {
  if (price == null) return 0
  if (typeof price === "string") return parseFloat(price) / 100
  if (typeof price === "object" && "amount" in price && price.amount != null) {
    return toDecimal(price.amount)
  }
  return 0
}

/**
 * Map modifier items - supports both V1 and V2 formats
 */
function mapModifiers(item: UberEatsCartItem): UnifiedOrderModifier[] {
  const modifiers: UnifiedOrderModifier[] = []

  // Standard format: selected_modifier_groups
  if (item.selected_modifier_groups) {
    for (const group of item.selected_modifier_groups) {
      // V1 format uses selected_items, V2 uses selected_modifier_options
      const options = group.selected_items ?? group.selected_modifier_options
      if (!options) continue
      for (const mod of options) {
        modifiers.push({
          externalId: mod.id ?? "",
          name: mod.title ?? "Modifier",
          quantity: mod.quantity ?? 1,
          price: extractPrice(mod.price),
        })
      }
    }
  }

  // V2 simplified format: selected_options
  if (item.selected_options) {
    for (const opt of item.selected_options) {
      modifiers.push({
        externalId: opt.option_id ?? "",
        name: opt.name ?? opt.title ?? "Option",
        quantity: 1,
        price: opt.price ? parseFloat(opt.price) / 100 : 0,
      })
    }
  }

  return modifiers
}

/**
 * Map a single cart item to unified format
 */
function mapCartItem(item: UberEatsCartItem): UnifiedOrderItem {
  const modifiers = mapModifiers(item)
  const modifierTotal = modifiers.reduce(
    (sum, m) => sum + m.price * m.quantity,
    0
  )
  const itemPrice = extractPrice(item.price)

  return {
    externalId: item.id ?? item.item_id ?? "",
    name: item.title ?? item.name ?? "Article",
    quantity: item.quantity ?? 1,
    unitPrice: itemPrice,
    totalPrice: (itemPrice + modifierTotal) * (item.quantity ?? 1),
    notes: item.special_instructions
      ?? item.customer_request?.special_instructions
      ?? (item.customer_request?.allergy?.instructions
        ? `Allergie: ${item.customer_request.allergy.instructions}`
        : undefined),
    modifiers,
  }
}

/**
 * Extract customer info from various Uber Eats formats
 */
function extractCustomer(order: UberEatsOrder): { name: string; phone?: string } {
  // V2 simplified: eater_info
  if (order.eater_info) {
    const first = order.eater_info.first_name ?? ""
    const last = order.eater_info.last_name ?? ""
    return {
      name: `${first} ${last}`.trim() || "Client Uber Eats",
      phone: order.eater_info.phone,
    }
  }

  // V2 standard: eaters array
  if (order.eaters?.[0]) {
    const eater = order.eaters[0]
    const first = eater.first_name ?? ""
    const last = eater.last_name ?? ""
    const phone = eater.phone
      ? `${eater.phone_code ?? ""}${eater.phone}`
      : undefined
    return {
      name: `${first} ${last}`.trim() || "Client Uber Eats",
      phone,
    }
  }

  // V1: single eater object
  if (order.eater) {
    const first = order.eater.first_name ?? ""
    const last = order.eater.last_name ?? ""
    return {
      name: `${first} ${last}`.trim() || "Client Uber Eats",
      phone: order.eater.phone,
    }
  }

  return { name: "Client Uber Eats" }
}

/**
 * Extract charges from order - supports both object and array formats
 */
function extractCharges(order: UberEatsOrder): {
  subtotal: number
  taxAmount: number
  deliveryFee: number
  discountAmount: number
  total: number
  currency: string
} {
  // V2 simplified format: charges as array
  if (Array.isArray(order.charges)) {
    let subtotal = 0
    let taxAmount = 0
    let deliveryFee = 0
    let discountAmount = 0
    let total = 0

    for (const charge of order.charges) {
      const amount = parseFloat(charge.price) / 100
      switch (charge.charge_type) {
        case "subtotal":
          subtotal = amount
          break
        case "tax":
          taxAmount = amount
          break
        case "promo":
          discountAmount = amount
          break
        case "delivery_fee":
          deliveryFee = amount
          break
        case "total":
          total = amount
          break
      }
    }

    if (total === 0) {
      total = subtotal + taxAmount + deliveryFee - discountAmount
    }

    return { subtotal, taxAmount, deliveryFee, discountAmount, total, currency: "EUR" }
  }

  // Standard format: payment.charges object
  const charges = order.payment?.charges
  if (!charges) {
    return { subtotal: 0, taxAmount: 0, deliveryFee: 0, discountAmount: 0, total: 0, currency: "EUR" }
  }

  // Handle promotions which can be either flat UberEatsMoney or nested { total: UberEatsMoney }
  let discountAmount = 0
  if (charges.promotions) {
    if ("total" in charges.promotions && typeof charges.promotions.total === "object") {
      // Nested format: { total: UberEatsMoney }
      discountAmount = extractPrice(charges.promotions.total)
    } else {
      // Flat format: UberEatsMoney directly
      discountAmount = extractPrice(charges.promotions as UberEatsMoney)
    }
  }

  return {
    subtotal: extractPrice(charges.sub_total) || extractPrice(charges.total),
    taxAmount: extractPrice(charges.tax),
    deliveryFee: extractPrice(charges.delivery_fee),
    discountAmount,
    total: extractPrice(charges.total),
    currency: (charges.total as UberEatsMoney)?.currency_code ?? "EUR",
  }
}

/**
 * Map a full Uber Eats order to unified order format
 * Supports both standard and simplified V2 API response formats
 */
export function mapUberEatsOrderToUnified(
  order: UberEatsOrder
): UnifiedOrder {
  // Items can be in cart.items (standard) or order_items (simplified)
  const rawItems = order.order_items ?? order.cart?.items ?? []
  const items = rawItems.map(mapCartItem)

  const customer = extractCustomer(order)
  const pricing = extractCharges(order)

  const storeExternalId = order.store?.id ?? order.store_id ?? ""
  const displayId = order.display_id ?? order.order_num ?? order.id

  return {
    externalOrderId: order.id,
    platform: "uberEats",
    storeExternalId,
    displayId,
    status: mapStatus(order.current_state ?? "CREATED"),
    type: mapOrderType(order.type ?? "PICK_UP"),
    customer,
    items,
    delivery: order.type?.includes("DELIVERY")
      ? {
          type: "delivery",
          estimatedDeliveryTime: order.delivery_info?.estimated_delivery_time,
          address: order.delivery_info?.address
            ? {
                street: order.delivery_info.address.address_line_1 ?? "",
                city: order.delivery_info.address.city,
                postalCode: order.delivery_info.address.postal_code,
                country: order.delivery_info.address.country,
              }
            : undefined,
        }
      : undefined,
    subtotal: pricing.subtotal,
    taxAmount: pricing.taxAmount,
    deliveryFee: pricing.deliveryFee,
    discountAmount: pricing.discountAmount,
    total: pricing.total,
    currency: pricing.currency,
    notes: order.cart?.special_instructions
      ?? order.delivery_info?.notes
      ?? order.specialInstructions,
    placedAt: order.created_time
      ?? order.placed_at
      ?? new Date().toISOString(),
    rawData: JSON.stringify(order),
  }
}
