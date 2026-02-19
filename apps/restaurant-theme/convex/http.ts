import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { handleWebhook as uberEatsWebhook } from "./uberEatsWebhook";
import { handleWebhook as deliverooWebhook } from "./deliverooWebhookHandler";
import { stripeCallback, stripeRefresh, sumupCallback } from "./oauthCallbackHandlers";

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

// OAuth payment provider callbacks
http.route({
  path: "/connect/stripe/callback",
  method: "GET",
  handler: stripeCallback,
});

http.route({
  path: "/connect/stripe/refresh",
  method: "GET",
  handler: stripeRefresh,
});

http.route({
  path: "/connect/sumup/callback",
  method: "GET",
  handler: sumupCallback,
});

// Register Better Auth HTTP routes (sign-in, sign-up, callbacks, etc.)
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
