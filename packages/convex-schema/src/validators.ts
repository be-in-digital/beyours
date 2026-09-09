import { z } from "zod"

/**
 * BeYours Engine - Zod Validators
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
  taxRate: z.number().min(0).max(100, "Le taux de taxe doit être entre 0 et 100").default(20),
  services: z.object({
    dineIn: z.boolean().default(false),
    takeaway: z.boolean().default(true),
    delivery: z.boolean().default(false),
    clickAndCollect: z.boolean().default(false),
  }).default({ dineIn: false, takeaway: true, delivery: false, clickAndCollect: false }),
  minimumOrderAmount: z.number().min(0, "Le montant minimum doit être positif").optional(),
  hours: z.array(z.object({
    day: z.number().min(0).max(6),
    open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format horaire invalide (HH:mm)"),
    isClosed: z.boolean(),
  })).default([]),
  delivery: z.object({
    feeMode: z.enum(["fixed", "percentage"]).optional().default("fixed"),
    fee: z.number().min(0, "Les frais de livraison doivent être positifs").optional(),
    percentage: z.number().min(1).max(100).optional(),
    maxFee: z.number().min(0, "Le plafond doit être positif").optional(),
    freeAbove: z.number().min(0, "Le montant minimum pour livraison gratuite doit être positif").optional(),
    radius: z.number().min(0, "Le rayon de livraison doit être positif").optional(),
  }).default({ feeMode: "fixed" }),
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
  name: z.string().min(1, "Le nom est requis").max(200, "Le nom ne peut pas dépasser 200 caractères"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas dépasser 100 caractères")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(1000, "La description ne peut pas dépasser 1000 caractères").optional(),
  address: z.object({
    street: z.string().min(1, "La rue est requise"),
    city: z.string().min(1, "La ville est requise"),
    postalCode: z.string().min(1, "Le code postal est requis"),
    country: z.string()
      .min(2, "Le code pays doit contenir 2 caractères")
      .max(2, "Le code pays doit contenir 2 caractères")
      .toUpperCase(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional(),
  /* Reaches an href on the storefront, so the scheme is part of the contract:
     `javascript:` and `data:` both parse as valid URLs and both are stored XSS.
     Mirrored server-side by `assertReservationUrl` — this schema guards the
     form, that guards the database. */
  reservationUrl: z
    .string()
    .url("Lien de réservation invalide")
    .refine(
      (value) => /^https:\/\//i.test(value),
      "Le lien de réservation doit commencer par https://",
    )
    .optional(),
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
    minimumOrderAmount: z.number().min(0, "Le montant minimum doit être positif").optional(),
    deliveryRadius: z.number().min(0, "Le rayon de livraison doit être positif").optional(),
    deliveryFee: z.number().min(0, "Les frais de livraison doivent être positifs").optional(),
    deliveryFreeAbove: z.number().min(0, "Le montant minimum pour livraison gratuite doit être positif").optional(),
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
    error: "Statut invalide",
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
    error: "Plateforme invalide",
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
  name: z.string().min(1, "Le nom est requis").max(100, "Le nom ne peut pas dépasser 100 caractères"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas dépasser 100 caractères")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(500, "La description ne peut pas dépasser 500 caractères").optional(),
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
export const productSourceEnum = z.enum(["manual", "uber_eats", "deliveroo", "ai-image"])

/**
 * Create Product Schema
 * Complete product validation with options, scheduling, and platform integration
 */
export const createProductSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  categoryId: z.string().min(1, "L'ID de la catégorie est requis"),
  name: z.string().min(1, "Le nom est requis").max(200, "Le nom ne peut pas dépasser 200 caractères"),
  slug: z.string()
    .min(1, "Le slug est requis")
    .max(100, "Le slug ne peut pas dépasser 100 caractères")
    .regex(/^[a-z0-9-]+$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"),
  description: z.string().max(2000, "La description ne peut pas dépasser 2000 caractères").optional(),
  price: z.number().int().min(0, "Le prix doit être positif"), // in cents
  compareAtPrice: z.number().int().min(0).optional(),
  taxRate: z.number().min(0, "Le taux de TVA doit être positif").max(100, "Le taux de TVA ne peut pas dépasser 100").default(0),
  preparationTime: z.number().int().min(1, "Le temps de préparation doit être au moins 1 minute").max(240, "Le temps de préparation ne peut pas dépasser 4 heures").optional(),
  sku: z.string().max(50, "Le SKU ne peut pas dépasser 50 caractères").optional(),
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
    autoDisableWhenEmpty: z.boolean().optional(),
  }).optional(),
  scheduling: z.object({
    availableFrom: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    availableUntil: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    availableDays: z.array(z.number().min(0).max(6)).optional(),
  }).optional(),
  spiceLevel: z.number().int().min(0).max(5, "Le niveau de piquant doit être entre 0 et 5").optional(),
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
  quantity: z.number().int().min(0, "La quantité doit être positive"),
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
  price: z.number().int().min(0, "Le prix doit être positif"),
  imageUrl: z.string().url().optional(),
  productIds: z.array(z.string().min(1)).min(1, "Au moins un produit est requis"),
  platformVisibility: z.object({
    uberEats: z.boolean().optional(),
    deliveroo: z.boolean().optional(),
  }).optional(),
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
    error: "Type de commande invalide",
  }),
  // Optional at this layer even for `dine_in`: a platform `dine_in` order
  // forwarded by Uber Eats or Deliveroo carries no table, and rejecting it
  // would lose the order outright. The storefront requires it — that is where
  // the diner is actually sitting at a table.
  //
  // Length is not bounded here. These schemas derive types (`CreateOrderInput`)
  // and are not what runs on a mutation, so a bound written here would be a
  // second, unenforced copy of the one in `@be-in-digital/core/dining`, which
  // `orders.create` actually applies. This package deliberately does not depend
  // on `core`.
  tableNumber: z.string().optional(),
  customerInfo: z.object({
    name: z.string().min(1, "Le nom du client est requis"),
    email: z.string().email("Email invalide").optional(),
    phone: z.string().optional(),
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().int().min(1, "La quantité doit être au moins 1"),
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
    error: "Statut de commande invalide",
  }),
  cancellationReason: z.string().max(500).optional(),
})

