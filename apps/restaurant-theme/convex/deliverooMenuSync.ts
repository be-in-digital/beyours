"use node";

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import {
  buildDeliverooMenuPayload,
  type StoreIntegrationRecord,
  type ProductRecord,
  type CategoryRecord,
} from "@beindigital-engine/convex-functions/deliverooMenuSync";

/**
 * Sync menu to a single Deliveroo store.
 *
 * This is a public action callable from the client (e.g. admin UI "Sync Now" button).
 *
 * Flow:
 * 1. Get the store integration for deliveroo
 * 2. Check syncMenu=true and enabled=true
 * 3. Validate brandId is present
 * 4. Update menuSyncStatus to "syncing"
 * 5. Fetch all products and categories from DB
 * 6. Format as Deliveroo menu payload
 * 7. Read credentials from process.env
 * 8. Call deliveroo.pushMenu() from integrations package
 * 9. Update menuSyncStatus to "success" or "error"
 */
export const syncStore = action({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    // 1. Get the store integration for deliveroo
    const integration = await ctx.runQuery(
      api.storeIntegrations.getByStorePlatform,
      { storeId: args.storeId, platform: "deliveroo" }
    ) as StoreIntegrationRecord | null;

    if (!integration) {
      console.error(`No Deliveroo integration found for store ${args.storeId}`);
      return { success: false, error: "No Deliveroo integration configured" };
    }

    // 2. Check syncMenu and enabled flags
    if (!integration.enabled) {
      console.log(`Deliveroo integration disabled for store ${args.storeId}`);
      return { success: false, error: "Integration is disabled" };
    }

    if (!integration.syncMenu) {
      console.log(`Menu sync disabled for store ${args.storeId}`);
      return { success: false, error: "Menu sync is disabled" };
    }

    // 3. Validate brandId is present
    if (!integration.brandId) {
      console.error(`No brandId configured for Deliveroo integration on store ${args.storeId}`);
      return { success: false, error: "Deliveroo brandId not configured" };
    }

    // 4. Update status to "syncing"
    await ctx.runMutation(api.storeIntegrations.updateMenuSyncStatus, {
      storeId: args.storeId,
      platform: "deliveroo",
      menuSyncStatus: "syncing",
    });

    try {
      // 5. Fetch all products and categories
      const products = await ctx.runQuery(api.products.list, {
        storeId: args.storeId,
      }) as ProductRecord[];

      const categories = await ctx.runQuery(api.categories.list, {
        storeId: args.storeId,
      }) as CategoryRecord[];

      // 6. Build menu payload
      const menuPayload = buildDeliverooMenuPayload(products, categories);

      // 7. Read credentials from environment
      const clientId = process.env.DELIVEROO_CLIENT_ID;
      const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
      const sandboxMode = process.env.DELIVEROO_IS_SANDBOX === "true";

      if (!clientId || !clientSecret) {
        throw new Error("Deliveroo API credentials not configured in environment");
      }

      const credentials = { clientId, clientSecret, sandboxMode };

      // 8. Push menu to Deliveroo
      const { deliveroo } = await import("@beindigital-engine/integrations");
      await deliveroo.pushMenu(
        credentials,
        integration.brandId,
        integration.platformStoreId,
        menuPayload as unknown as Parameters<typeof deliveroo.pushMenu>[3]
      );

      // 9. Update status to "success"
      await ctx.runMutation(api.storeIntegrations.updateMenuSyncStatus, {
        storeId: args.storeId,
        platform: "deliveroo",
        menuSyncStatus: "success",
      });

      console.log(`Menu synced successfully for store ${args.storeId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Menu sync failed for store ${args.storeId}:`, errorMessage);

      // Update status to "error"
      await ctx.runMutation(api.storeIntegrations.updateMenuSyncStatus, {
        storeId: args.storeId,
        platform: "deliveroo",
        menuSyncStatus: "error",
        menuSyncError: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Sync menu to ALL stores that have Deliveroo sync enabled.
 *
 * This is an internal action triggered automatically after product mutations.
 * It queries all enabled Deliveroo integrations with syncMenu=true and
 * schedules individual syncStore actions for each.
 */
export const syncAllStores = action({
  args: {},
  handler: async (ctx) => {
    // Query all enabled Deliveroo integrations
    const allIntegrations = await ctx.runQuery(
      api.storeIntegrations.listByPlatformEnabled,
      { platform: "deliveroo" }
    ) as StoreIntegrationRecord[];

    // Filter to only those with menu sync enabled and brandId present
    const syncableIntegrations = allIntegrations.filter(
      (i) => i.syncMenu && i.enabled && i.brandId
    );

    if (syncableIntegrations.length === 0) {
      console.log("No stores with Deliveroo menu sync enabled");
      return { synced: 0 };
    }

    // Schedule sync for each store (runs in parallel as separate actions)
    for (const integration of syncableIntegrations) {
      await ctx.scheduler.runAfter(
        0,
        api.deliverooMenuSync.syncStore,
        { storeId: integration.storeId as Id<"stores"> }
      );
    }

    console.log(`Scheduled menu sync for ${syncableIntegrations.length} store(s)`);
    return { synced: syncableIntegrations.length };
  },
});
