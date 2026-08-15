/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

describe("affiliateSettings", () => {
  test("get returns defaults when no settings exist", async () => {
    const t = convexTest(schema, modules);
    const settings = await t.query(api.affiliateSettings.get);
    expect(settings.defaultCommissionCents).toBe(50000);
    expect(settings.defaultDiscountPercent).toBe(10);
    expect(settings.validationDelayDays).toBe(14);
    expect(settings.programEnabled).toBe(true);
  });

  test("get returns stored settings when they exist", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("affiliateSettings", {
        defaultCommissionCents: 75000,
        defaultDiscountPercent: 15,
        validationDelayDays: 30,
        programEnabled: false,
        updatedAt: Date.now(),
      });
    });

    const settings = await t.query(api.affiliateSettings.get);
    expect(settings.defaultCommissionCents).toBe(75000);
    expect(settings.defaultDiscountPercent).toBe(15);
    expect(settings.validationDelayDays).toBe(30);
    expect(settings.programEnabled).toBe(false);
  });
});
