import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { handleWebhook as uberEatsWebhook } from "./uberEatsWebhook";

const http = httpRouter();

// Uber Eats webhooks
http.route({
  path: "/webhooks/uber-eats",
  method: "POST",
  handler: uberEatsWebhook,
});

// Register Better Auth HTTP routes (sign-in, sign-up, callbacks, etc.)
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
