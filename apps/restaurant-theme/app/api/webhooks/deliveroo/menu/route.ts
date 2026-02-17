import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../../../convex/_generated/api"
import { deliveroo } from "@beindigital-engine/integrations"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

/**
 * Deliveroo Menu Webhook Handler
 *
 * Handles:
 * - menu.upload_completed: Menu update succeeded
 * - menu.upload_failed: Menu update failed
 * - menu.validation_error: Menu validation failed
 */
export async function POST(request: Request) {
  try {
    // 1. Read raw body (needed for signature verification)
    const rawBody = await request.text()

    // 2. Extract Deliveroo headers
    const signature = request.headers.get("X-Deliveroo-Hmac-SHA256") ?? ""
    const requestId = request.headers.get("X-Deliveroo-Request-Id") ?? ""

    // 3. Verify webhook signature
    const webhookSecret = process.env.DELIVEROO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("DELIVEROO_WEBHOOK_SECRET not configured")
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const isValid = await deliveroo.verifyWebhookSignature(
      rawBody,
      signature,
      requestId,
      webhookSecret
    )

    if (!isValid) {
      console.error("Invalid Deliveroo webhook signature", { requestId })
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // 4. Parse payload to extract event info
    const webhook = JSON.parse(rawBody) as {
      event_type: string
      brand_id: string
      site_id?: string
    }

    // 5. Process webhook via Convex action
    const result = await convex.action(api.deliverooWebhook.processMenuWebhook, {
      event: webhook.event_type,
      brandId: webhook.brand_id,
      siteId: webhook.site_id ?? "",
      payload: rawBody,
    })

    console.log("Deliveroo menu webhook processed:", result)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Deliveroo menu webhook error:", error)

    // Return 200 to prevent Deliveroo from retrying
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
}
