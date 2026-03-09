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
