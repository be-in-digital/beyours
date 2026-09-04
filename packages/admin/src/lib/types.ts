/**
 * Shared type definitions for admin pages
 * Mirrors the Convex schema types without importing Convex directly
 */

// === Order Types ===

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"

export type OrderType = "delivery" | "pickup" | "dine_in"

export type OrderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  /**
   * A paid order was cancelled, so the money is owed back — but nothing has
   * been sent yet. Cancelling used to flip the order straight to "refunded"
   * and patch the payment rows, claiming a refund no provider had performed.
   * The order now stops here and waits for an operator to issue the real one.
   */
  | "refund_pending"

export type OrderSource = "website" | "uber_eats" | "deliveroo" | "pos"

export interface OrderItemOption {
  optionId?: string
  optionName: string
  choiceId?: string
  choiceName?: string
  priceModifier: number
}

export interface OrderItem {
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  selectedOptions: OrderItemOption[]
  subtotal: number
  notes?: string
  externalId?: string
}

export interface OrderCustomerInfo {
  name: string
  email?: string
  phone?: string
}

export interface OrderDeliveryAddress {
  street: string
  city: string
  postalCode: string
  country: string
  latitude?: number
  longitude?: number
  instructions?: string
}

/** Courier status, verbatim from Uber Direct. */
export type UberDirectStatus =
  | "SCHEDULED"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "EN_ROUTE_TO_DROPOFF"
  | "ARRIVED_AT_DROPOFF"
  | "COMPLETED"
  | "FAILED"

export interface Order {
  _id: string
  orderNumber: string
  customerId?: string
  customerInfo: OrderCustomerInfo
  type: OrderType
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  taxAmount: number
  deliveryFee?: number
  discountAmount?: number
  total: number
  deliveryAddress?: OrderDeliveryAddress
  // Uber Direct courier, present only on delivery orders that booked one.
  uberDirectEstimateId?: string
  uberDirectDeliveryId?: string
  uberDirectStatus?: UberDirectStatus
  uberDirectTrackingUrl?: string
  uberDirectFee?: number
  uberDirectStatusAt?: number
  /** Set when Uber reports a failed delivery. The order status machine
   *  forbids out_for_delivery -> cancelled, so this needs a human. */
  uberDirectFailedAt?: number
  paymentMethod?: string
  paymentStatus: OrderPaymentStatus
  source: OrderSource
  notes?: string
  estimatedPrepTime?: number
  estimatedDeliveryTime?: number
  scheduledFor?: number
  completedAt?: number
  cancelledAt?: number
  cancellationReason?: string
  createdAt: number
  updatedAt: number
}

// === Payment Types ===

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded"

export type PaymentProvider = "stripe" | "sumup" | "paypal" | "square" | "cash"

/**
 * Health of a store's connection to a payment provider.
 *
 * Mirrors the `status` union of the `paymentConnections` table in
 * `@be-in-digital/convex-schema`, which documents each value. The one that is
 * easy to get wrong: `onboarding_complete` means the provider account exists
 * and onboarding finished, but charges are NOT routed to it — it is not a
 * success and not a failure, and it must never be rendered as either.
 */
export type PaymentConnectionStatus =
  | "connected"
  | "onboarding_complete"
  | "disconnected"
  | "error"

export interface PaymentMetadata {
  last4?: string
  brand?: string
  receiptUrl?: string
}

export interface Payment {
  _id: string
  storeId: string
  orderId: string
  amount: number
  currency: string
  provider: PaymentProvider
  status: PaymentStatus
  externalId?: string
  refundedAmount?: number
  refundReason?: string
  metadata?: PaymentMetadata
  createdAt: number
  updatedAt: number
}

// === Badge Variant Type ===

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline"
