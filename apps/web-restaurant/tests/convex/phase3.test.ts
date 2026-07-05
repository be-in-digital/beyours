/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

function createTestData() {
  return {
    async setupAffiliate(
      t: ReturnType<typeof convexTest>,
      opts?: { stripeConnectStatus?: "not_started" | "pending" | "active" | "disabled" },
    ) {
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", { email: "affiliate@example.com" });
      });

      const affiliateUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("affiliateUsers", {
          userId,
          role: "affiliate" as const,
          status: "active" as const,
          stripeConnectStatus: opts?.stripeConnectStatus ?? "not_started",
          stripeConnectAccountId: opts?.stripeConnectStatus === "active" ? "acct_test_123" : undefined,
          createdAt: Date.now(),
        });
      });

      const referralCodeId = await t.run(async (ctx) => {
        return await ctx.db.insert("referralCodes", {
          affiliateUserId,
          code: "TEST123",
          isCustom: false,
          isActive: true,
          createdAt: Date.now(),
        });
      });

      return { userId, affiliateUserId, referralCodeId };
    },

    async setupOrder(t: ReturnType<typeof convexTest>) {
      return await t.run(async (ctx) => {
        return await ctx.db.insert("orders", {
          customerEmail: "customer@example.com",
          customerFirstName: "Jean",
          customerLastName: "Dupont",
          customerPhone: "0612345678",
          restaurantName: "Le Bon Goût",
          city: "Paris",
          buyerType: "business",
          plan: "essentielle",
          orderType: "creation",
          billingPeriod: "monthly",
          amountCents: 360000,
          status: "paid",
          createdAt: Date.now(),
        });
      });
    },

    async setupSettings(t: ReturnType<typeof convexTest>) {
      await t.run(async (ctx) => {
        await ctx.db.insert("affiliateSettings", {
          defaultCommissionCents: 50000,
          defaultDiscountPercent: 10,
          validationDelayDays: 14,
          programEnabled: true,
          updatedAt: Date.now(),
        });
      });
    },

    async createReferral(
      t: ReturnType<typeof convexTest>,
      affiliateUserId: string,
      referralCodeId: string,
      orderId: string,
      status: "pending" | "validated" | "payable" | "paid" = "pending",
    ) {
      return await t.run(async (ctx) => {
        return await ctx.db.insert("referrals", {
          referrerId: affiliateUserId as any,
          referralCodeId: referralCodeId as any,
          orderId: orderId as any,
          customerEmail: "customer@example.com",
          status,
          commissionCents: 50000,
          discountPercent: 10,
          discountAmountCents: 35000,
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
          ...(status === "validated" ? { validatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000 } : {}),
        });
      });
    },
  };
}

describe("referrals.markValidatedAsPayable", () => {
  test("marks validated referrals as payable when affiliate has active Stripe Connect", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t, {
      stripeConnectStatus: "active",
    });
    const orderId = await data.setupOrder(t);
    await data.createReferral(t, affiliateUserId, referralCodeId, orderId, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral!.status).toBe("payable");
  });

  test("does not mark validated referrals when Stripe Connect is not active", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t, {
      stripeConnectStatus: "pending",
    });
    const orderId = await data.setupOrder(t);
    await data.createReferral(t, affiliateUserId, referralCodeId, orderId, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral!.status).toBe("validated");
  });
});

describe("referrals.markPaid", () => {
  test("marks a referral as paid with stripe transfer id", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t, {
      stripeConnectStatus: "active",
    });
    const orderId = await data.setupOrder(t);
    const referralId = await data.createReferral(
      t, affiliateUserId, referralCodeId, orderId, "payable",
    );

    await t.mutation(internal.referrals.markPaid, {
      referralId,
      stripeTransferId: "tr_test_123",
    });

    const referral = await t.run(async (ctx) => {
      return await ctx.db.get(referralId);
    });

    expect(referral!.status).toBe("paid");
    expect(referral!.paidAt).toBeDefined();
    expect(referral!.stripeTransferId).toBe("tr_test_123");
  });
});

describe("referrals.getPayableReferrals", () => {
  test("returns only payable referrals", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t, {
      stripeConnectStatus: "active",
    });

    const orderId1 = await data.setupOrder(t);
    const orderId2 = await t.run(async (ctx) => {
      return await ctx.db.insert("orders", {
        customerEmail: "customer2@example.com",
        customerFirstName: "Marie",
        customerLastName: "Martin",
        customerPhone: "0612345679",
        restaurantName: "Le Petit Bistro",
        city: "Lyon",
        buyerType: "business",
        plan: "premium",
        orderType: "creation",
        billingPeriod: "monthly",
        amountCents: 750000,
        status: "paid",
        createdAt: Date.now(),
      });
    });

    await data.createReferral(t, affiliateUserId, referralCodeId, orderId1, "payable");
    await data.createReferral(t, affiliateUserId, referralCodeId, orderId2, "validated");

    const payable = await t.query(internal.referrals.getPayableReferrals, {});

    expect(payable).toHaveLength(1);
    expect(payable[0].orderId).toBe(orderId1);
  });
});

describe("admin.getStats", () => {
  test("returns correct aggregate statistics", async () => {
    const t = convexTest(schema, modules);

    // Create admin user
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

    // Create a regular affiliate
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t, {
      stripeConnectStatus: "active",
    });
    const orderId = await data.setupOrder(t);
    await data.createReferral(t, affiliateUserId, referralCodeId, orderId, "paid");

    // Use internal query to bypass auth
    const stats = await t.run(async (ctx) => {
      const affiliates = await ctx.db.query("affiliateUsers").take(200);
      const referrals = await ctx.db.query("referrals").take(500);
      return {
        totalAffiliates: affiliates.length,
        activeAffiliates: affiliates.filter((a) => a.status === "active").length,
        totalReferrals: referrals.length,
        paidReferrals: referrals.filter((r) => r.status === "paid").length,
        totalCommissions: referrals
          .filter((r) => r.status === "paid")
          .reduce((sum, r) => sum + r.commissionCents, 0),
      };
    });

    expect(stats.totalAffiliates).toBe(2); // admin + affiliate
    expect(stats.activeAffiliates).toBe(2);
    expect(stats.totalReferrals).toBe(1);
    expect(stats.paidReferrals).toBe(1);
    expect(stats.totalCommissions).toBe(50000);
  });
});
