"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Validate integration credentials before saving.
 *
 * Calls the platform API to verify that the credentials (from env vars)
 * and the provided store/brand IDs are valid.
 *
 * - Uber Eats: calls getStoreStatus(credentials, storeId)
 * - Deliveroo: calls getAccessToken(credentials) then fetches /v1/brands/{brandId}/menus
 */
export const validate = action({
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
    brandId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ valid: boolean; error?: string }> => {
    if (args.platform === "uberEats") {
      const clientId = process.env.UBER_EATS_CLIENT_ID;
      const clientSecret = process.env.UBER_EATS_CLIENT_SECRET;
      const sandboxMode = process.env.UBER_EATS_SANDBOX_MODE === "true";

      if (!clientId || !clientSecret) {
        return {
          valid: false,
          error: "Credentials Uber Eats non configurees dans l'environnement",
        };
      }

      const credentials = { clientId, clientSecret, sandboxMode };

      try {
        const { uberEats } = await import(
          "@beindigital-engine/integrations"
        );

        if (sandboxMode) {
          // The sandbox API doesn't support /stores/{id}/status,
          // so we fetch the store details instead to validate credentials + storeId.
          const response = await uberEats.fetchUberEats(
            credentials,
            `/v1/eats/stores/${args.platformStoreId}`
          );
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Store ID invalide (${response.status}): ${errorText}`
            );
          }
        } else {
          await uberEats.getStoreStatus(credentials, args.platformStoreId);
        }

        return { valid: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return { valid: false, error: message };
      }
    } else {
      // Deliveroo
      const clientId = process.env.DELIVEROO_CLIENT_ID;
      const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
      const sandboxMode = process.env.DELIVEROO_IS_SANDBOX === "true";

      if (!clientId || !clientSecret) {
        return {
          valid: false,
          error: "Credentials Deliveroo non configurees dans l'environnement",
        };
      }

      if (!args.brandId) {
        return {
          valid: false,
          error: "Le Brand ID Deliveroo est requis",
        };
      }

      const credentials = { clientId, clientSecret, sandboxMode };

      try {
        const { deliveroo } = await import(
          "@beindigital-engine/integrations"
        );

        // Step 1: Validate credentials via OAuth
        await deliveroo.getAccessToken(credentials);

        // Step 2: Validate brandId by fetching menus (production only)
        // The Deliveroo sandbox API gateway rejects Bearer tokens,
        // so in sandbox mode we only validate credentials via OAuth.
        if (!sandboxMode) {
          const response = await deliveroo.fetchDeliveroo(
            credentials,
            `/v1/brands/${args.brandId}/menus`,
            {},
            "menu"
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              valid: false,
              error: `Brand ID invalide (${response.status}): ${errorText}`,
            };
          }
        }

        return { valid: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return { valid: false, error: message };
      }
    }
  },
});
