import { z } from "zod"

/**
 * BeInDigital Engine - Zod Validators
 *
 * Input validation schemas for all Convex mutations and API endpoints
 * All validators enforce strict type checking and business rules
 */

// ============================================================================
// GLOBAL SETTINGS VALIDATORS
// ============================================================================

/**
 * Create Global Settings Schema
 * Validates global defaults that all stores inherit
 */
export const createGlobalSettingsSchema = z.object({
  currency: z.string().default("EUR"),
  timezone: z.string().default("Europe/Paris"),
  taxRate: z.number().min(0).max(100, "Le taux de taxe doit etre entre 0 et 100").default(20),
  services: z.object({
    dineIn: z.boolean().default(false),
    takeaway: z.boolean().default(true),
    delivery: z.boolean().default(false),
    clickAndCollect: z.boolean().default(false),
  }).default({}),
  minimumOrderAmount: z.number().min(0, "Le montant minimum doit etre positif").optional(),
  hours: z.array(z.object({
    day: z.number().min(0).max(6),
    open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    isClosed: z.boolean(),
  })).default([]),
  delivery: z.object({
    feeMode: z.enum(["fixed", "percentage"]).optional().default("fixed"),
    fee: z.number().min(0, "Les frais de livraison doivent etre positifs").optional(),
    percentage: z.number().min(1).max(100).optional(),
    maxFee: z.number().min(0, "Le plafond doit etre positif").optional(),
    freeAbove: z.number().min(0, "Le montant minimum pour livraison gratuite doit etre positif").optional(),
    radius: z.number().min(0, "Le rayon de livraison doit etre positif").optional(),
  }).default({}),
  integrations: z.object({
    uberDirect: z.object({
      customerId: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      enabled: z.boolean().default(true),
    }).optional(),
    uberEats: z.object({
      enabled: z.boolean().default(true),
    }).optional(),
    deliveroo: z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      webhookSecret: z.string().optional(),
      merchantId: z.string().optional(),
      sandboxMode: z.boolean().optional(),
      enabled: z.boolean().default(true),
    }).optional(),
  }).default({}),
})

/**
 * Update Global Settings Schema
 */
export const updateGlobalSettingsSchema = createGlobalSettingsSchema.partial()

// ============================================================================
// STORE VALIDATORS
// ============================================================================

/**
 * Create Store Schema
 * Validates new store creation with configuration
 */
export const createStoreSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200, "Le nom ne peut pas depasser 200 caracteres"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas depasser 100 caracteres")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(1000, "La description ne peut pas depasser 1000 caracteres").optional(),
  address: z.object({
    street: z.string().min(1, "La rue est requise"),
    city: z.string().min(1, "La ville est requise"),
    postalCode: z.string().min(1, "Le code postal est requis"),
    country: z.string()
      .min(2, "Le code pays doit contenir 2 caracteres")
      .max(2, "Le code pays doit contenir 2 caracteres")
      .toUpperCase(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional(),
  useGlobalHours: z.boolean().default(true),
  hours: z.array(z.object({
    day: z.number().min(0).max(6),
    open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    isClosed: z.boolean(),
  })).optional().default([]),
  overrides: z.object({
    services: z.object({
      dineIn: z.boolean(),
      takeaway: z.boolean(),
      delivery: z.boolean(),
      clickAndCollect: z.boolean(),
    }).optional(),
    minimumOrderAmount: z.number().min(0, "Le montant minimum doit etre positif").optional(),
    deliveryRadius: z.number().min(0, "Le rayon de livraison doit etre positif").optional(),
    deliveryFee: z.number().min(0, "Les frais de livraison doivent etre positifs").optional(),
    deliveryFreeAbove: z.number().min(0, "Le montant minimum pour livraison gratuite doit etre positif").optional(),
  }).optional(),
  themeId: z.string().optional(),
})

/**
 * Update Store Schema
 * All fields optional for partial updates
 */
export const updateStoreSchema = createStoreSchema.partial()

/**
 * Update Store Status Schema
 * Quick status updates for stores
 */
export const updateStoreStatusSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  status: z.enum(["draft", "open", "closed", "temporarily_unavailable"], {
    errorMap: () => ({ message: "Statut invalide" }),
  }),
})

// ============================================================================
// STORE INTEGRATION VALIDATORS
// ============================================================================

/**
 * Create Store Integration Schema
 */
export const createStoreIntegrationSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  platform: z.enum(["uberEats", "deliveroo"], {
    errorMap: () => ({ message: "Plateforme invalide" }),
  }),
  platformStoreId: z.string().min(1, "L'ID du magasin sur la plateforme est requis"),
  syncMenu: z.boolean().default(true),
  autoAccept: z.boolean().default(true),
  enabled: z.boolean().default(true),
})

