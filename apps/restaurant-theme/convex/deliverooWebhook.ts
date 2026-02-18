"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Inline Deliveroo webhook types to avoid importing from integrations package
// (which includes Node.js crypto and breaks Convex bundling)
interface DeliverooPrice {
  fractional: number
  currency_code: string
}

interface DeliverooWebhookPayload {
  order: {
    id: string
    site_id: string
    brand_id: string
    status: string
    order_type: "delivery" | "collection"
    created_at: string
    updated_at: string
    customer: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
    }
    delivery_address?: {
      address_line_1?: string
      address_line_2?: string
      city?: string
      postcode?: string
      country?: string
      latitude?: number
      longitude?: number
    }
    delivery_instructions?: string
    items: Array<{
      id: string
      name: string
      quantity: number
      price: DeliverooPrice
      options?: Array<{
        id?: string
        name: string
        price?: DeliverooPrice
      }>
      notes?: string
    }>
    payment: {
      subtotal: DeliverooPrice
      tax?: DeliverooPrice
      delivery_fee?: DeliverooPrice
      total: DeliverooPrice
    }
    notes?: string
  }
}

type StoreIntegrationRecord = {
  _id: Id<"storeIntegrations">
  storeId: Id<"stores">
  platform: "uberEats" | "deliveroo"
  platformStoreId: string
  brandId?: string
  enabled: boolean
  autoAccept: boolean
}

/**
 * Process Deliveroo order webhook.
 *
 * Flow:
 * 1. Parse the JSON payload into DeliverooWebhookPayload shape
 * 2. Find storeId by looking up the store integration by platformStoreId (site_id)
 * 3. Create order via createFromWebhook mutation (handles deduplication via externalOrderId)
 * 4. Send sync status to Deliveroo
 * 5. Auto-accept if enabled
 */
export const processOrderWebhook = internalAction({
  args: { payload: v.string() },
  handler: async (ctx, args) => {
    try {
      // 1. Parse payload
      const webhookData = JSON.parse(args.payload) as DeliverooWebhookPayload;
      const order = webhookData.order;

      if (!order) {
        console.error("No order data in webhook payload");
        return { success: false, error: "No order data in payload" };
      }

      // 2. Find store by platformStoreId (site_id)
      const allIntegrations = await ctx.runQuery(
        api.storeIntegrations.listByPlatformEnabled,
        { platform: "deliveroo" }
      ) as StoreIntegrationRecord[];

      const integration = allIntegrations.find(
        (i) => i.platformStoreId === order.site_id
      );

      if (!integration) {
        console.error(`No Deliveroo integration found for site_id: ${order.site_id}`);
        return { success: false, error: `No integration found for site_id: ${order.site_id}` };
      }

      const storeId = integration.storeId;

      // 3. Map and create order via createFromWebhook
      const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim();
      const orderType = order.order_type === "collection" ? "pickup" as const : "delivery" as const;

      const items = order.items.map((item) => ({
        externalId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price.fractional,
        modifiers: item.options?.map((opt) => ({
          externalId: opt.id ?? "",
          name: opt.name,
          price: opt.price?.fractional ?? 0,
        })),
      }));

      const deliveryAddress = order.delivery_address ? {
        street: `${order.delivery_address.address_line_1 ?? ""} ${order.delivery_address.address_line_2 ?? ""}`.trim(),
        city: order.delivery_address.city ?? "",
        postalCode: order.delivery_address.postcode ?? "",
        country: order.delivery_address.country ?? "GB",
      } : undefined;

      const subtotal = order.payment.subtotal.fractional;
      const total = order.payment.total.fractional;

      const internalOrderId: string = await ctx.runMutation(internal.orders.createFromWebhook, {
        storeId,
        externalOrderId: order.id,
        platform: "deliveroo",
        status: "pending",
        type: orderType,
        customerName,
        customerPhone: order.customer.phone,
        customerEmail: order.customer.email,
        deliveryAddress,
        items,
        subtotal,
        total,
        notes: order.notes,
        createdAt: Date.now(),
      }) as string;

      console.log(`Created internal order ${internalOrderId} from Deliveroo order ${order.id}`);

      // 4. Get credentials and send sync status
      const clientId = process.env.DELIVEROO_CLIENT_ID;
      const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
      const sandboxMode = process.env.DELIVEROO_IS_SANDBOX === "true";

      if (clientId && clientSecret) {
        const credentials = { clientId, clientSecret, sandboxMode };
        const { deliveroo } = await import("@beindigital-engine/integrations");

        try {
          await deliveroo.sendSyncStatus(credentials, order.id, "success");
        } catch (error) {
          console.error(`Failed to send sync status to Deliveroo:`, error);
        }

        // 5. Auto-accept if enabled
        if (integration.autoAccept) {
          try {
            await deliveroo.acceptOrder(credentials, order.id);
            await ctx.runMutation(internal.orders.internalUpdateStatus, {
              id: internalOrderId as Id<"orders">,
              status: "confirmed",
            });
            console.log(`Auto-accepted Deliveroo order ${order.id}`);
          } catch (error) {
            console.error(`Failed to auto-accept Deliveroo order:`, error);
          }
        }
      }

      console.log(`Successfully processed Deliveroo order ${order.id} -> ${internalOrderId}`);
      return { success: true, internalOrderId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to process Deliveroo order webhook:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Process Deliveroo menu webhook events.
 *
 * Handles menu upload status updates:
 * - menu.upload_completed → success
 * - menu.upload_failed → error
 * - menu.validation_error → error with details
 */
export const processMenuWebhook = internalAction({
  args: {
    event: v.string(),
    brandId: v.string(),
    siteId: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Find the store integration by siteId (platformStoreId)
      const allIntegrations = await ctx.runQuery(
        api.storeIntegrations.listByPlatformEnabled,
        { platform: "deliveroo" }
      ) as StoreIntegrationRecord[];

      const integration = allIntegrations.find(
        (i) => i.platformStoreId === args.siteId
      );

      if (!integration) {
        console.error(`No Deliveroo integration found for siteId: ${args.siteId}`);
        return { success: false, error: `No integration found for siteId: ${args.siteId}` };
      }

      const storeId = integration.storeId;

      // Handle different event types
      if (args.event === "menu.upload_completed") {
        await ctx.runMutation(internal.storeIntegrations.internalUpdateMenuSyncStatus, {
          storeId,
          platform: "deliveroo",
          menuSyncStatus: "success",
        });
        console.log(`Menu upload completed for store ${storeId}`);
      } else if (args.event === "menu.upload_failed") {
        const failPayload = JSON.parse(args.payload) as { error?: string };
        const failError = failPayload.error ?? "Menu upload failed";
        await ctx.runMutation(internal.storeIntegrations.internalUpdateMenuSyncStatus, {
          storeId,
          platform: "deliveroo",
          menuSyncStatus: "error",
          menuSyncError: failError,
        });
        console.error(`Menu upload failed for store ${storeId}: ${failError}`);
      } else if (args.event === "menu.validation_error") {
        const validationPayload = JSON.parse(args.payload) as { errors?: unknown };
        const validationError = validationPayload.errors
          ? JSON.stringify(validationPayload.errors)
          : "Menu validation error";
        await ctx.runMutation(internal.storeIntegrations.internalUpdateMenuSyncStatus, {
          storeId,
          platform: "deliveroo",
          menuSyncStatus: "error",
          menuSyncError: validationError,
        });
        console.error(`Menu validation error for store ${storeId}: ${validationError}`);
      } else {
        console.log(`Unknown menu event: ${args.event}`);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to process Deliveroo menu webhook:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
