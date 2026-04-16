import { internalMutation } from "./_generated/server"

/**
 * Seed mutation: links existing stores to Uber Eats sandbox test stores.
 * Creates storeIntegration entries for the 3 BID test stores.
 *
 * Uber Eats Test App: Be In Digital - Eats Integration Test
 * App ID: gDSM7yKvhGDtssTt_-OwBfEtBX6cnHVH
 *
 * Run: npx convex run seedUberEats:seedIntegrations
 */

const UBER_EATS_TEST_STORES = [
  {
    name: "BID Test Store - Rivoli",
    platformStoreId: "24f16ffa-ea8c-485f-b7d3-8444e6ae674f",
  },
  {
    name: "BID Test Store - Champs",
    platformStoreId: "c91ce9ac-1738-4107-b774-6e1f7bbd1dc6",
  },
  {
    name: "BID Test Store - Republique",
    platformStoreId: "93c6ea88-b2cf-4325-8616-06637d908fdd",
  },
] as const

export const seedIntegrations = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Fetch all existing internal stores
    const stores = await ctx.db.query("stores").collect()

    if (stores.length === 0) {
      throw new Error("No stores found in the database. Create at least one store first.")
    }

    const now = Date.now()
    const results: Array<{ storeName: string; uberStore: string; integrationId: string }> = []

    for (let i = 0; i < UBER_EATS_TEST_STORES.length; i++) {
      const uberStore = UBER_EATS_TEST_STORES[i]
      // Assign to existing stores (cycle if fewer internal stores than test stores)
      const internalStore = stores[i % stores.length]

      // Check if integration already exists for this store+platform
      const existing = await ctx.db
        .query("storeIntegrations")
        .withIndex("by_store_platform", (q) =>
          q.eq("storeId", internalStore._id).eq("platform", "uberEats")
        )
        .first()

      if (existing) {
        // Update with new platformStoreId
        await ctx.db.patch(existing._id, {
          platformStoreId: uberStore.platformStoreId,
          enabled: true,
          updatedAt: now,
        })
        results.push({
          storeName: internalStore.name,
          uberStore: uberStore.name,
          integrationId: existing._id,
        })
      } else {
        const id = await ctx.db.insert("storeIntegrations", {
          storeId: internalStore._id,
          platform: "uberEats",
          platformStoreId: uberStore.platformStoreId,
          syncMenu: true,
          autoAccept: false,
          orderMode: "manual",
          enabled: true,
          storeStatus: "ONLINE",
          prepTime: 20,
          menuSyncStatus: "idle",
          createdAt: now,
          updatedAt: now,
        })
        results.push({
          storeName: internalStore.name,
          uberStore: uberStore.name,
          integrationId: id,
        })
      }
    }

    console.log("Uber Eats test integrations seeded:", results)
    return results
  },
})
