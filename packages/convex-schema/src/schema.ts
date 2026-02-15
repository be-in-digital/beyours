import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * BeInDigital Engine - Convex Database Schema
 *
 * Multi-tenant schema with Better Auth integration
 * 1 Convex instance per restaurant client
 */

export default defineSchema({
  // ============================================================================
  // BETTER AUTH TABLES
  // ============================================================================

  /**
   * User table (Better Auth native)
   * Stores user authentication information
   */
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  /**
   * Session table (Better Auth native)
   * Manages user sessions with token-based authentication
   */
  session: defineTable({
    userId: v.id("user"),
    token: v.string(),
    expiresAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"]),

  /**
   * Account table (Better Auth OAuth)
   * Handles OAuth providers and password authentication
   */
  account: defineTable({
    userId: v.id("user"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    idToken: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_providerId_accountId", ["providerId", "accountId"]),

  /**
   * Verification table (Better Auth)
   * Manages email verification and password reset tokens
   */
  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_identifier", ["identifier"]),

  // ============================================================================
  // BEINDIGITAL EXTENSIONS
  // ============================================================================

  /**
   * User Profiles table (BeInDigital extension)
   * Extends Better Auth user with roles and permissions
   */
  userProfiles: defineTable({
    userId: v.id("user"),
    role: v.union(
      v.literal("super_admin"),
      v.literal("client_admin"),
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery"),
      v.literal("customer")
    ),
    storeIds: v.array(v.id("stores")),
    permissions: v.array(v.string()),
    language: v.string(),
    phone: v.optional(v.string()),
    twoFactorEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"]),

  // ============================================================================
  // MULTI-STORE MANAGEMENT
  // ============================================================================

  /**
   * Stores table
   * Each restaurant owner can have unlimited stores
   */
  stores: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    address: v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    hours: v.array(v.object({
      day: v.number(), // 0=Sunday, 6=Saturday
      open: v.string(), // "09:00"
      close: v.string(), // "22:00"
      isClosed: v.boolean(),
    })),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("temporarily_unavailable")
    ),
    branding: v.object({
      primaryColor: v.optional(v.string()),
      secondaryColor: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      faviconUrl: v.optional(v.string()),
      fontHeading: v.optional(v.string()),
      fontBody: v.optional(v.string()),
    }),
    settings: v.object({
      currency: v.string(),
      timezone: v.string(),
      deliveryEnabled: v.boolean(),
      pickupEnabled: v.boolean(),
      dineInEnabled: v.boolean(),
      minimumOrderAmount: v.optional(v.number()),
      deliveryFee: v.optional(v.number()),
      deliveryRadius: v.optional(v.number()),
      taxRate: v.optional(v.number()),
    }),
    integrations: v.object({
      uberEats: v.optional(v.object({
        enabled: v.boolean(),
        storeId: v.optional(v.string()),
        autoAccept: v.boolean(),
      })),
      deliveroo: v.optional(v.object({
        enabled: v.boolean(),
        storeId: v.optional(v.string()),
        autoAccept: v.boolean(),
      })),
    }),
    themeId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  /**
   * Team Members table
   * Links users to stores with specific roles
   */
  teamMembers: defineTable({
    storeId: v.id("stores"),
    userId: v.id("user"),
    role: v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    ),
    permissions: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_userId", ["userId"])
    .index("by_storeId_role", ["storeId", "role"]),

  // ============================================================================
  // CATALOG MANAGEMENT
  // ============================================================================

  /**
   * Categories table
   * Hierarchical product categories
   */
  categories: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
    parentId: v.optional(v.id("categories")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_sortOrder", ["storeId", "sortOrder"])
    .index("by_storeId_slug", ["storeId", "slug"]),

  /**
   * Products table
   * Core product catalog with options, allergens, scheduling,
   * and full platform integration support (Uber Eats, Deliveroo)
   */
  products: defineTable({
    storeId: v.id("stores"),
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    price: v.number(), // in cents
    compareAtPrice: v.optional(v.number()),
    taxRate: v.number(), // tax rate in % (e.g. 10 for 10%)
    preparationTime: v.optional(v.number()), // in minutes
    sku: v.optional(v.string()), // product code / PLU
    images: v.array(v.string()), // S3 URLs
    options: v.array(v.object({
      id: v.string(),
      name: v.string(),
      required: v.boolean(),
      maxSelections: v.optional(v.number()),
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        priceModifier: v.number(), // in cents, can be negative
        externalIds: v.optional(v.object({
          uberEatsId: v.optional(v.string()),
          deliverooId: v.optional(v.string()),
        })),
      })),
    })),
    allergens: v.array(v.string()),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      fiber: v.optional(v.number()),
    })),
    tags: v.array(v.string()),
    stock: v.optional(v.object({
      tracked: v.boolean(),
      quantity: v.number(),
      lowStockThreshold: v.number(),
    })),
    scheduling: v.optional(v.object({
      availableFrom: v.optional(v.string()), // "11:00"
      availableUntil: v.optional(v.string()), // "14:00"
      availableDays: v.optional(v.array(v.number())), // [1,2,3,4,5]
    })),
    spiceLevel: v.optional(v.number()), // 0-5
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
    // Product source: created manually or imported from a platform
    source: v.string(), // "manual" | "uber_eats" | "deliveroo"
    // External IDs to link with platforms
    externalIds: v.optional(v.object({
      uberEatsId: v.optional(v.string()),
      deliverooId: v.optional(v.string()),
    })),
    // Per-platform price and status overrides
    platformOverrides: v.optional(v.object({
      uberEats: v.optional(v.object({
        price: v.optional(v.number()), // price in cents if different
        isActive: v.optional(v.boolean()), // suspended on Uber Eats?
        lastSyncedAt: v.optional(v.number()), // last sync timestamp
        syncError: v.optional(v.string()), // sync error message
      })),
      deliveroo: v.optional(v.object({
        price: v.optional(v.number()),
        isActive: v.optional(v.boolean()),
        lastSyncedAt: v.optional(v.number()),
        syncError: v.optional(v.string()),
      })),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_categoryId", ["storeId", "categoryId"])
    .index("by_storeId_isActive", ["storeId", "isActive"])
    .index("by_storeId_isFeatured", ["storeId", "isFeatured"])
    .index("by_storeId_slug", ["storeId", "slug"])
    .index("by_storeId_source", ["storeId", "source"]),

  /**
   * Menus table (combos/formules)
   * Meal deals and combo offers
   */
  menus: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    sections: v.array(v.object({
      name: v.string(),
      productIds: v.array(v.id("products")),
      maxSelections: v.number(),
    })),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_isActive", ["storeId", "isActive"]),

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  /**
   * Orders table
   * Complete order lifecycle with multi-source support
   */
  orders: defineTable({
    storeId: v.id("stores"),
    orderNumber: v.string(), // ex: "ORD-2026-0001"
    customerId: v.optional(v.id("user")),
    customerInfo: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
    }),
    type: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    items: v.array(v.object({
      productId: v.id("products"),
      productName: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      selectedOptions: v.array(v.object({
        optionId: v.string(),
        optionName: v.string(),
        choiceId: v.string(),
        choiceName: v.string(),
        priceModifier: v.number(),
      })),
      subtotal: v.number(),
      notes: v.optional(v.string()),
    })),
    subtotal: v.number(),
    taxAmount: v.number(),
    deliveryFee: v.optional(v.number()),
    discountAmount: v.optional(v.number()),
    total: v.number(),
    deliveryAddress: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      instructions: v.optional(v.string()),
    })),
    paymentMethod: v.optional(v.string()),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
    source: v.union(
      v.literal("website"),
      v.literal("uber_eats"),
      v.literal("deliveroo"),
      v.literal("pos")
    ),
    notes: v.optional(v.string()),
    estimatedPrepTime: v.optional(v.number()), // in minutes
    estimatedDeliveryTime: v.optional(v.number()),
    scheduledFor: v.optional(v.number()), // timestamp for scheduled orders
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_status", ["storeId", "status"])
    .index("by_storeId_createdAt", ["storeId", "createdAt"])
    .index("by_customerId", ["customerId"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_source", ["source"]),

  // ============================================================================
  // KITCHEN DISPLAY SYSTEM
  // ============================================================================

  /**
   * Kitchen Tickets table
   * Real-time kitchen display with station routing
   */
  kitchenTickets: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    station: v.optional(v.string()), // "starters", "mains", "desserts", "drinks"
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("completed")
    ),
    priority: v.union(
      v.literal("normal"),
      v.literal("urgent"),
      v.literal("vip")
    ),
    items: v.array(v.object({
      productName: v.string(),
      quantity: v.number(),
      options: v.array(v.string()),
      notes: v.optional(v.string()),
    })),
    assignedTo: v.optional(v.id("user")),
    estimatedPrepTime: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    printCount: v.number(),
    source: v.union(
      v.literal("website"),
      v.literal("uber_eats"),
      v.literal("deliveroo"),
      v.literal("pos")
    ),
    orderNumber: v.string(),
    orderType: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_status", ["storeId", "status"])
    .index("by_orderId", ["orderId"])
    .index("by_storeId_station", ["storeId", "station"]),

  /**
   * Printer Settings table
   * ESC/POS thermal printer configuration
   */
  printerSettings: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    type: v.union(v.literal("network"), v.literal("usb"), v.literal("bluetooth")),
    connectionInfo: v.object({
      ipAddress: v.optional(v.string()),
      port: v.optional(v.number()),
      usbVendorId: v.optional(v.string()),
      usbProductId: v.optional(v.string()),
    }),
    station: v.optional(v.string()),
    autoPrint: v.boolean(),
    paperWidth: v.union(v.literal(58), v.literal(80)),
    isDefault: v.boolean(),
    isOnline: v.boolean(),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"]),

  // ============================================================================
  // PAYMENT PROCESSING
  // ============================================================================

  /**
   * Payments table
   * Multi-provider payment tracking with refund support
   */
  payments: defineTable({
    orderId: v.id("orders"),
    storeId: v.id("stores"),
    amount: v.number(),
    currency: v.string(),
    provider: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal"),
      v.literal("square"),
      v.literal("cash")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("refunded"),
      v.literal("partially_refunded")
    ),
    externalId: v.optional(v.string()), // Stripe payment intent ID, etc.
    metadata: v.optional(v.object({
      last4: v.optional(v.string()),
      brand: v.optional(v.string()),
      receiptUrl: v.optional(v.string()),
    })),
    refundedAmount: v.optional(v.number()),
    refundReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orderId", ["orderId"])
    .index("by_storeId", ["storeId"])
    .index("by_storeId_status", ["storeId", "status"])
    .index("by_externalId", ["externalId"]),

  // ============================================================================
  // INTERNATIONALIZATION (i18n)
  // ============================================================================

  /**
   * Languages table
   * Dynamic language management (unlimited languages)
   */
  languages: defineTable({
    storeId: v.id("stores"),
    code: v.string(), // ISO 639-1: "fr", "en", "es"
    name: v.string(), // e.g. "French"
    nativeName: v.string(), // e.g. "Français"
    flagEmoji: v.optional(v.string()),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    isRtl: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_code", ["storeId", "code"]),

  /**
   * Translations table
   * Stores translated content for all entities
   */
  translations: defineTable({
    storeId: v.id("stores"),
    entityType: v.string(), // "product", "category", "page"
    entityId: v.string(),
    field: v.string(), // "name", "description"
    languageCode: v.string(),
    value: v.string(),
    isAutoTranslated: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId_entity", ["storeId", "entityType", "entityId"])
    .index("by_storeId_language", ["storeId", "languageCode"]),

  /**
   * Translation Jobs table
   * Tracks GPT-3.5 batch translation jobs
   */
  translationJobs: defineTable({
    storeId: v.id("stores"),
    sourceLanguage: v.string(),
    targetLanguage: v.string(),
    entityType: v.string(),
    totalItems: v.number(),
    completedItems: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_status", ["status"]),

  // ============================================================================
  // GAMIFICATION SYSTEM
  // ============================================================================

  /**
   * Game QR Codes table
   * QR codes placed on restaurant tables
   */
  gameQRCodes: defineTable({
    storeId: v.id("stores"),
    code: v.string(), // Unique QR code value
    tableNumber: v.optional(v.string()),
    location: v.optional(v.string()), // e.g. "Terrace", "Main hall"
    isActive: v.boolean(),
    scannedCount: v.number(),
    lastScannedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_code", ["code"])
    .index("by_storeId_isActive", ["storeId", "isActive"]),

  /**
   * Required Actions table
   * Social actions customers must complete before playing
   */
  requiredActions: defineTable({
    storeId: v.id("stores"),
    type: v.union(
      v.literal("google_review"),
      v.literal("instagram_follow"),
      v.literal("facebook_like"),
      v.literal("tiktok_follow"),
      v.literal("email_subscribe")
    ),
    name: v.string(),
    description: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    isRequired: v.boolean(),
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_isActive", ["storeId", "isActive"]),

  /**
   * Games table
   * Game configuration with admin-controlled win ratio
   */
  games: defineTable({
    storeId: v.id("stores"),
    type: v.union(
      v.literal("wheel"),
      v.literal("scratch_card")
    ),
    name: v.string(),
    description: v.optional(v.string()),
    winRatio: v.number(), // 0-100 (percentage)
    isActive: v.boolean(),
    config: v.optional(v.object({
      wheelSections: v.optional(v.array(v.object({
        label: v.string(),
        color: v.string(),
        prizeId: v.optional(v.id("prizes")),
      }))),
      scratchCardDesign: v.optional(v.string()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_isActive", ["storeId", "isActive"]),

  /**
   * Prizes table
   * Rewards that customers can win
   */
  prizes: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    type: v.union(
      v.literal("discount_percentage"),
      v.literal("discount_fixed"),
      v.literal("free_product"),
      v.literal("free_menu"),
      v.literal("custom")
    ),
    value: v.optional(v.number()), // Percentage or fixed amount in cents
    productId: v.optional(v.id("products")),
    menuId: v.optional(v.id("menus")),
    validityDays: v.number(), // How many days the prize is valid
    totalAvailable: v.optional(v.number()),
    remainingCount: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_storeId_isActive", ["storeId", "isActive"]),

  /**
   * Game Plays table
   * Tracks each game play with 24h cooldown
   */
  gamePlays: defineTable({
    storeId: v.id("stores"),
    gameId: v.id("games"),
    qrCodeId: v.id("gameQRCodes"),
    playerEmail: v.string(),
    playerName: v.string(),
    playerPhone: v.optional(v.string()),
    completedActions: v.array(v.string()), // Action IDs completed
    didWin: v.boolean(),
    prizeId: v.optional(v.id("prizes")),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    playedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_playerEmail", ["playerEmail"])
    .index("by_storeId_playedAt", ["storeId", "playedAt"])
    .index("by_qrCodeId", ["qrCodeId"]),

  /**
   * Prize Redemptions table
   * Tracks prize redemption with QR codes
   */
  prizeRedemptions: defineTable({
    storeId: v.id("stores"),
    gamePlayId: v.id("gamePlays"),
    prizeId: v.id("prizes"),
    playerEmail: v.string(),
    playerName: v.string(),
    redemptionCode: v.string(), // QR code sent to customer
    status: v.union(
      v.literal("pending"),
      v.literal("redeemed"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    redeemedAt: v.optional(v.number()),
    redeemedBy: v.optional(v.id("user")), // Staff member who redeemed
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_storeId", ["storeId"])
    .index("by_redemptionCode", ["redemptionCode"])
    .index("by_playerEmail", ["playerEmail"])
    .index("by_storeId_status", ["storeId", "status"])
    .index("by_gamePlayId", ["gamePlayId"]),
})
