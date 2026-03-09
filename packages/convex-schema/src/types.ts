import { z } from 'zod'
import {
  createGlobalSettingsSchema,
  updateGlobalSettingsSchema,
  createStoreSchema,
  updateStoreSchema,
  createStoreIntegrationSchema,
  updateStoreIntegrationSchema,
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  createMenuSchema,
  updateMenuSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createKitchenTicketSchema,
  updateKitchenTicketStatusSchema,
  createPrinterSettingsSchema,
  updatePrinterSettingsSchema,
  createPaymentSchema,
  refundPaymentSchema,
  createLanguageSchema,
  updateLanguageSchema,
  createTranslationSchema,
  batchTranslateSchema,
  createTeamMemberSchema,
  updateTeamMemberSchema,
  inviteTeamMemberSchema,
  createGameQRCodeSchema,
  createRequiredActionSchema,
  createGameSchema,
  updateGameWinRatioSchema,
  createPrizeSchema,
  playGameSchema,
  redeemPrizeSchema,
  createUserProfileSchema,
  updateUserProfileSchema,
} from './validators'

/**
 * BeInDigital Engine - TypeScript Types
 *
 * Inferred types from Zod schemas for type-safe development
 */

// ============================================================================
// GLOBAL SETTINGS TYPES
// ============================================================================

export type CreateGlobalSettingsInput = z.infer<typeof createGlobalSettingsSchema>
export type UpdateGlobalSettingsInput = z.infer<typeof updateGlobalSettingsSchema>

export type GlobalServices = {
  dineIn: boolean
  takeaway: boolean
  delivery: boolean
  clickAndCollect: boolean
}

export type GlobalDeliverySettings = {
  feeMode?: "fixed" | "percentage"
  fee?: number
  percentage?: number
  maxFee?: number
  freeAbove?: number
  radius?: number
}

export type GlobalIntegrations = {
  uberDirect?: {
    customerId?: string
    clientId?: string
    clientSecret?: string
    enabled: boolean
  }
  uberEats?: {
    enabled: boolean
  }
  deliveroo?: {
    clientId?: string
    clientSecret?: string
    webhookSecret?: string
    merchantId?: string
    sandboxMode?: boolean
    enabled: boolean
  }
}

// ============================================================================
// STORE TYPES
// ============================================================================

export type CreateStoreInput = z.infer<typeof createStoreSchema>
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>

export type StoreStatus = 'draft' | 'open' | 'closed' | 'temporarily_unavailable'

export type StoreOverrides = {
  services?: {
    dineIn: boolean
    takeaway: boolean
    delivery: boolean
    clickAndCollect: boolean
  }
  minimumOrderAmount?: number
  deliveryRadius?: number
  deliveryFee?: number
  deliveryFreeAbove?: number
}

// ============================================================================
// STORE INTEGRATION TYPES
// ============================================================================

export type CreateStoreIntegrationInput = z.infer<typeof createStoreIntegrationSchema>
export type UpdateStoreIntegrationInput = z.infer<typeof updateStoreIntegrationSchema>

export type IntegrationPlatform = 'uberEats' | 'deliveroo'

export type StoreIntegrationStatus = 'ONLINE' | 'PAUSED' | 'OFFLINE'
export type MenuSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

export type ProductSource = 'manual' | 'uber_eats' | 'deliveroo'

export type ExternalIds = {
  uberEatsId?: string
  deliverooId?: string
}

export type ProductOption = {
  id: string
  name: string
  required: boolean
  maxSelections?: number
  externalIds?: ExternalIds
  choices: ProductChoice[]
}

export type ProductChoice = {
  id: string
  name: string
  priceModifier: number
  externalIds?: ExternalIds
}

export type ProductStock = {
  tracked: boolean
  quantity: number
  lowStockThreshold: number
  autoDisableWhenEmpty?: boolean
}

export type ProductScheduling = {
  availableFrom?: string
  availableUntil?: string
  availableDays?: number[]
}

export type ProductNutritionalInfo = {
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  fiber?: number
}

export type ProductExternalIds = ExternalIds

export type PlatformOverride = {
  price?: number
  isActive?: boolean
  lastSyncedAt?: number
  syncError?: string
}

export type ProductPlatformOverrides = {
  uberEats?: PlatformOverride
  deliveroo?: PlatformOverride
}

// ============================================================================
// MENU TYPES
// ============================================================================

export type CreateMenuInput = z.infer<typeof createMenuSchema>
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>

export type MenuPlatformVisibility = {
  uberEats?: boolean
  deliveroo?: boolean
}

// ============================================================================
// ORDER TYPES
// ============================================================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

export type OrderType = 'delivery' | 'pickup' | 'dine_in'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export type OrderSource = 'website' | 'uber_eats' | 'deliveroo' | 'pos'

