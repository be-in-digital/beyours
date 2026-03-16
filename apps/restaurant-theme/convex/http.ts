import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { handleWebhook as uberEatsWebhook } from "./uberEatsWebhook";
import { handleWebhook as deliverooWebhook } from "./deliverooWebhookHandler";
import { handleWebhook as stripePaymentWebhook } from "./stripeWebhook";
import { stripeCallback, stripeRefresh, sumupCallback } from "./oauthCallbackHandlers";

const http = httpRouter();

// Uber Eats webhooks
http.route({
  path: "/webhooks/uber-eats",
  method: "POST",
  handler: uberEatsWebhook,
});

// Deliveroo webhooks (generic + dedicated order/menu paths)
http.route({
  path: "/webhooks/deliveroo",
  method: "POST",
  handler: deliverooWebhook,
});

http.route({
  path: "/webhooks/deliveroo/order",
  method: "POST",
  handler: deliverooWebhook,
});

http.route({
  path: "/webhooks/deliveroo/menu",
  method: "POST",
  handler: deliverooWebhook,
});

// Stripe payment webhook
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: stripePaymentWebhook,
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
