/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  FOUNDERS_HOLD_MS,
  FoundersOfferUnavailableError,
  resolveFoundersPricing,
} from "../../convex/foundersOffer";

const modules = import.meta.glob("../../convex/**/*.ts");

const COUPON = "STRIPE_FOUNDERS_COUPON_ID";
const PRODUCT_ENV = "STRIPE_PRODUCT_CREATION_ESSENTIELLE";

function pricing(over: Partial<Parameters<typeof resolveFoundersPricing>[0]>) {
  return resolveFoundersPricing({
    isFounders: true,
    couponId: "coupon_founders",
    creationProductId: "prod_creation",
    stripeLive: true,
    creationProductEnvName: PRODUCT_ENV,
    ...over,
  });
}

describe("resolveFoundersPricing", () => {
  test("a sale outside the offer is billed at list price", () => {
    expect(pricing({ isFounders: false })).toBe("none");
  });

  test("a fully configured founders sale is zeroed by the Stripe coupon", () => {
    expect(pricing({})).toBe("coupon");
  });

  /* The bug this ticket is about: without the coupon nothing caps the offer,
     so the eleventh customer would have walked away with a 3 500 € build. */
  test("a live founders sale without the coupon is refused, not given away", () => {
    expect(() => pricing({ couponId: undefined })).toThrow(
      FoundersOfferUnavailableError,
    );
    expect(() => pricing({ couponId: undefined })).toThrow(COUPON);
  });

  /* Coupon but no product: Stripe would spread the discount pro rata over the
     maintenance line — right total, wrong split on the customer's invoice. */
  test("a live founders sale without the creation product is refused", () => {
    expect(() => pricing({ creationProductId: null })).toThrow(
      FoundersOfferUnavailableError,
    );
    expect(() => pricing({ creationProductId: null })).toThrow(PRODUCT_ENV);
  });

  test("the refusal names the cap to configure", () => {
    expect(() => pricing({ couponId: "" })).toThrow(/max_redemptions = 10/);
  });

  test("without a Stripe key nothing is charged, so the 0 € line stands", () => {
    expect(pricing({ couponId: undefined, stripeLive: false })).toBe(
      "zero-line",
    );
  });

  /* A missing coupon must never block an ordinary sale — only a founders one. */
  test("an ordinary sale is unaffected by the missing coupon", () => {
    expect(
      pricing({ isFounders: false, couponId: undefined, creationProductId: null }),
    ).toBe("none");
  });
});

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
    billingPeriod: "yearly" as const,
    amountCents: 100000,
    status: "pending" as const,
    isFounders: true,
    createdAt: Date.now(),
    ...over,
  };
}

describe("countFoundersSold", () => {
  test("counts nothing before the first sale", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("counts paid founders sales", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("orders", order({ status: "paid" }));
      await ctx.db.insert("orders", order({ status: "paid" }));
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(2);
  });

  /* The regression: a checkout opened but not yet paid used to leave the slot
     on the shelf, so ten more customers could each be told a slot was free. */
  test("a checkout in flight holds its slot", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("orders", order({ status: "pending" }));
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(1);
  });

  test("a slot returns to the pool once the Stripe session can no longer be paid", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "orders",
        order({ status: "pending", createdAt: Date.now() - FOUNDERS_HOLD_MS - 1 }),
      );
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("abandoned and failed checkouts hold nothing", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("orders", order({ status: "cancelled" }));
      await ctx.db.insert("orders", order({ status: "failed" }));
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });

  test("sales outside the offer never consume a slot", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("orders", order({ status: "paid", isFounders: false }));
      await ctx.db.insert("orders", order({ status: "pending", isFounders: undefined }));
    });
    expect(await t.query(api.orders.countFoundersSold, {})).toBe(0);
  });
});