export type OrderItem = {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  selectedOptions: SelectedOption[]
  subtotal: number
  notes?: string
}

export type SelectedOption = {
  optionId: string
  optionName: string
  choiceId: string
  choiceName: string
  priceModifier: number
}

export type CustomerInfo = {
  name: string
  email?: string
  phone?: string
}

export type DeliveryAddress = {
  street: string
  city: string
  postalCode: string
  country: string
  latitude?: number
  longitude?: number
  instructions?: string
}

// ============================================================================
// KITCHEN TYPES
// ============================================================================

export type CreateKitchenTicketInput = z.infer<typeof createKitchenTicketSchema>
export type UpdateKitchenTicketStatusInput = z.infer<typeof updateKitchenTicketStatusSchema>

export type KitchenTicketStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled'

export type KitchenTicketPriority = 'normal' | 'urgent' | 'vip'

export type KitchenTicketItem = {
  productName: string
  quantity: number
  options: string[]
  notes?: string
}

// ============================================================================
// PRINTER TYPES
// ============================================================================

export type CreatePrinterSettingsInput = z.infer<typeof createPrinterSettingsSchema>
export type UpdatePrinterSettingsInput = z.infer<typeof updatePrinterSettingsSchema>

export type PrinterType = 'network' | 'usb' | 'bluetooth'

export type PrinterConnectionInfo = {
  ipAddress?: string
  port?: number
  usbVendorId?: string
  usbProductId?: string
}

export type PaperWidth = 58 | 80

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>

export type PaymentProvider = 'stripe' | 'sumup' | 'paypal' | 'square' | 'cash'

export type PaymentProviderStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'

export type PaymentMetadata = {
  last4?: string
  brand?: string
  receiptUrl?: string
}

// ============================================================================
// LANGUAGE & TRANSLATION TYPES
// ============================================================================

export type CreateLanguageInput = z.infer<typeof createLanguageSchema>
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>

export type CreateTranslationInput = z.infer<typeof createTranslationSchema>
export type BatchTranslateInput = z.infer<typeof batchTranslateSchema>

export type TranslationJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

// ============================================================================
// TEAM TYPES
// ============================================================================

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>

export type TeamMemberRole = 'manager' | 'kitchen' | 'waiter' | 'delivery'

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

// ============================================================================
// USER PROFILE TYPES
// ============================================================================

export type CreateUserProfileInput = z.infer<typeof createUserProfileSchema>
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>

export type UserRole =
  | 'super_admin'
  | 'client_admin'
  | 'manager'
  | 'kitchen'
  | 'waiter'
  | 'delivery'
  | 'customer'

// ============================================================================
// GAMIFICATION TYPES
// ============================================================================

export type CreateGameQRCodeInput = z.infer<typeof createGameQRCodeSchema>
export type CreateRequiredActionInput = z.infer<typeof createRequiredActionSchema>
export type CreateGameInput = z.infer<typeof createGameSchema>
export type UpdateGameWinRatioInput = z.infer<typeof updateGameWinRatioSchema>
export type CreatePrizeInput = z.infer<typeof createPrizeSchema>
export type PlayGameInput = z.infer<typeof playGameSchema>
export type RedeemPrizeInput = z.infer<typeof redeemPrizeSchema>

export type GameType = 'wheel' | 'scratch_card'

export type RequiredActionType =
  | 'google_review'
  | 'instagram_follow'
  | 'facebook_like'
  | 'tiktok_follow'
  | 'email_subscribe'

export type PrizeType =
  | 'discount_percentage'
  | 'discount_fixed'
  | 'free_product'
  | 'free_menu'
  | 'custom'

export type PrizeRedemptionStatus = 'pending' | 'redeemed' | 'expired' | 'cancelled'

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Base entity with timestamps
 */
export type BaseEntity = {
  _id: string
  _creationTime: number
  createdAt: number
  updatedAt: number
}

/**
 * Address type used across multiple entities
 */
export type Address = {
  street: string
  city: string
  postalCode: string
  country: string
  latitude?: number
  longitude?: number
}

/**
 * Business hours for a specific day
 */
export type BusinessHours = {
  day: number // 0=Sunday, 6=Saturday
  open: string // "HH:mm"
  close: string // "HH:mm"
  isClosed: boolean
}

/**
 * Pagination parameters
 */
export type PaginationParams = {
  limit?: number
  cursor?: string
}

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc'

/**
 * Filter params for queries
 */
export type FilterParams<T> = {
  [K in keyof T]?: T[K] | T[K][]
}

// ============================================================================
// CONVEX DOCUMENT TYPES (with _id and _creationTime)
// ============================================================================

/**
 * Full document types as stored in Convex
 * These include the Convex-generated fields: _id, _creationTime
 */

