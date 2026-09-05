/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

const NOW = 1_800_000_000_000;

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

/** The args the Stripe webhook path hands to `subscriptions.create`. */
function createArgs(orderId: Id<"orders">, stripeSubscriptionId: string) {
  return {
    orderId,
    stripeSubscriptionId,
    stripeCustomerId: "cus_test",
    customerEmail: "chef@example.com",
    plan: "essentielle" as const,
    billingPeriod: "yearly" as const,
    status: "active" as const,
    currentPeriodStart: NOW,
    currentPeriodEnd: NOW + 365 * 24 * 60 * 60 * 1000,
  };
}

async function seedOrder(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => await ctx.db.insert("orders", order()));
}

describe("subscriptions.create", () => {
  /* Stripe delivers checkout.session.completed at least once and retries it.
     The webhook's own « does one exist already » check reads in a different
     transaction than the one that writes, so two deliveries can both read
     « none ». The guard that holds is the one inside this mutation. */
  test("a second delivery for the same order adds no second row", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);

    const first = await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_first"),
    );
    const second = await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_second"),
    );

    expect(second).toEqual(first);

    const rows = await t.run(
      async (ctx) => await ctx.db.query("subscriptions").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].stripeSubscriptionId).toBe("sub_first");
  });

  /* Refusing the row does not undo the subscription the racing delivery had
     already created at Stripe: that one bills. Ops have to see it. */
  test("a refused duplicate names the Stripe subscription left to cancel", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);

    await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_first"),
    );
    await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_second"),
    );

    const activity = await t.run(
      async (ctx) => await ctx.db.query("saActivity").collect(),
    );
    const entry = activity.find(
      (a) => a.action === "subscription_duplicate_refused",
    );
    expect(entry).toBeDefined();
    expect(entry?.summary).toContain("sub_second");
    expect(entry?.customerEmail).toBe("chef@example.com");
  });

  /* The same subscription recorded twice is a plain replay — no second row,
     and nothing for ops to chase. */
  test("re-recording the same subscription raises no alert", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);

    await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_same"),
    );
    await t.mutation(
      internal.subscriptions.create,
      createArgs(orderId, "sub_same"),
    );

    const { rows, activity } = await t.run(async (ctx) => ({
      rows: await ctx.db.query("subscriptions").collect(),
      activity: await ctx.db.query("saActivity").collect(),
    }));
    expect(rows).toHaveLength(1);
    expect(activity).toHaveLength(0);
  });

  test("two orders each keep their own subscription", async () => {
    const t = convexTest(schema, modules);
    const t1 = await seedOrder(t);
    const t2 = await t.run(
      async (ctx) =>
        await ctx.db.insert(
          "orders",
          order({ customerEmail: "autre@example.com" }),
        ),
    );

    await t.mutation(internal.subscriptions.create, createArgs(t1, "sub_one"));
    await t.mutation(internal.subscriptions.create, createArgs(t2, "sub_two"));

    const rows = await t.run(
      async (ctx) => await ctx.db.query("subscriptions").collect(),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("subscriptions.getByOrderId", () => {
  test("reads back the row it wrote", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    await t.mutation(internal.subscriptions.create, createArgs(orderId, "sub_x"));

    const found = await t.query(internal.subscriptions.getByOrderId, {
      orderId,
    });
    expect(found?.stripeSubscriptionId).toBe("sub_x");
  });

  test("an order with no subscription reads as none", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    expect(
      await t.query(internal.subscriptions.getByOrderId, { orderId }),
    ).toBeNull();
  });

  /* Orders duplicated before the guard landed still have to be readable: this
     read is what the webhook uses to decide « one exists already ». When it
     threw, the guard stayed broken for that order for good. */
  test("an order already carrying duplicates answers instead of throwing", async () => {
    const t = convexTest(schema, modules);
    const orderId = await seedOrder(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        ...createArgs(orderId, "sub_legacy_a"),
        createdAt: NOW,
      });
      await ctx.db.insert("subscriptions", {
        ...createArgs(orderId, "sub_legacy_b"),
        createdAt: NOW,
      });
    });

    const found = await t.query(internal.subscriptions.getByOrderId, {
      orderId,
    });
    expect(found).not.toBeNull();
  });
});
