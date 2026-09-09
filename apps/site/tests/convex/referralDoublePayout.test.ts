/**
 * A commission that has been wired cannot be wired a second time.
 *
 * THE ROUND TRIP THIS CLOSES. `blockReferralPayout` patched any referral to
 * `blocked` unconditionally — `paid` rows included. `unblockReferralPayout`
 * then moved it to `validated`, `markValidatedAsPayable` moved it to `payable`,
 * and `processPayouts` claimed it and called `transfers.create` again.
 *
 * The idempotency key on that transfer was supposed to be the backstop, and it
 * is one for 24 hours only: Stripe remembers a key for a day, after which the
 * same key is simply a new request that creates a second transfer. So the round
 * trip was harmless on the afternoon somebody tried it and paid the affiliate
 * twice the following week — which is the ordinary shape of an admin blocking a
 * commission they are unsure about and releasing it after checking with
 * accounts.
 *
 * `#322` had already fixed the OVERLAPPING-RUN case with the claim mutation and
 * that key. This is the other one: not two runs racing, but one row walked back
 * into the payable set long after the money left.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "admin@example.test" });
    await ctx.db.insert("affiliateUsers", {
      userId,
      role: "admin" as const,
      status: "active" as const,
      siret: "12345678901234",
      // Required by the schema even for an admin, who never receives a payout.
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    });
    return userId;
  });
}

/** A commission in whatever state the case under test needs. */
async function seedReferral(
  t: ReturnType<typeof convexTest>,
  fields: Record<string, unknown>
): Promise<Id<"referrals">> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "apporteur@example.test" });
    const affiliateUserId = await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: "active" as const,
      siret: "98765432109876",
      stripeConnectAccountId: "acct_1",
      stripeConnectStatus: "active" as const,
      createdAt: Date.now(),
    });
    const referralCodeId = await ctx.db.insert("referralCodes", {
      affiliateUserId,
      code: "BID-SEED",
      isCustom: false,
      isActive: true,
      createdAt: Date.now(),
    });
    const orderId = await ctx.db.insert("orders", {
      customerEmail: "client@example.test",
      customerFirstName: "Alex",
      customerLastName: "Martin",
      customerPhone: "+33600000000",
      restaurantName: "Chez Alex",
      city: "Paris",
      buyerType: "business" as const,
      plan: "essentielle" as const,
      orderType: "creation" as const,
      billingPeriod: "yearly" as const,
      amountCents: 415_000,
      status: "paid" as const,
      isFounders: false,
      createdAt: Date.now(),
    });
    return await ctx.db.insert("referrals", {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "client@example.test",
      commissionCents: 50_000,
      discountPercent: 10,
      discountAmountCents: 35_000,
      createdAt: Date.now(),
      ...fields,
    });
  });
}

const statusOf = async (t: ReturnType<typeof convexTest>, id: Id<"referrals">) =>
  (await t.run((ctx) => ctx.db.get(id)))!.status;

describe("blocking a commission", () => {
  test("is refused once the money has been wired", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedAdmin(t);
    const referralId = await seedReferral(t, {
      status: "paid" as const,
      paidAt: Date.now(),
      stripeTransferId: "tr_already_sent",
    });

    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.blockReferralPayout, {
        referralId,
      })
    ).rejects.toThrow(/déjà été virée/);

    // And the row is untouched: a refused block must not half-apply.
    expect(await statusOf(t, referralId)).toBe("paid");
  });

  test("is refused for a row holding a transfer id but not yet marked paid", async () => {
    // A payout run that died between `transfers.create` and `markPaid`. The
    // status has not caught up, and the money has still left — so the status
    // alone is not a safe thing to gate on.
    const t = convexTest(schema, modules);
    const adminId = await seedAdmin(t);
    const referralId = await seedReferral(t, {
      status: "paying" as const,
      stripeTransferId: "tr_sent_but_unrecorded",
    });

    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.blockReferralPayout, {
        referralId,
      })
    ).rejects.toThrow(/déjà été virée/);
  });

  test("is refused while a payout run is holding the row", async () => {
    const t = convexTest(schema, modules);
    const adminId = await seedAdmin(t);
    const referralId = await seedReferral(t, { status: "paying" as const });

    await expect(
      t.withIdentity({ subject: adminId }).mutation(api.admin.blockReferralPayout, {
        referralId,
      })
    ).rejects.toThrow(/virement est en cours/);
  });

  test("still works for a commission that has not been wired", async () => {
    // The guard must not have made the feature unusable: holding a payable
    // commission back is what this mutation is FOR.
    const t = convexTest(schema, modules);
    const adminId = await seedAdmin(t);
    const referralId = await seedReferral(t, { status: "payable" as const });

    await t.withIdentity({ subject: adminId }).mutation(api.admin.blockReferralPayout, {
      referralId,
      adminNote: "à vérifier avec la compta",
    });

    expect(await statusOf(t, referralId)).toBe("blocked");
  });

  test("and the released commission can still be paid once", async () => {
    // The whole round trip, on a commission that was never wired: block,
    // unblock, and it comes back as `validated` for the payable cron. This is
    // the behaviour the guard above must leave intact.
    const t = convexTest(schema, modules);
    const adminId = await seedAdmin(t);
    const referralId = await seedReferral(t, { status: "payable" as const });
    const asAdmin = t.withIdentity({ subject: adminId });

    await asAdmin.mutation(api.admin.blockReferralPayout, { referralId });
    await asAdmin.mutation(api.admin.unblockReferralPayout, { referralId });

    expect(await statusOf(t, referralId)).toBe("validated");
  });
})