/**
 * Update Order Payment Status Schema
 */
export const updateOrderPaymentStatusSchema = z.object({
  orderId: z.string().min(1),
  // Kept in step with the `orders.paymentStatus` union in
  // `tables/orders.ts`: a value the table stores but this enum rejects would
  // make a legitimate order unvalidatable.
  paymentStatus: z.enum(
    [
      "pending",
      "paid",
      "failed",
      "refund_pending",
      "refunded",
      "partially_refunded",
    ],
    {
      error: "Statut de paiement invalide",
    }
  ),
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
  tableNumber: z.string().optional(),
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

// There are no printer validators here, and there is nothing to add one for.
//
// `createPrinterSettingsSchema` and `updatePrinterSettingsSchema` outlived the
// `printerSettings` table by the removal that took the table out: the table had
// no reader and no writer, and these two had no consumer either, but they were
// exported from a published package rather than declared in a schema file, so
// the sweep missed them.
//
// They described the ESC/POS path — `type: "network" | "usb" | "bluetooth"`, an
// `ipAddress`, a port, USB vendor and product ids — which `CLAUDE.md` says will
// never be built: a browser cannot open a raw socket and Convex cannot reach a
// restaurant's LAN, so the thermal path when it comes is cloud printing (the
// printer polls an HTTP endpoint). A validator for a transport that has been
// ruled out is not groundwork, it is a claim. What ships lives on
// `stores.printConfig`.

// ============================================================================
// PAYMENT VALIDATORS
// ============================================================================

/**
 * Create Payment Schema
 */
export const createPaymentSchema = z.object({
  orderId: z.string().min(1, "L'ID de la commande est requis"),
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  amount: z.number().int().min(1, "Le montant doit être positif"),
  currency: z.string().length(3).toUpperCase().default("EUR"),
  provider: z.enum(["stripe", "sumup", "paypal", "square", "cash"], {
    error: "Fournisseur de paiement invalide",
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
    .min(2, "Le code langue doit contenir au moins 2 caractères")
    .max(5, "Le code langue ne peut pas dépasser 5 caractères")
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
 * Available permission modules for team members
 */
export const TEAM_PERMISSION_MODULES = [
  "dashboard",
  "orders",
  "products",
  "kitchen",
  "team",
  "settings",
  "integrations",
  "marketing",
] as const

export type TeamPermissionModule = typeof TEAM_PERMISSION_MODULES[number]

/**
 * Default permissions per role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly TeamPermissionModule[]> = {
  manager: TEAM_PERMISSION_MODULES,
  kitchen: ["orders", "kitchen"],
  waiter: ["dashboard", "orders"],
  delivery: ["orders"],
} as const

/**
 * Invite Team Member Schema (used for invitation flow)
 */
export const inviteTeamMemberSchema = z.object({
  storeId: z.string().optional(),
  allStores: z.boolean().default(false),
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  role: z.enum(["manager", "kitchen", "waiter", "delivery"], {
    error: "Role invalide",
  }),
  permissions: z.array(z.string()).default([]),
})

/**
 * Create Team Member Schema (legacy, kept for backward compat)
 */
export const createTeamMemberSchema = z.object({
  storeId: z.string().optional(),
  allStores: z.boolean().default(false),
  userId: z.string().optional(),
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  role: z.enum(["manager", "kitchen", "waiter", "delivery"], {
    error: "Role invalide",
  }),
  permissions: z.array(z.string()).default([]),
  invitationStatus: z.enum(["pending", "accepted", "expired"]).default("pending"),
  isActive: z.boolean().default(true),
})

/**
 * Update Team Member Schema
 */
export const updateTeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  role: z.enum(["manager", "kitchen", "waiter", "delivery"]).optional(),
  permissions: z.array(z.string()).optional(),
  storeId: z.string().optional(),
  allStores: z.boolean().optional(),
})

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
    .min(0, "Le taux de gain doit être entre 0 et 100")
    .max(100, "Le taux de gain doit être entre 0 et 100"),
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
  completedActions: z.array(z.string()).min(1, "Au moins une action doit être completee"),
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
  /** Placeholder — 2FA is not implemented. See `tables/userProfiles.ts`. */
  twoFactorEnabled: z.boolean().optional(),
})

/**
 * Update User Profile Schema
 */
export const updateUserProfileSchema = createUserProfileSchema.partial().required({ userId: true })

// ============================================================================
// IMAGE TO PRODUCT VALIDATORS (OpenAI Structured Outputs)
// ============================================================================

/** Field source enum for AI-generated values */
export const aiFieldSourceSchema = z.enum(["detected", "generated", "inferred"])

/** AI field wrapper: string value with source + confidence */
const aiStringField = z.object({
  value: z.string(),
  source: aiFieldSourceSchema,
  confidence: z.number().min(0).max(1),
})

/** AI field wrapper: nullable string */
const aiNullableStringField = z.object({
  value: z.string().nullable(),
  source: aiFieldSourceSchema,
  confidence: z.number().min(0).max(1),
})

/** AI field wrapper: nullable number (price in cents) */
const aiNumberField = z.object({
  value: z.number().int().min(0).nullable(),
  source: aiFieldSourceSchema,
  confidence: z.number().min(0).max(1),
})

/** AI field wrapper: string array */
const aiStringArrayField = z.object({
  value: z.array(z.string()),
  source: aiFieldSourceSchema,
  confidence: z.number().min(0).max(1),
})

/** Parsing warning emitted by the AI during analysis */
const parsingWarningSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning"]),
})

