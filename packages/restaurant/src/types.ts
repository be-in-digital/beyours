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
} from '@be-yours/convex-schema'

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
  /**
   * The dish this line is, when the line is a dish.
   *
   * OPTIONAL SINCE #352, and that is the whole shape change. A *formule* — the
   * fixed-price bundle the `menus` table holds — is one cart line with no
   * single product behind it; `menu` below carries what was composed. Exactly
   * one of `productId` and `menu` is set on any line.
   *
   * It was required, so every read of it is now forced to say what it means for
   * a formule. That is deliberate: a formule silently reading as a product with
   * an empty id is how a bundle reaches the kitchen as nothing.
   */
  productId?: string
  /** Set on a *formule* line, and never together with `productId`. */
  menu?: CartMenuSelection
  name: string
  price: number // in cents, tax included
  quantity: number
  options: CartSelectedOption[]
  imageUrl?: string
  /**
   * The product's own VAT rate, e.g. 10.
   *
   * Carried so the summary can declare the same tax the receipt will: a basket
   * mixing food at 10 % and alcohol at 20 % has no single rate, and a page that
   * guessed one would print a figure the order contradicts. Absent on a line
   * added before this field existed, or by a card with no product behind it —
   * the deployment-wide rate applies then.
   */
  taxRate?: number
  /**
   * The product's category.
   *
   * Carried for the same reason as the rate: a promotion scoped to a category
   * has to be resolvable on the client too, or the summary shows a discount the
   * order will not grant. Absent on a line added before this field.
   */
  categoryId?: string
}

/**
 * A *formule* the customer composed, as the cart holds it.
 *
 * The DISHES are here and the PRICES are not. `price` on the line is the
 * formule's fixed price, read from the `menus` row; how that price is split
 * across the chosen dishes is decided server-side by `allocateBundlePrice`, and
 * a client that computed shares would be a second implementation of a VAT rule.
 */
export interface CartMenuSelection {
  menuId: string
  /**
   * What was chosen, in section order.
   *
   * `sectionLabel` and `productName` are carried for rendering the cart line
   * without a second query. The server re-reads every product and re-resolves
   * every section from the `menus` row, so neither is trusted.
   */
  choices: CartMenuChoice[]
}

export interface CartMenuChoice {
  sectionId: string
  sectionLabel: string
  productId: string
  productName: string
  quantity: number
  options?: CartSelectedOption[]
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
  /**
   * The establishment's timezone, for `availableOnly`.
   *
   * A serving window is the kitchen's, not the visitor's: without this the
   * late menu is filtered out on the clock of whoever is browsing.
   */
  timeZone?: string
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
