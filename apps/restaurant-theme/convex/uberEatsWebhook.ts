import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type StoreIntegrationRecord = {
  _id: Id<"storeIntegrations">
  storeId: Id<"stores">
  platform: "uberEats" | "deliveroo"
  platformStoreId: string
  enabled: boolean
  autoAccept: boolean
}

/**
 * Uber Eats webhook handler
 * Receives thin webhooks (metadata only), fetches full order, maps, and saves.
 * Credentials are read from environment variables (platform-level, not per-client).
 */
export const handleWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("x-uber-signature") ?? ""

    // Read credentials from environment variables (BeInDigital platform credentials)
    const clientId = process.env.UBER_EATS_CLIENT_ID
    const clientSecret = process.env.UBER_EATS_CLIENT_SECRET
    const webhookSecret = process.env.UBER_EATS_WEBHOOK_SECRET
    const sandboxMode = process.env.UBER_EATS_SANDBOX_MODE === "true"

    if (!clientId || !clientSecret) {
      return new Response("Uber Eats credentials not configured in environment", { status: 503 })
    }

    // Verify webhook signature using dedicated webhook secret (falls back to client secret)
    const { uberEats } = await import("@beindigital-engine/integrations")
    const signingSecret = webhookSecret || clientSecret
    const isValid = await uberEats.verifyUberEatsSignature(rawBody, signature, signingSecret)

    if (!isValid) {
      console.error("Invalid Uber Eats webhook signature")
      return new Response("Invalid signature", { status: 401 })
    }

    // Parse webhook event
    const event = JSON.parse(rawBody) as {
      event_type: string
      event_id: string
      meta: {
        resource_id: string
        resource_href: string
        status: string
      }
      resource_href: string
    }

    console.log(`Uber Eats webhook: ${event.event_type} - ${event.meta.resource_id}`)

    // Handle order events
    if (event.event_type === "orders.notification" || event.event_type === "eats.order.status_update") {
      // Fetch full order from Uber Eats API
      const uberCredentials = {
        clientId,
        clientSecret,
        sandboxMode,
      }

      const fullOrder = await uberEats.fetchOrder(uberCredentials, event.meta.resource_id)

      if (!fullOrder) {
        console.error(`Failed to fetch order ${event.meta.resource_id}`)
        return new Response("OK", { status: 200 })
      }

      // Map to unified format
      const unifiedOrder = uberEats.mapUberEatsOrderToUnified(fullOrder)

      // Log the received order for debugging
      console.log(`Received order ${unifiedOrder.displayId} for store ${unifiedOrder.storeExternalId}`)

      // Find the store integration by platformStoreId (storeExternalId)
      const allIntegrations = await ctx.runQuery(
        api.storeIntegrations.listByPlatformEnabled,
        { platform: "uberEats" }
      ) as StoreIntegrationRecord[]

      const integration = allIntegrations.find(
        (i) => i.platformStoreId === unifiedOrder.storeExternalId
      )

      if (!integration) {
        console.error(`No Uber Eats integration found for platformStoreId: ${unifiedOrder.storeExternalId}`)
        return new Response("OK", { status: 200 })
      }

      // Handle new order creation
      if (event.event_type === "orders.notification") {
        // Create order via internal mutation
        const internalOrderId = await ctx.runMutation(internal.orders.createFromWebhook, {
          storeId: integration.storeId,
          externalOrderId: unifiedOrder.externalOrderId,
          platform: "uberEats",
          status: "pending",
          type: unifiedOrder.type,
          customerName: unifiedOrder.customer.name,
          customerPhone: unifiedOrder.customer.phone,
          customerEmail: unifiedOrder.customer.email,
          deliveryAddress: unifiedOrder.delivery?.address ? {
            street: unifiedOrder.delivery.address.street,
            city: unifiedOrder.delivery.address.city,
            postalCode: unifiedOrder.delivery.address.postalCode,
            country: unifiedOrder.delivery.address.country,
          } : undefined,
          items: unifiedOrder.items.map(item => ({
            externalId: item.externalId,
            name: item.name,
            quantity: item.quantity,
            price: item.totalPrice,
            modifiers: item.modifiers.map(mod => ({
              externalId: mod.externalId,
              name: mod.name,
              price: mod.price,
            })),
          })),
          subtotal: unifiedOrder.subtotal,
          total: unifiedOrder.total,
          notes: unifiedOrder.notes,
          createdAt: new Date(unifiedOrder.placedAt).getTime(),
        })

        console.log(`Created internal order ${internalOrderId} from Uber Eats order ${unifiedOrder.externalOrderId}`)

        // Auto-accept if enabled
        if (integration.autoAccept) {
          try {
            await uberEats.acceptOrder(uberCredentials, unifiedOrder.externalOrderId)
            await ctx.runMutation(internal.orders.internalUpdateStatus, {
              id: internalOrderId as Id<"orders">,
              status: "confirmed",
            })
            console.log(`Auto-accepted Uber Eats order ${unifiedOrder.externalOrderId}`)
          } catch (error) {
            console.error(`Failed to auto-accept Uber Eats order:`, error)
          }
        }
      }

      // Handle order status updates
      if (event.event_type === "eats.order.status_update") {
        console.log(`Order status update: ${event.meta.resource_id} -> ${event.meta.status}`)

        // Find the internal order by externalOrderId and update its status
        try {
          await ctx.runMutation(internal.orders.updateFromWebhook, {
            externalOrderId: unifiedOrder.externalOrderId,
            platform: "uberEats" as const,
            status: unifiedOrder.status as "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "completed" | "cancelled",
            updatedAt: Date.now(),
          })
          console.log(`Updated order ${unifiedOrder.externalOrderId} status to ${unifiedOrder.status}`)
        } catch (error) {
          console.error(`Failed to update order status:`, error)
        }
      }

      // Return 200 to acknowledge receipt
      return new Response("OK", { status: 200 })
    }

    // Handle store status events
    if (event.event_type === "eats.store.status_update") {
      console.log(`Store status update: ${event.meta.resource_id} -> ${event.meta.status}`)
      return new Response("OK", { status: 200 })
    }

    // Handle order cancellation
    if (event.event_type === "orders.cancel") {
      console.log(`Order cancelled: ${event.meta.resource_id}`)

      try {
        await ctx.runMutation(internal.orders.updateFromWebhook, {
          externalOrderId: event.meta.resource_id,
          platform: "uberEats" as const,
          status: "cancelled" as const,
          updatedAt: Date.now(),
        })
        console.log(`Cancelled order ${event.meta.resource_id}`)
      } catch (error) {
        console.error(`Failed to cancel order:`, error)
      }

      return new Response("OK", { status: 200 })
    }

    // Unknown event type - still acknowledge
    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("Uber Eats webhook error:", error)
    return new Response("Internal error", { status: 500 })
  }
})