/**
 * Raw vision schema: single dish photo analysis
 * OpenAI returns flat values — we wrap in AiField during post-processing
 */
export const singleProductVisionSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  ingredients: z.array(z.string()),
  allergens: z.array(z.string()),
  detectedCategoryName: z.string().nullable(),
  suggestedCategoryName: z.string(),
  warnings: z.array(z.string()).default([]),
})

/**
 * Raw vision schema: menu photo analysis (multiple products)
 * OpenAI returns flat values — we wrap in AiField during post-processing
 */
export const menuVisionResultSchema = z.object({
  products: z.array(z.object({
    name: z.string(),
    description: z.string(),
    price: z.number().nullable(),
    ingredients: z.array(z.string()),
    allergens: z.array(z.string()),
    detectedCategoryName: z.string().nullable(),
    suggestedCategoryName: z.string(),
    warnings: z.array(z.string()).default([]),
  })),
})

/**
 * Raw enrichment schema: output for GPT completing missing fields
 */
export const enrichmentResultSchema = z.object({
  products: z.array(z.object({
    tempId: z.string(),
    description: z.string(),
    ingredients: z.array(z.string()),
  })),
})

// ============================================================================
// AUTO BLOG VALIDATORS
// ============================================================================

export const autoBlogPlanEnum = z.enum(["starter", "pro", "enterprise"])

export const stripeSubscriptionStatusEnum = z.enum([
  "active", "trialing",
  "past_due", "canceled", "unpaid",
  "incomplete", "incomplete_expired", "paused",
])

/**
 * Upsert Owner Entitlements Schema
 */
export const upsertOwnerEntitlementsSchema = z.object({
  ownerId: z.string().min(1, "L'ID du propriétaire est requis"),
  autoBlog: z.object({
    enabled: z.boolean(),
    plan: autoBlogPlanEnum.optional(),
    monthlyQuota: z.number().int().min(0),
    maxTopics: z.number().int().min(1).optional(),
    allowMultiLanguage: z.boolean(),
    allowAutoPublish: z.boolean(),
  }),
})

/**
 * Upsert Blog Auto Config Schema
 */
export const upsertBlogAutoConfigSchema = z.object({
  storeId: z.string().min(1, "L'ID du magasin est requis"),
  isEnabled: z.boolean(),
  themes: z.array(z.string().min(1)).min(1, "Au moins un thème est requis"),
  frequency: z.enum(["weekly", "monthly"]),
  preferredWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  preferredMonthDays: z.array(z.number().int().min(1).max(28)).optional(),
  preferredHour: z.number().int().min(0).max(23),
  timezone: z.string().min(1, "Le fuseau horaire est requis"),
  tone: z.enum(["formel", "decontracte", "storytelling"]),
  primaryLocale: z.string().min(2).max(5),
  autoTranslate: z.boolean(),
  approvalMode: z.enum(["draft_review", "auto_publish"]),
  categoryId: z.string().optional(),
  targetStoreIds: z.array(z.string()).optional(),
})
