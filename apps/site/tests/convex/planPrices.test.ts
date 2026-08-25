/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { planPrices } from "../../convex/planPrices";
import {
  MAINTENANCE_ANNUAL_CENTS,
  annualMaintenanceCents,
  monthlyEquivalentCents,
} from "../../convex/saLib";

const modules = import.meta.glob("../../convex/**/*.ts");

/* The superadmin console used to keep its own copy of the maintenance prices.
   It drifted (490 €/890 € against a real 1 000 €/2 000 €) and every MRR and
   renewal figure under-reported by ~51%. These tests pin the console's numbers
   to planPrices so the two can never diverge again. */

const PLANS = ["essentielle", "premium"] as const;

describe("plan prices are the single source of truth", () => {
  test.each(PLANS)(
    "%s: the console's annual maintenance equals planPrices",
    (plan) => {
      expect(MAINTENANCE_ANNUAL_CENTS[plan]).toBe(
        planPrices[plan].maintenanceYearly,
      );
      expect(annualMaintenanceCents(plan)).toBe(
        planPrices[plan].maintenanceYearly,
      );
    },
  );

  test.each(PLANS)("%s: monthly equivalent is a twelfth of the year", (plan) => {
    expect(monthlyEquivalentCents(plan)).toBe(
      Math.round(planPrices[plan].maintenanceYearly / 12),
    );
  });

  test("an unknown plan fails loudly instead of defaulting", () => {
    expect(() =>
      annualMaintenanceCents("gratuite" as (typeof PLANS)[number]),
    ).toThrow(/unknown plan/i);
  });
});

/* ── The figures the founder actually reads ── */

async function asAdmin(t: ReturnType<typeof convexTest>) {
  const adminUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email: "admin@example.com" });
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("affiliateUsers", {
      userId: adminUserId,
      role: "admin" as const,
      status: "active" as const,
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    });
  });
  return t.withIdentity({ subject: adminUserId });
}

async function seedActiveSub(
  t: ReturnType<typeof convexTest>,
  plan: (typeof PLANS)[number],
  periodEnd: number,
) {
  await t.run(async (ctx) => {
    const orderId = await ctx.db.insert("orders", {
      customerEmail: `${plan}@example.com`,
      customerFirstName: "Test",
      customerLastName: "Client",
      customerPhone: "0600000000",
      restaurantName: `Resto ${plan}`,
      city: "Paris",
      buyerType: "business" as const,
      plan,
      orderType: "creation" as const,
      billingPeriod: "yearly" as const,
      amountCents: planPrices[plan].creation,
      status: "paid" as const,
      createdAt: Date.now(),
    });
    await ctx.db.insert("subscriptions", {
      orderId,
      stripeSubscriptionId: `sub_${plan}`,
      stripeCustomerId: `cus_${plan}`,
      customerEmail: `${plan}@example.com`,
      plan,
      billingPeriod: "yearly" as const,
      status: "active" as const,
      currentPeriodEnd: periodEnd,
      createdAt: Date.now(),
    });
  });
}

describe("superadmin revenue figures", () => {
  test("MRR sums the real maintenance prices, not a stale copy", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const farOff = Date.now() + 300 * 86_400_000;
    await seedActiveSub(t, "essentielle", farOff);
    await seedActiveSub(t, "premium", farOff);

    const expectedMrr =
      Math.round(planPrices.essentielle.maintenanceYearly / 12) +
      Math.round(planPrices.premium.maintenanceYearly / 12);

    const revenue = await admin.query(api.saRevenue.revenueOverview, {});

    expect(revenue.mrrCents).toBe(expectedMrr);
    expect(revenue.arrCents).toBe(expectedMrr * 12);
  });

  test("renewals due in 30 days quote the full annual price", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const soon = Date.now() + 10 * 86_400_000;
    await seedActiveSub(t, "essentielle", soon);
    await seedActiveSub(t, "premium", soon);

    const subs = await admin.query(api.saRevenue.subscriptionsOverview, {});

    expect(subs.stats.due30Count).toBe(2);
    expect(subs.stats.due30Cents).toBe(
      planPrices.essentielle.maintenanceYearly +
        planPrices.premium.maintenanceYearly,
    );
    for (const s of subs.list) {
      expect(s.annualCents).toBe(planPrices[s.plan].maintenanceYearly);
    }
  });

  test("the dashboard overview agrees with the revenue page", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const soon = Date.now() + 10 * 86_400_000;
    await seedActiveSub(t, "essentielle", soon);
    await seedActiveSub(t, "premium", soon);

    const dash = await admin.query(api.saDashboard.overview, {});

    expect(dash.commerce.mrrCents).toBe(
      Math.round(planPrices.essentielle.maintenanceYearly / 12) +
        Math.round(planPrices.premium.maintenanceYearly / 12),
    );
    expect(dash.renewals.due30Cents).toBe(
      planPrices.essentielle.maintenanceYearly +
        planPrices.premium.maintenanceYearly,
    );
  });
});
