/// <reference types="vite/client" />

/**
 * What the Stripe webhook accepts, and what it must not.
 *
 * `verifyStripeSignature` guards both money routes and had three defects, each
 * measured against the real route:
 *
 *     valid signature FIRST  -> 200
 *     valid signature SECOND -> 400      <- a secret roll drops every delivery
 *     t=abc (NaN)            -> 200      <- the replay window was not enforced
 *
 * The first is the expensive one. The `Stripe-Signature` header carries ONE
 * SIGNATURE PER ACTIVE SIGNING SECRET, so during a roll — the operation
 * Stripe itself recommends — a delivery arrives signed with both, in no
 * promised order. Reading only the first turned routine hygiene into a
 * self-inflicted outage on the money path.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import schema from "../../convex/schema";
import { stubWebhookSecrets } from "./helpers/stripeWebhook";

const modules = import.meta.glob("../../convex/**/*.ts");

/** Being rotated out. */
const OLD_SECRET = "whsec_old_being_rotated_out";
/** Just rolled, and what the deployment is configured with. */
const NEW_SECRET = "whsec_new_just_rolled";

let restoreSecrets: () => void;
beforeEach(() => {
  restoreSecrets = stubWebhookSecrets({ account: NEW_SECRET });
});
afterEach(() => restoreSecrets());

async function hmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let counter = 0;
/** An event type no handler claims, so only the signature decides the answer. */
function body(): string {
  return JSON.stringify({
    id: `evt_sig_${++counter}`,
    type: "customer.subscription.trial_will_end",
    api_version: "2026-02-25.clover",
    data: { object: { id: "sub_1", object: "subscription" } },
  });
}

async function post(payload: string, signature: string): Promise<number> {
  const t = convexTest(schema, modules);
  const res = await t.fetch("/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  });
  return res.status;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

describe("a secret roll does not drop deliveries", () => {
  test.each([
    ["the live signature first", (live: string, old: string) => `v1=${live},v1=${old}`],
    ["the live signature second", (live: string, old: string) => `v1=${old},v1=${live}`],
    ["the live signature third", (live: string, old: string) => `v1=${old},v1=${old},v1=${live}`],
  ])("%s is accepted", async (_label, order) => {
    /* Stripe promises one signature per active secret, and no order among
       them. Only the second case was ever broken, which is exactly why it
       would have shipped: a roll looks fine until it isn't. */
    const payload = body();
    const ts = now();
    const live = await hmacHex(`${ts}.${payload}`, NEW_SECRET);
    const old = await hmacHex(`${ts}.${payload}`, OLD_SECRET);

    expect(await post(payload, `t=${ts},${order(live, old)}`)).toBe(200);
  });

  test("whitespace between the parts is tolerated", async () => {
    const payload = body();
    const ts = now();
    const live = await hmacHex(`${ts}.${payload}`, NEW_SECRET);
    const old = await hmacHex(`${ts}.${payload}`, OLD_SECRET);

    expect(await post(payload, `t=${ts}, v1=${old}, v1=${live}`)).toBe(200);
  });

  test("a list of wrong signatures is still refused", async () => {
    // Accepting ANY of several must not become accepting because there are
    // several.
    const payload = body();
    const ts = now();
    const old = await hmacHex(`${ts}.${payload}`, OLD_SECRET);

    expect(await post(payload, `t=${ts},v1=${old},v1=${old},v1=${old}`)).toBe(400);
  });

  test("a flood of candidates cannot smuggle one past the cap", async () => {
    /* The bound exists so an unbounded list is not a free amplification. It
       must not become a way to have the real signature ignored — so the
       refusal here is the correct outcome, and the accepted cases above prove
       a genuine roll still fits well inside it. */
    const payload = body();
    const ts = now();
    const old = await hmacHex(`${ts}.${payload}`, OLD_SECRET);
    const live = await hmacHex(`${ts}.${payload}`, NEW_SECRET);
    const flood = Array.from({ length: 50 }, () => `v1=${old}`).join(",");

    expect(await post(payload, `t=${ts},${flood},v1=${live}`)).toBe(400);
  });
});

describe("the replay window is actually enforced", () => {
  test.each([
    ["a non-numeric timestamp", "abc"],
    ["a partly-numeric timestamp", "12abc"],
    ["an empty timestamp", ""],
    ["Infinity", "Infinity"],
    ["NaN", "NaN"],
  ])("%s is refused", async (_label, ts) => {
    /* `parseInt("abc")` is NaN and `NaN > 300` is false, so a malformed `t`
       used to skip the window entirely — the control was one header away from
       not existing. The signature is computed over the malformed value, so
       these are correctly signed requests: only the timestamp check refuses
       them. */
    const payload = body();
    const sig = await hmacHex(`${ts}.${payload}`, NEW_SECRET);

    expect(await post(payload, `t=${ts},v1=${sig}`)).toBe(400);
  });

  test.each([
    ["a day old", -86_400],
    ["a day in the future", 86_400],
    ["just outside the window", -301],
  ])("a timestamp %s is refused", async (_label, offset) => {
    const payload = body();
    const ts = now() + offset;
    const sig = await hmacHex(`${ts}.${payload}`, NEW_SECRET);

    expect(await post(payload, `t=${ts},v1=${sig}`)).toBe(400);
  });

  test("a fresh timestamp is accepted", async () => {
    const payload = body();
    const ts = now();
    const sig = await hmacHex(`${ts}.${payload}`, NEW_SECRET);

    expect(await post(payload, `t=${ts},v1=${sig}`)).toBe(200);
  });
});

describe("what was already refused stays refused", () => {
  test("an unsigned request", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/webhooks/stripe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body(),
    });
    expect(res.status).toBe(400);
  });

  test.each([
    ["no v1 at all", (ts: number) => `t=${ts}`],
    ["a v0 signature", (ts: number) => `t=${ts},v0=deadbeef`],
    ["no timestamp", () => "v1=deadbeef"],
    ["an empty header", () => ""],
    ["nonsense", () => "not-a-signature"],
  ])("%s", async (_label, header) => {
    expect(await post(body(), header(now()))).toBe(400);
  });

  test("a signature of the right shape but the wrong value", async () => {
    const payload = body();
    const ts = now();
    const live = await hmacHex(`${ts}.${payload}`, NEW_SECRET);
    // Same length, one character off — the case a non-constant-time compare
    // would answer fastest.
    const nearly = (live[0] === "a" ? "b" : "a") + live.slice(1);

    expect(await post(payload, `t=${ts},v1=${nearly}`)).toBe(400);
  });

  test("a body altered after signing", async () => {
    const payload = body();
    const ts = now();
    const sig = await hmacHex(`${ts}.${payload}`, NEW_SECRET);

    expect(await post(payload + " ", `t=${ts},v1=${sig}`)).toBe(400);
  });
});
