import { httpAction } from "./_generated/server";

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
      return new Response("OK", { status: 200 })
    }

    // Unknown event type - still acknowledge
    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("Uber Eats webhook error:", error)
    return new Response("Internal error", { status: 500 })
  }
})
