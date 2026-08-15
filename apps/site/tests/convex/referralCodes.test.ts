/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

describe("referralCodes", () => {
  test("validateCode returns invalid for non-existent code", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.referralCodes.validateCode, {
      code: "NONEXISTENT",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("validateCode returns valid for active code with active affiliate", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    });

    const affiliateUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate",
        status: "active",
        stripeConnectStatus: "not_started",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "TEST123",
        isCustom: false,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("affiliateSettings", {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 14,
        programEnabled: true,
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.referralCodes.validateCode, {
      code: "TEST123",
    });
    expect(result.valid).toBe(true);
    expect(result.discountPercent).toBe(10);
  });

  test("validateCode returns invalid for inactive code", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    });

    const affiliateUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate",
        status: "active",
        stripeConnectStatus: "not_started",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "INACTIVE1",
        isCustom: false,
        isActive: false,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.referralCodes.validateCode, {
      code: "INACTIVE1",
    });
    expect(result.valid).toBe(false);
  });

  test("validateCode returns invalid for suspended affiliate", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    });

    const affiliateUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate",
        status: "suspended",
        stripeConnectStatus: "not_started",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "SUSPENDED1",
        isCustom: true,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    const result = await t.query(api.referralCodes.validateCode, {
      code: "SUSPENDED1",
    });
    expect(result.valid).toBe(false);
  });

  test("validateCode is case insensitive", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    });

    const affiliateUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate",
        status: "active",
        stripeConnectStatus: "not_started",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "MYCODE",
        isCustom: true,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("affiliateSettings", {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 14,
        programEnabled: true,
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.referralCodes.validateCode, {
      code: "mycode",
    });
    expect(result.valid).toBe(true);
  });

  test("validateCode uses affiliate discount override when set", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
      });
    });

    const affiliateUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate",
        status: "active",
        stripeConnectStatus: "not_started",
        discountOverridePercent: 15,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "OVERRIDE1",
        isCustom: false,
        isActive: true,
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("affiliateSettings", {
        defaultCommissionCents: 50000,
        defaultDiscountPercent: 10,
        validationDelayDays: 14,
        programEnabled: true,
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.referralCodes.validateCode, {
      code: "OVERRIDE1",
    });
    expect(result.valid).toBe(true);
    expect(result.discountPercent).toBe(15);
  });
});
