import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Game QR Codes table
 * QR codes placed on restaurant tables
 */
export const gameQRCodesTable = defineTable({
  storeId: v.id("stores"),
  code: v.string(), // Unique QR code value
  tableNumber: v.optional(v.string()),
  location: v.optional(v.string()), // e.g. "Terrace", "Main hall"
  gameType: v.optional(v.union(
    v.literal("wheel"),
    v.literal("scratch_card")
  )),
  isActive: v.boolean(),
  scannedCount: v.number(),
  lastScannedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_code", ["code"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Required Actions table
 * Social actions customers must complete before playing
 */
export const requiredActionsTable = defineTable({
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
  timerSeconds: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Games table
 * Game configuration with admin-controlled win ratio
 */
export const gamesTable = defineTable({
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
      isWinning: v.optional(v.boolean()),
      probability: v.optional(v.number()),
    }))),
    scratchCardDesign: v.optional(v.string()),
    backgroundImage: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    cooldownHours: v.optional(v.number()),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Prizes table
 * Rewards that customers can win
 */
export const prizesTable = defineTable({
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
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Game Plays table
 * Tracks each game play with 24h cooldown
 */
export const gamePlaysTable = defineTable({
  storeId: v.id("stores"),
  gameId: v.id("games"),
  qrCodeId: v.optional(v.id("gameQRCodes")),
  playerEmail: v.optional(v.string()),
  playerName: v.optional(v.string()),
  playerFirstName: v.optional(v.string()),
  playerLastName: v.optional(v.string()),
  playerPhone: v.optional(v.string()),
  fingerprint: v.optional(v.string()),
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
  .index("by_qrCodeId", ["qrCodeId"])
  .index("by_storeId_fingerprint", ["storeId", "fingerprint"])

/**
 * Prize Redemptions table
 * Tracks prize redemption with QR codes
 */
export const prizeRedemptionsTable = defineTable({
  storeId: v.id("stores"),
  gamePlayId: v.id("gamePlays"),
  prizeId: v.id("prizes"),
  playerEmail: v.optional(v.string()),
  playerName: v.optional(v.string()),
  playerFirstName: v.optional(v.string()),
  playerLastName: v.optional(v.string()),
  redemptionCode: v.string(), // QR code sent to customer
  status: v.union(
    v.literal("pending"),
    v.literal("claimed"),
    v.literal("redeemed"),
    v.literal("expired"),
    v.literal("cancelled")
  ),
  redeemedAt: v.optional(v.number()),
  redeemedBy: v.optional(v.string()), // Staff member who redeemed (Better Auth user)
  expiresAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_redemptionCode", ["redemptionCode"])
  .index("by_playerEmail", ["playerEmail"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_gamePlayId", ["gamePlayId"])
