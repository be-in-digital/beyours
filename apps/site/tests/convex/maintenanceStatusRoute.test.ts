/// <reference types="vite/client" />

/**
 * GET /maintenance/status — the endpoint a client site's update scripts ask
 * before they pull anything (apps/themes/scripts/lib/maintenance.mjs).
 *
 * It had no test at all, which is where the defect of #181 lived: `byLicenseKey`
 * answering `null` for a key nobody holds, and the route turning that `null`
 * into `entitled: true`. Every renewal was therefore collectable only by asking
 * nicely — a made-up key entitled exactly as well as a real one.
 *
 * The route is now the one place the gate opens or closes, so these cases run it
 * under BOTH policies. Read them as a pair: forgiving is what production answers
 * today, strict is what it answers once every delivered site is registered.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import schema from "../../convex/schema";
import { LICENSE_ENFORCEMENT_ENV } from "../../convex/maintenance";

const modules = import.meta.glob("../../convex/**/*.ts");

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

let savedPolicy: string | undefined;

beforeEach(() => {
  savedPolicy = process.env[LICENSE_ENFORCEMENT_ENV];
  delete process.env[LICENSE_ENFORCEMENT_ENV];
});

afterEach(() => {
  if (savedPolicy === undefined) delete process.env[LICENSE_ENFORCEMENT_ENV];
  else process.env[LICENSE_ENFORCEMENT_ENV] = savedPolicy;
});

function enforceStrictly() {
  process.env[LICENSE_ENFORCEMENT_ENV] = "strict";
}

type StatusBody = {
  found: boolean;
  site?: string;
  entitled: boolean;
  reason: string;
  coveredUntil: number | null;
  message: string;
};

async function ask(
  t: ReturnType<typeof convexTest>,
  key?: string,
): Promise<{ status: number; body: StatusBody }> {
  const path =
    key === undefined
      ? "/maintenance/status"
      : `/maintenance/status?key=${encodeURIComponent(key)}`;
  const res = await t.fetch(path, { method: "GET" });
  return { status: res.status, body: (await res.json()) as StatusBody };
}

