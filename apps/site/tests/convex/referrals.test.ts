/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

function createTestData() {
  return {
    async setupAffiliate(t: ReturnType<typeof convexTest>) {
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: "affiliate@example.com",
        });
      });

      const affiliateUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("affiliateUsers", {
          userId,
          role: "affiliate" as const,
          status: "active" as const,
          stripeConnectStatus: "not_started" as const,
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

    async setupOrder(
      t: ReturnType<typeof convexTest>,
      email = "customer@example.com",
    ) {
      return await t.run(async (ctx) => {
        return await ctx.db.insert("orders", {
          customerEmail: email,
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
  };
}

describe("referrals.createFromCheckout", () => {
  test("creates a referral record", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    const orderId = await data.setupOrder(t);

    await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "customer@example.com",
      customerName: "Jean Dupont",
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: 35000,
    });

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral).not.toBeNull();
    expect(referral!.status).toBe("pending");
    expect(referral!.commissionCents).toBe(50000);
    expect(referral!.discountPercent).toBe(10);
    expect(referral!.discountAmountCents).toBe(35000);
    expect(referral!.customerEmail).toBe("customer@example.com");
  });

  test("is idempotent — same order returns existing referral", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    const orderId = await data.setupOrder(t);

    const id1 = await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "customer@example.com",
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: 35000,
    });

    const id2 = await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "customer@example.com",
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: 35000,
    });

    expect(id1).toBe(id2);

    // Verify only one referral exists
    const referrals = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .take(10);
    });
    expect(referrals).toHaveLength(1);
  });
});

describe("referrals.validatePendingReferrals", () => {
  test("validates pending referrals older than delay", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    await data.setupSettings(t);
    const orderId = await data.setupOrder(t);

    // Create a referral with a createdAt 15 days in the past
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("referrals", {
        referrerId: affiliateUserId,
        referralCodeId,
        orderId,
        customerEmail: "customer@example.com",
        status: "pending",
        commissionCents: 50000,
        discountPercent: 10,
        discountAmountCents: 35000,
        createdAt: fifteenDaysAgo,
      });
    });

    await t.mutation(internal.referrals.validatePendingReferrals, {});

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral!.status).toBe("validated");
    expect(referral!.validatedAt).toBeDefined();
  });

  test("does not validate recent pending referrals", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    await data.setupSettings(t);
    const orderId = await data.setupOrder(t);

    // Create a referral with a recent createdAt (5 days ago)
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("referrals", {
        referrerId: affiliateUserId,
        referralCodeId,
        orderId,
        customerEmail: "customer@example.com",
        status: "pending",
        commissionCents: 50000,
        discountPercent: 10,
        discountAmountCents: 35000,
        createdAt: fiveDaysAgo,
      });
    });

    await t.mutation(internal.referrals.validatePendingReferrals, {});

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral!.status).toBe("pending");
  });

  test("cancels referral if order is cancelled", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    await data.setupSettings(t);

    // Create a cancelled order
    const orderId = await t.run(async (ctx) => {
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
        status: "cancelled",
        createdAt: Date.now(),
      });
    });

    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      await ctx.db.insert("referrals", {
        referrerId: affiliateUserId,
        referralCodeId,
        orderId,
        customerEmail: "customer@example.com",
        status: "pending",
        commissionCents: 50000,
        discountPercent: 10,
        discountAmountCents: 35000,
        createdAt: fifteenDaysAgo,
      });
    });

    await t.mutation(internal.referrals.validatePendingReferrals, {});

    const referral = await t.run(async (ctx) => {
      return await ctx.db
        .query("referrals")
        .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
        .unique();
    });

    expect(referral!.status).toBe("cancelled");
    expect(referral!.cancelledAt).toBeDefined();
    expect(referral!.statusReason).toBe("Commande annulée ou échouée");
  });
});

describe("referrals.getByOrderId", () => {
  test("returns referral for existing order", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const { affiliateUserId, referralCodeId } = await data.setupAffiliate(t);
    const orderId = await data.setupOrder(t);

    await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "customer@example.com",
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: 35000,
    });

    const referral = await t.query(internal.referrals.getByOrderId, {
      orderId,
    });
    expect(referral).not.toBeNull();
    expect(referral!.referrerId).toBe(affiliateUserId);
  });

  test("returns null for order without referral", async () => {
    const t = convexTest(schema, modules);
    const data = createTestData();
    const orderId = await data.setupOrder(t);

    const referral = await t.query(internal.referrals.getByOrderId, {
      orderId,
    });
    expect(referral).toBeNull();
  });
});
