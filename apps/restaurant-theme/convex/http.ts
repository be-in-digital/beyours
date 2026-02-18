import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { handleWebhook as uberEatsWebhook } from "./uberEatsWebhook";
import { handleWebhook as deliverooWebhook } from "./deliverooWebhookHandler";

const http = httpRouter();

// Uber Eats webhooks
http.route({
  path: "/webhooks/uber-eats",
  method: "POST",
  handler: uberEatsWebhook,
});

// Deliveroo webhooks
http.route({
  path: "/webhooks/deliveroo",
  method: "POST",
  handler: deliverooWebhook,
});

// Register Better Auth HTTP routes (sign-in, sign-up, callbacks, etc.)
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
