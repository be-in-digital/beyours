/**
 * BeYours Engine - Restaurant Package Types
 *
 * Business logic types for the restaurant application
 * Re-exports types from convex-schema and defines additional business types
 */

// Re-export relevant types from convex-schema
export type {
  // Store types
  StoreDoc,
  StoreStatus,
  StoreOverrides,
  Address,
  BusinessHours,

  // Product types
  ProductDoc,
  ProductOption,
  ProductChoice,
  ProductStock,
  ProductScheduling,
  ProductNutritionalInfo,

  // Category types
  CategoryDoc,

  // Menu types
  MenuDoc,
  MenuPlatformVisibility,

  // Order types
  OrderDoc,
  OrderItem,
  OrderType,
  OrderStatus,
  CustomerInfo,
  DeliveryAddress,
  OrderSource,
  PaymentStatus,
  SelectedOption,

  // Kitchen types
  KitchenTicketDoc,
  KitchenTicketStatus,
  KitchenTicketPriority,
  KitchenTicketItem,

  // Base types
  BaseEntity,
} from '@be-in-digital/convex-schema'

// ============================================================================
// CART TYPES
// ============================================================================

/**
 * Cart item with product information and selected options
 */
export interface CartItem {
  /**
   * Identity of a *line*, not of a product.
   *
   * One pizza with extra cheese and one plain are two lines of the same
   * product. Everything that acts on a line — the bin, the +/− buttons, the
   * React key — has to name the line; keyed on `productId`, "+" on one raised
   * both and the bin emptied both.
   *
   * Derived from the product and its chosen options, so it survives a reload:
   * see `cartLineId` in `services/cart`.
   */
  lineId: string
  productId: string
  name: string
  price: number // in cents
  quantity: number
  options: CartSelectedOption[]
  imageUrl?: string
}

/**
 * What a caller hands to `addItem`.
 *
 * The line's identity is the store's to assign — a caller that invented one
 * could split a line that should merge, or merge two that should not.
 */
export type NewCartItem = Omit<CartItem, 'lineId'>

/**
 * Selected option in cart (simplified from OrderItem options)
 */
export interface CartSelectedOption {
  name: string
  choice: string
  priceModifier: number // in cents
}

/**
 * Cart summary with calculated totals
 */
export interface CartSummary {
  subtotal: number // in cents
  tax: number // in cents
  deliveryFee: number // in cents
  total: number // in cents
  itemCount: number
}

// ============================================================================
// STORE HOURS STATUS
// ============================================================================

/**
 * Store hours status for UI display
 */
export interface StoreHoursStatus {
  isOpen: boolean
  nextChange: Date | null
  currentPeriod?: { open: string; close: string }
}

// ============================================================================
// PRODUCT FILTERS
// ============================================================================

/**
 * Product filter parameters for searching and filtering
 */
export interface ProductFilters {
  categoryId?: string
  search?: string
  allergens?: string[] // exclude products with these allergens
  minPrice?: number // in cents
  maxPrice?: number // in cents
  availableOnly?: boolean
}

/**
 * Product sort options
 */
export type ProductSortBy = 'name' | 'price' | 'popular'

// ============================================================================
// KITCHEN TICKET INPUT
// ============================================================================

/**
 * Kitchen ticket creation input (from OrderDoc)
 */
export interface KitchenTicketInput {
  storeId: string
  orderId: string
  station?: string
  priority: 'normal' | 'urgent' | 'vip'
  items: Array<{
    productName: string
    quantity: number
    options: string[]
    notes?: string
  }>
  orderNumber: string
  orderType: 'delivery' | 'pickup' | 'dine_in'
  source: 'website' | 'uber_eats' | 'deliveroo' | 'pos'
  estimatedPrepTime?: number
}
