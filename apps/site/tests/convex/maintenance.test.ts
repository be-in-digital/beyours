/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  MAINTENANCE_GRACE_MS,
  entitlementMessage,
  newLicenseKey,
  resolveEntitlement,
} from "../../convex/maintenance";

const modules = import.meta.glob("../../convex/**/*.ts");

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function entitlement(
  status: "active" | "past_due" | "canceled" | "unpaid" | "incomplete",
  currentPeriodEnd?: number,
) {
  return resolveEntitlement({
    subscription: { status, currentPeriodEnd },
    now: NOW,
  });
}

describe("resolveEntitlement", () => {
  test("a running subscription keeps the updates flowing", () => {
    const e = entitlement("active", NOW + 200 * DAY);
    expect(e.entitled).toBe(true);
    expect(e.reason).toBe("active");
  });

  /* A missed webhook on our side must never cut off a paying client, so
     Stripe's own label wins over a period date that looks stale. */
  test("a running subscription is trusted over a stale period date", () => {
    expect(entitlement("active", NOW - 90 * DAY).entitled).toBe(true);
  });

  test("a failed renewal keeps its updates while Stripe retries", () => {
    const e = entitlement("past_due", NOW - 3 * DAY);
    expect(e.entitled).toBe(true);
    expect(e.reason).toBe("grace");
  });

  test("a failed renewal stops once Stripe has given up", () => {
    const e = entitlement("past_due", NOW - MAINTENANCE_GRACE_MS - DAY);
    expect(e.entitled).toBe(false);
    expect(e.reason).toBe("expired");
  });

  /* The year is paid for: cancelling does not claw back the months left. */
  test("cancelling mid-period stays covered until the period ends", () => {
    const e = entitlement("canceled", NOW + 100 * DAY);
    expect(e.entitled).toBe(true);
    expect(e.reason).toBe("cancelled_covered");
  });

  test("a cancelled subscription stops when its paid period runs out", () => {
    const e = entitlement("canceled", NOW - DAY);
    expect(e.entitled).toBe(false);
    expect(e.reason).toBe("cancelled");
  });

  test("a subscription that was never paid gets nothing", () => {
    expect(entitlement("unpaid").entitled).toBe(false);
    expect(entitlement("incomplete").entitled).toBe(false);
  });

  /* Refusing here would block a real client over a bookkeeping miss. */
  test("a site with no subscription on record is let through, and flagged", () => {
    const e = resolveEntitlement({ subscription: null, now: NOW });
    expect(e.entitled).toBe(true);
    expect(e.reason).toBe("unregistered");
  });

  test("every outcome says something the client can act on", () => {
    const reasons = [
      entitlement("active", NOW + DAY),
      entitlement("past_due", NOW - DAY),
      entitlement("canceled", NOW + DAY),
      entitlement("canceled", NOW - DAY),
      entitlement("unpaid"),
      entitlement("past_due", NOW - MAINTENANCE_GRACE_MS - DAY),
      resolveEntitlement({ subscription: null, now: NOW }),
    ];
    for (const e of reasons) {
      expect(entitlementMessage(e).length).toBeGreaterThan(10);
    }
  });
});

describe("newLicenseKey", () => {
  test("issues an opaque, non-repeating key", () => {
    const a = newLicenseKey();
    expect(a).toMatch(/^bys_[0-9a-f]{32}$/);
    expect(a).not.toBe(newLicenseKey());
  });
});

function deployment(over: Record<string, unknown> = {}) {
  return {
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
    maintenance: { status: "active" as const, autoRenew: true },
    licenseKey: "bys_test",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function order(over: Record<string, unknown> = {}) {
  return {
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
    ...over,
  };
}

function subscription(orderId: unknown, over: Record<string, unknown> = {}) {
  return {
    orderId,
    stripeSubscriptionId: "sub_test",
    stripeCustomerId: "cus_test",
    customerEmail: "chef@example.com",
    plan: "essentielle" as const,
    billingPeriod: "yearly" as const,
    status: "active" as const,
    createdAt: NOW,
    ...over,
  };
}

describe("byLicenseKey", () => {
  test("an unknown key resolves to nothing", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_nobody",
    });
    expect(result).toBeNull();
  });

  test("resolves through the deployment's own order", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId = await ctx.db.insert("orders", order());
      await ctx.db.insert("saDeployments", deployment({ orderId }));
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, {
          status: "canceled",
          currentPeriodEnd: Date.now() - DAY,
        }),
      );
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(false);
    expect(result?.reason).toBe("cancelled");
    expect(result?.site).toBe("chez-alex");
  });

  /* A deployment provisioned before the order was linked still has to answer. */
  test("falls back to the customer's subscriptions when no order is linked", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId = await ctx.db.insert("orders", order());
      await ctx.db.insert("saDeployments", deployment());
      await ctx.db.insert("subscriptions", subscription(orderId));
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(true);
    expect(result?.reason).toBe("active");
  });

  /* A client running several sites must not be cut off by whichever row the
     index happened to return first. */
  test("keeps the most favourable of a customer's subscriptions", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId = await ctx.db.insert("orders", order());
      await ctx.db.insert("saDeployments", deployment());
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, {
          stripeSubscriptionId: "sub_dead",
          status: "canceled",
          currentPeriodEnd: Date.now() - 400 * DAY,
        }),
      );
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, { stripeSubscriptionId: "sub_live" }),
      );
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(true);
  });

  test("a deployment with no subscription at all is let through", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("saDeployments", deployment());
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(true);
    expect(result?.reason).toBe("unregistered");
  });

  /* Two concurrent Stripe deliveries used to write two rows for one order.
     Reading them with .unique() threw, the route answered 500, and the client
     update scripts read any non-2xx as « API unreachable » and updated anyway.
     The guard in ./subscriptions stops new duplicates; orders already in that
     state still have to answer. */
  test("answers for an order that carries duplicate subscriptions", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId = await ctx.db.insert("orders", order());
      await ctx.db.insert("saDeployments", deployment({ orderId }));
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, { stripeSubscriptionId: "sub_race_a" }),
      );
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, { stripeSubscriptionId: "sub_race_b" }),
      );
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(true);
    expect(result?.reason).toBe("active");
  });

  /* A long history of finished contracts must not bury the live one: the scan
     used to keep the OLDEST 20, so a client past that count was refused an
     update they had paid for. */
  test("finds the live subscription behind a long history of dead ones", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId = await ctx.db.insert("orders", order());
      await ctx.db.insert("saDeployments", deployment());
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert(
          "subscriptions",
          subscription(orderId, {
            stripeSubscriptionId: `sub_dead_${i}`,
            status: "canceled",
            currentPeriodEnd: Date.now() - 400 * DAY,
          }),
        );
      }
      await ctx.db.insert(
        "subscriptions",
        subscription(orderId, {
          stripeSubscriptionId: "sub_live",
          currentPeriodEnd: Date.now() + 200 * DAY,
        }),
      );
    });
    const result = await t.query(internal.maintenance.byLicenseKey, {
      licenseKey: "bys_test",
    });
    expect(result?.entitled).toBe(true);
    expect(result?.reason).toBe("active");
  });
});
