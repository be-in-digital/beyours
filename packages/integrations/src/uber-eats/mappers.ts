/**
 * Mappers between Uber Eats API format and unified internal format
 */

import type { UnifiedOrder, UnifiedOrderItem, UnifiedOrderModifier } from "../common/types"
import type { UberEatsOrder, UberEatsCartItem } from "./types"
import { UBER_EATS_STATUS_MAP } from "./types"
import type { UnifiedOrderStatus } from "../common/types"

/**
 * Map Uber Eats order type to unified type
 */
function mapOrderType(uberType: string): "delivery" | "pickup" | "dine_in" {
  switch (uberType) {
    case "DELIVERY_BY_UBER":
    case "DELIVERY_BY_RESTAURANT":
      return "delivery"
    case "DINE_IN":
      return "dine_in"
    case "PICK_UP":
    default:
      return "pickup"
  }
}

/**
 * Map Uber Eats status to unified status
 */
function mapStatus(uberStatus: string): UnifiedOrderStatus {
  const mapped = UBER_EATS_STATUS_MAP[uberStatus]
  return (mapped as UnifiedOrderStatus) ?? "pending"
}

/**
 * Convert Uber Eats money (cents) to standard decimal
 */
function toDecimal(amount: number): number {
  return amount / 100
}

/**
 * Map modifier items
 */
function mapModifiers(item: UberEatsCartItem): UnifiedOrderModifier[] {
  const modifiers: UnifiedOrderModifier[] = []
  if (!item.selected_modifier_groups) return modifiers

  for (const group of item.selected_modifier_groups) {
    for (const mod of group.selected_items) {
      modifiers.push({
        externalId: mod.id,
        name: mod.title,
        quantity: mod.quantity,
        price: toDecimal(mod.price.amount),
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
  const itemPrice = toDecimal(item.price.amount)

  return {
    externalId: item.id,
    name: item.title,
    quantity: item.quantity,
    unitPrice: itemPrice,
    totalPrice: (itemPrice + modifierTotal) * item.quantity,
    notes: item.special_instructions,
    modifiers,
  }
}

/**
 * Map a full Uber Eats order to unified order format
 */
export function mapUberEatsOrderToUnified(
  order: UberEatsOrder
): UnifiedOrder {
  const items = order.cart.items.map(mapCartItem)
  const charges = order.payment.charges

  return {
    externalOrderId: order.id,
    platform: "uberEats",
    storeExternalId: order.store.id,
    displayId: order.display_id,
    status: mapStatus(order.current_state),
    type: mapOrderType(order.type),
    customer: {
      name: `${order.eater.first_name} ${order.eater.last_name}`.trim(),
      phone: order.eater.phone,
    },
    items,
    delivery: order.type.includes("DELIVERY")
      ? {
          type: "delivery",
          estimatedDeliveryTime: order.delivery_info?.estimated_delivery_time,
        }
      : undefined,
    subtotal: toDecimal(charges.sub_total.amount),
    taxAmount: toDecimal(charges.tax.amount),
    deliveryFee: charges.delivery_fee
      ? toDecimal(charges.delivery_fee.amount)
      : 0,
    discountAmount: charges.promotions
      ? toDecimal(charges.promotions.total.amount)
      : 0,
    total: toDecimal(charges.total.amount),
    currency: charges.total.currency_code,
    notes: order.cart.special_instructions,
    placedAt: order.placed_at,
    rawData: JSON.stringify(order),
  }
}