export type GlobalSettingsDoc = BaseEntity & CreateGlobalSettingsInput

export type StoreDoc = BaseEntity & CreateStoreInput & {
  status: StoreStatus
  themeId?: string
}

export type StoreIntegrationDoc = BaseEntity & CreateStoreIntegrationInput & {
  lastSyncAt?: number
}

export type CategoryDoc = BaseEntity & CreateCategoryInput & {
  parentId?: string
}

export type ProductDoc = BaseEntity & CreateProductInput & {
  externalIds?: ProductExternalIds
  platformOverrides?: ProductPlatformOverrides
}

export type MenuDoc = BaseEntity & CreateMenuInput

export type OrderDoc = BaseEntity & CreateOrderInput & {
  orderNumber: string
  customerId?: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  source: OrderSource
  subtotal: number
  taxAmount: number
  deliveryFee?: number
  deliveryFeeMode?: "fixed" | "percentage"
  uberDirectEstimateId?: string
  uberDirectFee?: number
  discountAmount?: number
  total: number
  estimatedPrepTime?: number
  estimatedDeliveryTime?: number
  scheduledFor?: number
  completedAt?: number
  cancelledAt?: number
  cancellationReason?: string
}

export type KitchenTicketDoc = BaseEntity & CreateKitchenTicketInput & {
  status: KitchenTicketStatus
  assignedTo?: string
  startedAt?: number
  completedAt?: number
  printCount?: number
}

export type PrinterSettingsDoc = BaseEntity & CreatePrinterSettingsInput & {
  isDefault: boolean
  isOnline: boolean
  lastSeenAt?: number
}

export type PaymentDoc = BaseEntity & CreatePaymentInput & {
  status: PaymentProviderStatus
  refundedAmount?: number
  refundReason?: string
}

export type LanguageDoc = BaseEntity & CreateLanguageInput & {
  isActive: boolean
}

export type TranslationDoc = BaseEntity & CreateTranslationInput

export type TranslationJobDoc = BaseEntity & BatchTranslateInput & {
  totalItems: number
  completedItems: number
  status: TranslationJobStatus
  error?: string
}

export type TeamMemberDoc = BaseEntity & CreateTeamMemberInput & {
  invitationToken?: string
  invitedAt?: number
}

export type UserProfileDoc = BaseEntity & CreateUserProfileInput & {
  twoFactorEnabled: boolean
}

export type GameQRCodeDoc = BaseEntity & CreateGameQRCodeInput & {
  scannedCount: number
  lastScannedAt?: number
}

export type RequiredActionDoc = BaseEntity & CreateRequiredActionInput & {
  isActive: boolean
}

export type GameDoc = BaseEntity & CreateGameInput & {
  config?: {
    wheelSections?: Array<{
      label: string
      color: string
      prizeId?: string
    }>
    scratchCardDesign?: string
  }
}

export type PrizeDoc = BaseEntity & CreatePrizeInput & {
  remainingCount?: number
}

export type GamePlayDoc = BaseEntity & PlayGameInput & {
  didWin: boolean
  prizeId?: string
  ipAddress?: string
  userAgent?: string
  playedAt: number
}

export type PrizeRedemptionDoc = BaseEntity & {
  storeId: string
  gamePlayId: string
  prizeId: string
  playerEmail: string
  playerName: string
  redemptionCode: string
  status: PrizeRedemptionStatus
  redeemedAt?: number
  redeemedBy?: string
  expiresAt: number
}

export type ExternalProductMappingDoc = BaseEntity & {
  storeId: string
  platform: IntegrationPlatform
  internalProductId: string
  externalId: string
  externalName?: string
  externalPrice?: number
  lastSyncAt: number
}

export type OrphanProductDoc = BaseEntity & {
  storeId: string
  platform: IntegrationPlatform
  externalId: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  rawData: string
  status: 'pending' | 'matched' | 'ignored'
  matchedProductId?: string
}

// ============================================================================
// AUTO BLOG TYPES
// ============================================================================

export type AutoBlogPlan = "starter" | "pro" | "enterprise"

export type AutoBlogEntitlement = {
  enabled: boolean
  plan?: AutoBlogPlan // undefined = no plan
  monthlyQuota: number
  maxTopics?: number // undefined = unlimited
  allowMultiLanguage: boolean
  allowAutoPublish: boolean
}

export type BlogAutoConfigFrequency = "weekly" | "monthly"
export type BlogAutoConfigTone = "formel" | "decontracte" | "storytelling"
export type BlogAutoConfigApprovalMode = "draft_review" | "auto_publish"

export type BlogAutoQueueStatus =
  | "pending"
  | "generating"
  | "draft_created"
  | "published"
  | "failed"
  | "cancelled"

export type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