/**
 * Update Store Integration Schema
 */
export const updateStoreIntegrationSchema = createStoreIntegrationSchema.partial().required({ storeId: true, platform: true })

// ============================================================================
// CATEGORY VALIDATORS
// ============================================================================

/**
 * Create Category Schema
 */
export const createCategorySchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  name: z.string().min(1, "Le nom est requis").max(100, "Le nom ne peut pas depasser 100 caracteres"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas depasser 100 caracteres")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(500, "La description ne peut pas depasser 500 caracteres").optional(),
  imageUrl: z.string().url("URL d'image invalide").optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  parentId: z.string().optional(),
})

/**
 * Update Category Schema
 */
export const updateCategorySchema = createCategorySchema.partial().required({ storeId: true })

// ============================================================================
// PRODUCT VALIDATORS
// ============================================================================

/**
 * External IDs schema (reusable for options and choices)
 */
const externalIdsSchema = z.object({
  uberEatsId: z.string().optional(),
  deliverooId: z.string().optional(),
})

/**
 * Platform override schema (per-platform price, status, sync info)
 */
const platformOverrideSchema = z.object({
  price: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  lastSyncedAt: z.number().int().positive().optional(),
  syncError: z.string().max(500).optional(),
})

/**
 * Product source enum
 */
export const productSourceEnum = z.enum(["manual", "uber_eats", "deliveroo"])

/**
 * Create Product Schema
 * Complete product validation with options, scheduling, and platform integration
 */
export const createProductSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  categoryId: z.string().min(1, "L'ID de la categorie est requis"),
  name: z.string().min(1, "Le nom est requis").max(200, "Le nom ne peut pas depasser 200 caracteres"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas depasser 100 caracteres")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(2000, "La description ne peut pas depasser 2000 caracteres").optional(),
  price: z.number().int().min(0, "Le prix doit etre positif"), // in cents
  compareAtPrice: z.number().int().min(0).optional(),
  taxRate: z.number().min(0, "Le taux de TVA doit etre positif").max(100, "Le taux de TVA ne peut pas depasser 100").default(0),
  preparationTime: z.number().int().min(1, "Le temps de preparation doit etre au moins 1 minute").max(240, "Le temps de preparation ne peut pas depasser 4 heures").optional(),
  sku: z.string().max(50, "Le SKU ne peut pas depasser 50 caracteres").optional(),
  images: z.array(z.string().url("URL d'image invalide")).max(10, "Maximum 10 images").default([]),
  options: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1, "Le nom de l'option est requis"),
    required: z.boolean().default(false),
    maxSelections: z.number().int().min(1).optional(),
    externalIds: externalIdsSchema.optional(),
    choices: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1, "Le nom du choix est requis"),
      priceModifier: z.number().int().default(0), // in cents
      externalIds: externalIdsSchema.optional(),
    })).min(1, "Au moins un choix est requis"),
  })).default([]),
  allergens: z.array(z.string()).default([]),
  nutritionalInfo: z.object({
    calories: z.number().min(0).optional(),
    protein: z.number().min(0).optional(),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
    fiber: z.number().min(0).optional(),
  }).optional(),
  tags: z.array(z.string()).default([]),
  stock: z.object({
    tracked: z.boolean().default(false),
    quantity: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).default(0),
  }).optional(),
  scheduling: z.object({
    availableFrom: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    availableUntil: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    availableDays: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  spiceLevel: z.number().int().min(0).max(5, "Le niveau de piquant doit etre entre 0 et 5").optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  source: productSourceEnum.default("manual"),
  externalIds: externalIdsSchema.optional(),
  platformOverrides: z.object({
    uberEats: platformOverrideSchema.optional(),
    deliveroo: platformOverrideSchema.optional(),
  }).optional(),
})

/**
 * Update Product Schema
 */
export const updateProductSchema = createProductSchema.partial().required({ storeId: true })

/**
 * Update Product Stock Schema
 * Quick stock updates
 */
export const updateProductStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0, "La quantite doit etre positive"),
})

// ============================================================================
// MENU (COMBO) VALIDATORS
// ============================================================================

/**
 * Create Menu Schema
 */
