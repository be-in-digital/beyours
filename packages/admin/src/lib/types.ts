/**
 * Shared type definitions for admin pages
 * Mirrors the Convex schema types without importing Convex directly
 * (type-only imports from the engine are fine — they are erased at build).
 */

import type { InvoiceRefusal } from "@be-in-digital/convex-functions/invoices"

/**
 * Kitchen tickets.
 *
 * Lifted here with the KDS itself: the screen used to live in both apps and
 * read these types from `apps/*\/lib/admin/types.ts`, so a schema change had
 * to be made in three places. Ids are plain strings — this file mirrors the
 * schema without importing Convex, so the package stays buildable on its own.
 */

export type TicketItem = {
  productName: string
  quantity: number
  options: string[]
  notes?: string
}

export type TicketStatus = "pending" | "in_progress" | "ready" | "completed" | "cancelled"
export type TicketSource = "website" | "uber_eats" | "deliveroo" | "pos"
export type TicketOrderType = "delivery" | "pickup" | "dine_in"
export type TicketPriority = "normal" | "urgent" | "vip"
/**
 * `printing` is a claim held by one tablet, not a state the kitchen cares
 * about: two screens on the same pass both read `pending` and both printed
 * the slip, so a ticket is now taken before it is rendered (#164).
 */
export type TicketPrintStatus =
  | "pending"
  | "printing"
  | "printed"
  | "failed"
  | "not_required"

export type KitchenTicket = {
  _id: string
  _creationTime: number
  storeId: string
  orderId: string
  station?: string
  status: TicketStatus
  priority: TicketPriority
  items: TicketItem[]
  assignedTo?: string
  estimatedPrepTime?: number
  source: TicketSource
  orderNumber: string
  orderType: TicketOrderType
  startedAt?: number
  readyAt?: number
  completedAt?: number
  pickedUpAt?: number
  cancelledAt?: number
  trackingToken: string
  estimatedReadyAt?: number
  customerName?: string
  customerPhone?: string
  /** Dine-in only: the table the order is served to. */
  tableNumber?: string
  deliveryNotes?: string
  allergens?: string[]
  printStatus: TicketPrintStatus
  printAttempts: number
  printRequestedAt?: number
  printClaimedAt?: number
  printTrigger?: "confirmed" | "ready" | "reprint"
  lastPrintAt?: number
  printFailedAt?: number
  lastPrintError?: string
  printCount?: number
  createdAt: number
  updatedAt: number
}

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

/**
 * Why a paid order carries no invoice — the engine's own union, re-exported
 * so it cannot drift from what `orderInvoiceSurface` actually reports.
 */
export type InvoiceRefusalReason = InvoiceRefusal

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
  /** Dine-in only: the table the diner typed at checkout. */
  tableNumber?: string
  /**
   * From `orderInvoiceSurface`, spread onto the order by `orders.getById`:
   * the issued invoice's number, or the reason none exists (#375). Optional
   * because other order queries (`list`, `recent`) return the raw document.
   */
  invoiceNumber?: string | null
  invoiceRefusal?: InvoiceRefusalReason | null
  notes?: string
  estimatedPrepTime?: number
  estimatedDeliveryTime?: number
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
