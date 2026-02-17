"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// Input validation patterns
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_REGEX = /^\d{1,20}$/;

/**
 * Sanitize API error messages before returning to frontend.
 * Strips raw API responses that may contain infrastructure details.
 */
function sanitizeApiError(status: number, context: string): string {
  switch (status) {
    case 400:
      return `${context} : requete invalide. Verifiez l'identifiant.`;
    case 401:
      return `${context} : credentials invalides.`;
    case 403:
      return `${context} : acces refuse. Verifiez que vos credentials ont acces a cette ressource.`;
    case 404:
      return `${context} : ressource introuvable. Verifiez l'identifiant.`;
    default:
      return `${context} : erreur de validation (${status}). Veuillez reessayer.`;
  }
}

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
  handler: async (ctx, args): Promise<{ valid: boolean; error?: string }> => {
    // C-01: Authentication check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { valid: false, error: "Non authentifie" };
    }

    if (args.platform === "uberEats") {
      // C-02: Input validation - Uber Eats store IDs are UUIDs
      if (!UUID_REGEX.test(args.platformStoreId)) {
        return {
          valid: false,
          error: "Format d'ID Uber Eats invalide. Un UUID est attendu (ex: 480eab8c-cc25-4c2b-b92f-70d7a1984f97).",
        };
      }

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
            return {
              valid: false,
              error: sanitizeApiError(response.status, "Store ID Uber Eats"),
            };
          }
        } else {
          await uberEats.getStoreStatus(credentials, args.platformStoreId);
        }

        return { valid: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        // Log full error server-side for debugging
        console.error(`[validateIntegration] Uber Eats error:`, raw);
        // Return sanitized message to client
        if (raw.includes("OAuth failed")) {
          return { valid: false, error: "Credentials Uber Eats invalides." };
        }
        if (raw.includes("Failed to get store status")) {
          return { valid: false, error: "Store ID Uber Eats introuvable ou inaccessible." };
        }
        return { valid: false, error: "Echec de la validation Uber Eats. Veuillez reessayer." };
      }
    } else {
      // Deliveroo
      // C-02: Input validation
      if (args.brandId && !UUID_REGEX.test(args.brandId)) {
        return {
          valid: false,
          error: "Format de Brand ID Deliveroo invalide. Un UUID est attendu (ex: 13eaa505-f059-479f-8ada-c24a1f9c56ec).",
        };
      }
      if (!NUMERIC_ID_REGEX.test(args.platformStoreId)) {
        return {
          valid: false,
          error: "Format d'ID restaurant Deliveroo invalide. Un identifiant numerique est attendu (ex: 101).",
        };
      }

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
            return {
              valid: false,
              error: sanitizeApiError(response.status, "Brand ID Deliveroo"),
            };
          }
        }

        return { valid: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        console.error(`[validateIntegration] Deliveroo error:`, raw);
        if (raw.includes("OAuth failed")) {
          return { valid: false, error: "Credentials Deliveroo invalides." };
        }
        return { valid: false, error: "Echec de la validation Deliveroo. Veuillez reessayer." };
      }
    }
  },
});
