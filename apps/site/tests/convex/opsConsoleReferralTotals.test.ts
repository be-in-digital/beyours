/// <reference types="vite/client" />

/**
 * A commission in flight has to be somewhere on the ops console.
 *
 * THE BUG (#411, B2-F4). #384 added the `paying` state — a commission claimed
 * by a payout run whose transfer is not yet confirmed — and told the schema,
 * `claimForPayout`, `releasePayoutClaim`, the affiliate's own totals and the
 * invoice-upload refusal. It told none of the ops console's own arithmetic.
 *
 * The result was worse than an omission: `getStats` counts by INCLUSION for
 * three of its numbers and by EXCLUSION for the fourth, so a `paying`
 * commission fell out of `validatedReferrals` and stayed in
 * `pendingCommissions`. Two figures on one dashboard disagreed about the same
 * money, and an affiliate's row lost the commission from both of its buckets
 * for as long as the transfer was moving.
 *
 * The badge and the filter are guarded by `referral-status-vocabulary.test.ts`,
 * which reads the schema and requires every state to be nameable. Arithmetic
 * cannot be guarded that way — a filter list is not a vocabulary — so it is
 * pinned here, on the one state that has actually been forgotten.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

const NOW = 1_700_000_000_000;

/** One affiliate, one admin, and three commissions in three states. */
async function seedProgramme(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const affiliateAccount = await ctx.db.insert("users", {
      email: "apporteur@example.test",
    });
    const affiliateId = await ctx.db.insert("affiliateUsers", {
      userId: affiliateAccount,
      role: "affiliate" as const,
      status: "active" as const,
      stripeConnectStatus: "active" as const,
      createdAt: NOW,
    });
    const adminAccount = await ctx.db.insert("users", {
      email: "ops@be-yours.fr",
    });
    await ctx.db.insert("affiliateUsers", {
      userId: adminAccount,
      role: "admin" as const,
      status: "active" as const,
      stripeConnectStatus: "active" as const,
      createdAt: NOW,
    });

    const codeId = await ctx.db.insert("referralCodes", {
      affiliateUserId: affiliateId,
      code: "GIULIA10",
      isCustom: false,
      isActive: true,
      createdAt: NOW,
    });

    async function commission(
      status: "payable" | "paying" | "paid",
      commissionCents: number,
    ) {
      const orderId = await ctx.db.insert("orders", {
        customerEmail: `${status}@trattoria.fr`,
        customerFirstName: "Giulia",
        customerLastName: "Rossi",
        customerPhone: "+33612345678",
        restaurantName: "Trattoria Rossi",
        city: "Lyon",
        buyerType: "business" as const,
        plan: "essentielle" as const,
        orderType: "creation" as const,
        billingPeriod: "yearly" as const,
        amountCents: 450000,
        status: "paid" as const,
        createdAt: NOW,
      });
      await ctx.db.insert("referrals", {
        referrerId: affiliateId,
        referralCodeId: codeId,
        orderId,
        customerEmail: `${status}@trattoria.fr`,
        status,
        commissionCents,
        discountPercent: 10,
        discountAmountCents: 45000,
        createdAt: NOW,
      });
    }

    await commission("payable", 10_000);
    await commission("paying", 25_000);
    await commission("paid", 40_000);

    return { adminAccount };
  });
}

async function asAdmin(t: ReturnType<typeof convexTest>) {
  const { adminAccount } = await seedProgramme(t);
  return t.withIdentity({ subject: adminAccount as Id<"users"> });
}

describe("the ops console's referral totals", () => {
  test("counts a commission in flight among those still owed", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);

    const stats = await admin.query(api.admin.getStats, {});

    // `validatedReferrals` is "earned and not yet paid": validated, payable
    // and — since this fix — paying. The fixture has one payable and one
    // paying, so it is 2; without `paying` in the list it was 1, and the
    // commission actually being wired was in no counter at all.
    expect(stats.validatedReferrals).toBe(2);
    expect(stats.paidReferrals).toBe(1);
    expect(stats.totalReferrals).toBe(3);
    // Every commission is in exactly one of the two counters.
    expect(stats.validatedReferrals + stats.paidReferrals).toBe(
      stats.totalReferrals,
    );
  });

  test("its two money figures agree about a commission in flight", async () => {
    // `validatedReferrals` counts by inclusion and `pendingCommissions` by
    // exclusion, so a state added to neither shows up in one and not the
    // other. That is what makes the omission produce a contradiction rather
    // than a smaller number.
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);

    const stats = await admin.query(api.admin.getStats, {});

    // 10 000 payable + 25 000 paying, and not the 40 000 already paid.
    expect(stats.pendingCommissions).toBe(35_000);
    expect(stats.totalCommissions).toBe(40_000);
  });

  test("an affiliate's row does not lose the money that is moving to them", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);

    const rows = await admin.query(api.admin.listAffiliates, {});
    const affiliate = rows.find((r) => r.role === "affiliate");

    expect(affiliate?.totalEarned).toBe(40_000);
    expect(affiliate?.pendingEarnings).toBe(35_000);
    // Every euro accrued is in one bucket or the other, and in only one.
    expect(
      (affiliate?.totalEarned ?? 0) + (affiliate?.pendingEarnings ?? 0),
    ).toBe(75_000);
  });

  test("the console can list the commissions that are in flight", async () => {
    // `admin.listReferrals`' own validator refused the value, so those rows
    // could not be filtered for at all — not even by editing the URL by hand.
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);

    const paying = await admin.query(api.admin.listReferrals, {
      status: "paying",
    });

    expect(paying).toHaveLength(1);
    expect(paying[0]?.commissionCents).toBe(25_000);
  });
});