export const createMenuSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  name: z.string().min(1, "Le nom est requis").max(200),
  description: z.string().max(1000).optional(),
  price: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
  sections: z.array(z.object({
    name: z.string().min(1),
    productIds: z.array(z.string().min(1)).min(1),
    maxSelections: z.number().int().min(1),
  })).min(1, "Au moins une section est requise"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

/**
 * Update Menu Schema
 */
export const updateMenuSchema = createMenuSchema.partial().required({ storeId: true })

// ============================================================================
// ORDER VALIDATORS
// ============================================================================

/**
 * Create Order Schema
 * Complete order validation with items and delivery info
 */
export const createOrderSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  type: z.enum(["delivery", "pickup", "dine_in"], {
    errorMap: () => ({ message: "Type de commande invalide" }),
  }),
  customerInfo: z.object({
    name: z.string().min(1, "Le nom du client est requis"),
    email: z.string().email("Email invalide").optional(),
    phone: z.string().optional(),
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().int().min(1, "La quantite doit etre au moins 1"),
    unitPrice: z.number().int().min(0),
    selectedOptions: z.array(z.object({
      optionId: z.string(),
      optionName: z.string(),
      choiceId: z.string(),
      choiceName: z.string(),
      priceModifier: z.number().int(),
    })).default([]),
    subtotal: z.number().int().min(0),
    notes: z.string().max(500).optional(),
  })).min(1, "Au moins un article est requis"),
  deliveryAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(2).max(2).toUpperCase(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    instructions: z.string().max(500).optional(),
  }).optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().max(500).optional(),
  scheduledFor: z.number().int().positive().optional(),
})

/**
 * Update Order Status Schema
 */
export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "L'ID de la commande est requis"),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "completed",
    "cancelled",
  ], {
    errorMap: () => ({ message: "Statut de commande invalide" }),
  }),
  cancellationReason: z.string().max(500).optional(),
})

/**
 * Update Order Payment Status Schema
 */
export const updateOrderPaymentStatusSchema = z.object({
  orderId: z.string().min(1),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"], {
    errorMap: () => ({ message: "Statut de paiement invalide" }),
  }),
})

// ============================================================================
// KITCHEN TICKET VALIDATORS
// ============================================================================

/**
 * Create Kitchen Ticket Schema
 */
export const createKitchenTicketSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  orderId: z.string().min(1, "L'ID de la commande est requis"),
  station: z.string().optional(),
  priority: z.enum(["normal", "urgent", "vip"]).default("normal"),
  items: z.array(z.object({
    productName: z.string().min(1),
    quantity: z.number().int().min(1),
    options: z.array(z.string()).default([]),
    notes: z.string().max(500).optional(),
  })).min(1, "Au moins un article est requis"),
  orderNumber: z.string().min(1),
  orderType: z.enum(["delivery", "pickup", "dine_in"]),
  source: z.enum(["website", "uber_eats", "deliveroo", "pos"]).default("website"),
  estimatedPrepTime: z.number().int().min(0).optional(),
})

/**
 * Update Kitchen Ticket Status Schema
 */
export const updateKitchenTicketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["pending", "in_progress", "ready", "completed"]),
  assignedTo: z.string().optional(),
})

// ============================================================================
// PRINTER VALIDATORS
// ============================================================================

/**
 * Create Printer Settings Schema
 */
export const createPrinterSettingsSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1, "Le nom de l'imprimante est requis"),
  type: z.enum(["network", "usb", "bluetooth"]),
  connectionInfo: z.object({
    ipAddress: z.string().ip({ version: "v4" }).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    usbVendorId: z.string().optional(),
    usbProductId: z.string().optional(),
  }),
  station: z.string().optional(),
  autoPrint: z.boolean().default(true),
  paperWidth: z.union([z.literal(58), z.literal(80)]).default(80),
  isDefault: z.boolean().default(false),
})

/**
 * Update Printer Settings Schema
 */
export const updatePrinterSettingsSchema = createPrinterSettingsSchema.partial().required({ storeId: true })

// ============================================================================
// PAYMENT VALIDATORS
// ============================================================================

/**
 * Create Payment Schema
 */
export const createPaymentSchema = z.object({
  orderId: z.string().min(1, "L'ID de la commande est requis"),
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  amount: z.number().int().min(1, "Le montant doit etre positif"),
  currency: z.string().length(3).toUpperCase().default("EUR"),
  provider: z.enum(["stripe", "sumup", "paypal", "square", "cash"], {
    errorMap: () => ({ message: "Fournisseur de paiement invalide" }),
  }),
  externalId: z.string().optional(),
  metadata: z.object({
    last4: z.string().length(4).optional(),
    brand: z.string().optional(),
    receiptUrl: z.string().url().optional(),
  }).optional(),
})

/**
 * Refund Payment Schema
 */
export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().int().min(1),
  reason: z.string().max(500).optional(),
})

// ============================================================================
// LANGUAGE VALIDATORS
// ============================================================================

/**
 * Create Language Schema
 */
