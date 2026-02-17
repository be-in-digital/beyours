import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Store-level integration mappings
 * Maps a store to its platform-specific listing (Uber Eats, Deliveroo).
 * Credentials are stored globally in globalSettings.
 */
export const storeIntegrationsTable = defineTable({
  storeId: v.id("stores"),
  platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  platformStoreId: v.string(), // store ID on the platform
  syncMenu: v.boolean(),
  autoAccept: v.boolean(),
  enabled: v.boolean(),
  // Deliveroo specific
  brandId: v.optional(v.string()),
  // Uber Eats specific
  storeStatus: v.optional(v.union(
    v.literal("ONLINE"),
    v.literal("PAUSED"),
    v.literal("OFFLINE")
  )),
  prepTime: v.optional(v.number()), // in minutes
  // Menu sync status
  lastMenuSyncAt: v.optional(v.number()),
  menuSyncStatus: v.optional(v.union(
    v.literal("idle"),
    v.literal("syncing"),
    v.literal("success"),
    v.literal("error")
  )),
  menuSyncError: v.optional(v.string()),
  lastSyncAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_store", ["storeId"])
  .index("by_store_platform", ["storeId", "platform"])
  .index("by_platform_enabled", ["platform", "enabled"])
