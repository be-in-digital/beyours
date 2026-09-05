/**
 * Posting a signed event at the Stripe webhook routes.
 *
 * `sign` must stay bit-identical to `verifyStripeSignature`
 * (convex/http.ts) — it is the one thing here that, if it drifts, turns every
 * webhook test into a test of the 400 path. That is why it lives in one file
 * rather than being copied per suite.
 */

import type { convexTest } from "convex-test";

type TestConvex = ReturnType<typeof convexTest>;

/** The scheme the route verifies: `t=<ts>,v1=<hex hmac of "ts.body">`. */
export async function sign(body: string, secret: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${body}`));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

/** POST a raw body, with or without a signature header. */
export async function post(
  t: TestConvex,
  path: string,
  body: string,
  signature?: string,
): Promise<Response> {
  return await t.fetch(path, {
    method: "POST",
    headers: signature
      ? { "stripe-signature": signature, "content-type": "application/json" }
      : { "content-type": "application/json" },
    body,
  });
}

/** POST a correctly signed body at the account-scoped route. */
export async function postSigned(
  t: TestConvex,
  path: string,
  body: string,
  secret: string,
): Promise<Response> {
  return await post(t, path, body, await sign(body, secret));
}

/**
 * Save and restore the two webhook secrets around a suite.
 *
 * Returns the restore function; call it from `afterEach`. Pinning both matters
 * even for a suite that uses one: the routes are told apart by their secret.
 */
export function stubWebhookSecrets(secrets: {
  account?: string;
  connect?: string;
}): () => void {
  const saved: Record<string, string | undefined> = {
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  };
  if (secrets.account !== undefined) {
    process.env.STRIPE_WEBHOOK_SECRET = secrets.account;
  }
  if (secrets.connect !== undefined) {
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = secrets.connect;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}