/** A registered site: a deployment holding `bys_registered`, and its order. */
async function seedRegisteredSite(
  t: ReturnType<typeof convexTest>,
  subscriptionOver: Record<string, unknown> = {},
) {
  await t.run(async (ctx) => {
    const orderId = await ctx.db.insert("orders", {
      customerEmail: "chef@example.com",
      customerFirstName: "Alex",
      customerLastName: "Martin",
      customerPhone: "+33600000000",
      restaurantName: "Chez Alex",
      city: "Paris",
      buyerType: "business" as const,
      plan: "essentielle" as const,
      orderType: "creation" as const,
      amountCents: 100000,
      status: "paid" as const,
      createdAt: NOW,
    });
    await ctx.db.insert("saDeployments", {
      customerEmail: "chef@example.com",
      restaurantName: "Chez Alex",
      city: "Paris",
      orderId,
      name: "chez-alex",
      domain: "chez-alex.fr",
      environment: "production" as const,
      status: "live" as const,
      health: "healthy" as const,
      region: "eu-west-3",
      plan: "essentielle" as const,
      uptime30d: 100,
      storeCount: 1,
      provisionedAt: NOW,
      integrations: [],
      maintenance: { status: "active" as const, autoRenew: true },
      licenseKey: "bys_registered",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await ctx.db.insert("subscriptions", {
      orderId,
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      customerEmail: "chef@example.com",
      plan: "essentielle" as const,
      billingPeriod: "yearly" as const,
      status: "active" as const,
      createdAt: NOW,
      ...subscriptionOver,
    });
  });
}

describe("a key no deployment holds — forgiving, the default", () => {
  test("an invented key is let through and named as unregistered", async () => {
    const t = convexTest(schema, modules);

    const { body } = await ask(t, "bys_madeup");

    expect(body.found).toBe(false);
    expect(body.entitled).toBe(true);
    expect(body.reason).toBe("unregistered");
  });

  test("no key at all is let through too", async () => {
    const t = convexTest(schema, modules);

    const { body } = await ask(t);

    expect(body.entitled).toBe(true);
    expect(body.reason).toBe("unregistered");
  });
});

describe("a key no deployment holds — strict", () => {
  test("an invented key is refused", async () => {
    const t = convexTest(schema, modules);
    enforceStrictly();

    const { body } = await ask(t, "bys_madeup");

    expect(body.found).toBe(false);
    expect(body.entitled).toBe(false);
    expect(body.reason).toBe("unknown_key");
  });

  test("no key at all is refused", async () => {
    const t = convexTest(schema, modules);
    enforceStrictly();

    expect((await ask(t)).body.entitled).toBe(false);
  });

  test("an empty key is refused", async () => {
    const t = convexTest(schema, modules);
    enforceStrictly();

    expect((await ask(t, "")).body.entitled).toBe(false);
  });

  /* The refusal has to arrive as a body, not as a status code. The client
     script treats any non-2xx as « the API is unreachable » and updates
     anyway, so a 403 here would fail OPEN — and would look like enforcement
     while being the opposite of it. */
  test("the refusal is an HTTP 200 the client script can read", async () => {
    const t = convexTest(schema, modules);
    enforceStrictly();

    const { status, body } = await ask(t, "bys_madeup");

    expect(status).toBe(200);
    expect(body.entitled).toBe(false);
    expect(body.message).toMatch(/Clé de licence inconnue/);
  });

  /* Anything short of the exact word leaves the gate open: a fumbled flag must
     not brick the updates of a client who pays. */
  test.each(["1", "true", "STRICT", "strict ", "yes", ""])(
    "%o does not close the gate",
    async (value) => {
      const t = convexTest(schema, modules);
      process.env[LICENSE_ENFORCEMENT_ENV] = value;

      expect((await ask(t, "bys_madeup")).body.entitled).toBe(true);
    },
  );
});

describe("a registered key", () => {
  test("is accepted, under either policy", async () => {
    for (const strict of [false, true]) {
      const t = convexTest(schema, modules);
      await seedRegisteredSite(t);
      if (strict) enforceStrictly();

      const { body } = await ask(t, "bys_registered");

      expect(body.found).toBe(true);
      expect(body.site).toBe("chez-alex");
      expect(body.entitled).toBe(true);
      expect(body.reason).toBe("active");
    }
  });

  /* The point of registering keys: this site is now refusable, and strictness
     has nothing to do with it — the contract decides. */
  test("whose contract has lapsed is refused, under either policy", async () => {
    for (const strict of [false, true]) {
      const t = convexTest(schema, modules);
      await seedRegisteredSite(t, {
        status: "canceled" as const,
        currentPeriodEnd: Date.now() - 30 * DAY,
      });
      if (strict) enforceStrictly();

      const { body } = await ask(t, "bys_registered");

      expect(body.entitled).toBe(false);
      expect(body.reason).toBe("cancelled");
    }
  });

  /* A registered site whose subscription row we never linked is a bookkeeping
     miss on our side, not a licence we never issued. It stays forgiven even
     under strict enforcement — that looseness is deliberate and separate. */
  test("with no subscription on record stays forgiven under strict", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("saDeployments", {
        customerEmail: "chef@example.com",
        restaurantName: "Chez Alex",
        city: "Paris",
        name: "chez-alex",
        domain: "chez-alex.fr",
        environment: "production" as const,
        status: "live" as const,
        health: "healthy" as const,
        region: "eu-west-3",
        plan: "essentielle" as const,
        uptime30d: 100,
        storeCount: 1,
        provisionedAt: NOW,
        integrations: [],
        maintenance: { status: "none" as const, autoRenew: false },
        licenseKey: "bys_registered",
        createdAt: NOW,
        updatedAt: NOW,
      });
    });
    enforceStrictly();

    const { body } = await ask(t, "bys_registered");

    expect(body.found).toBe(true);
    expect(body.entitled).toBe(true);
    expect(body.reason).toBe("unregistered");
  });
});
