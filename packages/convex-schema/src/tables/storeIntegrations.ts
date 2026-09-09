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
  /**
   * This restaurant's own public page on the platform.
   *
   * WHY IT IS NOT DERIVED FROM `platformStoreId`. That is an API identifier —
   * a UUID for Uber Eats, a site id for Deliveroo — and neither platform's
   * public URL is built from it. There is nothing to derive, which is exactly
   * how the storefront ended up hard-coding `https://www.ubereats.com` and
   * `https://www.deliveroo.com`: the platforms' HOME pages, under a
   * « Commandez aussi sur vos apps » heading and a COMMANDER button, on every
   * menu page whether or not the restaurant was on either platform. The
   * restaurant paid for a link that sent its own customers to a marketplace to
   * be offered somebody else's dinner.
   *
   * Optional, and the tile is absent without it. A link that is not this
   * establishment's is worse than no link.
   */
  storefrontUrl: v.optional(v.string()),
  syncMenu: v.boolean(),
  autoAccept: v.boolean(), // deprecated, use orderMode
  orderMode: v.optional(v.union(
    v.literal("auto_accept"),
    v.literal("auto_reject"),
    v.literal("manual")
  )),
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
