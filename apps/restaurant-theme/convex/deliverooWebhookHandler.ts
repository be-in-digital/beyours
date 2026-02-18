import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Deliveroo webhook HTTP handler with signature verification.
 *
 * Receives webhooks from Deliveroo, verifies the HMAC-SHA256 signature,
 * then dispatches to internal actions for processing.
 */
export const handleWebhook = httpAction(async (ctx, request) => {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-deliveroo-hmac-sha256") ?? "";
    const requestId = request.headers.get("x-deliveroo-request-id") ?? "";

    // Read signing secret from environment
    const webhookSecret = process.env.DELIVEROO_WEBHOOK_SECRET;
    const clientSecret = process.env.DELIVEROO_CLIENT_SECRET;
    const signingSecret = webhookSecret || clientSecret;

    if (!signingSecret) {
      return new Response("Deliveroo credentials not configured in environment", { status: 503 });
    }

    // Verify webhook signature
    const { deliveroo } = await import("@beindigital-engine/integrations");
    const isValid = await deliveroo.verifyWebhookSignature(rawBody, signature, requestId, signingSecret);

    if (!isValid) {
      console.error("Invalid Deliveroo webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse the payload to determine event type
    const payload = JSON.parse(rawBody) as {
      event?: string;
      order?: { site_id?: string; brand_id?: string };
      brand_id?: string;
      site_id?: string;
    };

    // Dispatch: order webhook vs menu webhook
    if (payload.order) {
      await ctx.runAction(internal.deliverooWebhook.processOrderWebhook, {
        payload: rawBody,
      });
    } else if (payload.event?.startsWith("menu.")) {
      await ctx.runAction(internal.deliverooWebhook.processMenuWebhook, {
        event: payload.event,
        brandId: payload.brand_id ?? "",
        siteId: payload.site_id ?? "",
        payload: rawBody,
      });
    } else {
      console.log(`Unknown Deliveroo webhook event: ${payload.event ?? "no event field"}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Deliveroo webhook error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