export const createLanguageSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  code: z.string()
    .min(2, "Le code langue doit contenir au moins 2 caracteres")
    .max(5, "Le code langue ne peut pas depasser 5 caracteres")
    .toLowerCase(),
  name: z.string().min(1, "Le nom de la langue est requis"),
  nativeName: z.string().min(1, "Le nom natif est requis"),
  flagEmoji: z.string().optional(),
  isDefault: z.boolean().default(false),
  isRtl: z.boolean().default(false),
})

/**
 * Update Language Schema
 */
export const updateLanguageSchema = createLanguageSchema.partial().required({ storeId: true, code: true })

// ============================================================================
// TRANSLATION VALIDATORS
// ============================================================================

/**
 * Create Translation Schema
 */
export const createTranslationSchema = z.object({
  storeId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  field: z.string().min(1),
  languageCode: z.string().min(2).max(5),
  value: z.string().min(1),
  isAutoTranslated: z.boolean().default(false),
})

/**
 * Batch Translate Schema
 * For GPT-3.5 batch translation
 */
export const batchTranslateSchema = z.object({
  storeId: z.string().min(1),
  sourceLanguage: z.string().min(2).max(5),
  targetLanguage: z.string().min(2).max(5),
  entityType: z.string().min(1),
  entityIds: z.array(z.string().min(1)).min(1).max(100, "Maximum 100 entites par lot"),
})

// ============================================================================
// TEAM MEMBER VALIDATORS
// ============================================================================

/**
 * Create Team Member Schema
 */
export const createTeamMemberSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  userId: z.string().min(1, "L'ID de l'utilisateur est requis"),
  role: z.enum(["manager", "kitchen", "waiter", "delivery"], {
    errorMap: () => ({ message: "Role invalide" }),
  }),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

/**
 * Update Team Member Schema
 */
export const updateTeamMemberSchema = createTeamMemberSchema.partial().required({ storeId: true, userId: true })

// ============================================================================
// GAMIFICATION VALIDATORS
// ============================================================================

/**
 * Create Game QR Code Schema
 */
export const createGameQRCodeSchema = z.object({
  storeId: z.string().min(1),
  code: z.string().min(1),
  tableNumber: z.string().optional(),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
})

/**
 * Create Required Action Schema
 */
export const createRequiredActionSchema = z.object({
  storeId: z.string().min(1),
  type: z.enum(["google_review", "instagram_follow", "facebook_like", "tiktok_follow", "email_subscribe"]),
  name: z.string().min(1),
  description: z.string().max(500).optional(),
  url: z.string().url().optional(),
  icon: z.string().optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

/**
 * Create Game Schema
 */
export const createGameSchema = z.object({
  storeId: z.string().min(1),
  type: z.enum(["wheel", "scratch_card"]),
  name: z.string().min(1),
  description: z.string().max(1000).optional(),
  winRatio: z.number()
    .min(0, "Le taux de gain doit etre entre 0 et 100")
    .max(100, "Le taux de gain doit etre entre 0 et 100"),
  isActive: z.boolean().default(true),
})

/**
 * Update Game Win Ratio Schema
 */
export const updateGameWinRatioSchema = z.object({
  gameId: z.string().min(1),
  winRatio: z.number().min(0).max(100),
})

/**
 * Create Prize Schema
 */
export const createPrizeSchema = z.object({
  storeId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  type: z.enum(["discount_percentage", "discount_fixed", "free_product", "free_menu", "custom"]),
  value: z.number().int().min(0).optional(),
  productId: z.string().optional(),
  menuId: z.string().optional(),
  validityDays: z.number().int().min(1).default(30),
  totalAvailable: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
})

/**
 * Play Game Schema
 */
export const playGameSchema = z.object({
  storeId: z.string().min(1),
  gameId: z.string().min(1),
  qrCodeId: z.string().min(1),
  playerEmail: z.string().email("Email invalide"),
  playerName: z.string().min(1, "Le nom est requis"),
  playerPhone: z.string().optional(),
  completedActions: z.array(z.string()).min(1, "Au moins une action doit etre completee"),
})

/**
 * Redeem Prize Schema
 */
export const redeemPrizeSchema = z.object({
  redemptionCode: z.string().min(1, "Le code de redemption est requis"),
  redeemedBy: z.string().min(1, "L'ID du membre du personnel est requis"),
})

// ============================================================================
// USER PROFILE VALIDATORS
// ============================================================================

/**
 * Create User Profile Schema
 */
export const createUserProfileSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["super_admin", "client_admin", "manager", "kitchen", "waiter", "delivery", "customer"]),
  storeIds: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  language: z.string().min(2).max(5).default("fr"),
  phone: z.string().optional(),
  twoFactorEnabled: z.boolean().default(false),
})

/**
 * Update User Profile Schema
 */
export const updateUserProfileSchema = createUserProfileSchema.partial().required({ userId: true })
