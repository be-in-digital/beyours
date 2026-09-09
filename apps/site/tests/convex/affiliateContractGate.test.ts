/// <reference types="vite/client" />

/**
 * No contract, no commission — and no code either.
 *
 * `affiliateUsers.createAfterSignup` is a PUBLIC mutation that hands any
 * signed-in account an affiliate profile with `status: "active"`. The discount
 * path learned to ask for the CONTRACT rather than for that status
 * (convex/affiliateStanding.ts), but two places kept asking for neither:
 *
 *   - `referralCodes.generateMyCode` / `customizeMyCode` asked only that a
 *     profile exist, so an unsigned account could still mint « BID-XXXXX » and
 *     publish it.
 *   - `referrals.markValidatedAsPayable` gated on `stripeConnectStatus`, a
 *     SIRET and an invoice — three questions about HOW to pay someone, and none
 *     about whether they are owed anything. The affiliate contract is the legal
 *     basis of the commission (art. 4), and it went unchecked all the way to
 *     `transfers.create`.
 *
 * Measured before the fix, as a stranger with a signed-up account and Stripe
 * Connect completed: an unsigned affiliate's commission reached `payable` at
 * 03:30 and 500 € left the account at 10:00.
 *
 * The rule is the one ./affiliateStanding already stated, deliberately shared:
 * what discounts a sale and what pays for it must not be able to disagree.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";
import { drainScheduled } from "./helpers/scheduled";

const modules = import.meta.glob("../../convex/**/*.ts");

/* ── A Stripe that records instead of paying ──
   `processPayouts` is the last gate, so "was it refused?" has to be measured as
   "did money move?", not as a row's status: a run that transfers and then fails
   leaves the row back at `payable` too. */
const stripeFake = vi.hoisted(() => ({
  transfers: [] as Array<Record<string, unknown>>,
}));

vi.mock("stripe", () => {
  class FakeStripe {
    transfers = {
      create: async (params: Record<string, unknown>) => {
        stripeFake.transfers.push(params);
        return { id: `tr_${stripeFake.transfers.length}`, object: "transfer" };
      },
    };
  }
  return { default: FakeStripe };
});

const savedKey = { value: undefined as string | undefined };

beforeEach(() => {
  savedKey.value = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  stripeFake.transfers.length = 0;
});

afterEach(() => {
  if (savedKey.value === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedKey.value;
});

type ContractStatus = "pending_contract" | "active" | "blocked_new_version";

/**
 * An affiliate whose payout details are impeccable and whose contract is
 * whatever the case says.
 *
 * Stripe Connect active, SIRET on file, invoice uploaded — everything
 * `markValidatedAsPayable` used to ask for. So a refusal below can only have
 * come from the contract.
 */
async function seedAffiliate(
  t: ReturnType<typeof convexTest>,
  opts: {
    contractStatus?: ContractStatus | undefined;
    status?: "active" | "suspended" | "rejected";
    withContractStatus?: boolean;
  } = {},
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("affiliateSettings", {
      defaultCommissionCents: 50_000,
      defaultDiscountPercent: 10,
      validationDelayDays: 30,
      programEnabled: true,
      updatedAt: Date.now(),
    });
    const userId = await ctx.db.insert("users", {
      email: "apporteur@example.test",
    });
    const affiliateUserId = await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: opts.status ?? ("active" as const),
      ...(opts.withContractStatus === false
        ? {}
        : { contractStatus: opts.contractStatus ?? ("active" as const) }),
      siret: "12345678901234",
      stripeConnectAccountId: "acct_1",
      stripeConnectStatus: "active" as const,
      createdAt: Date.now(),
    });
    return { userId, affiliateUserId };
  });
}

/** A paid order and a commission on it, invoice attached (art. 4.2). */
async function seedCommission(
  t: ReturnType<typeof convexTest>,
  affiliateUserId: Id<"affiliateUsers">,
  status: "validated" | "payable",
) {
  return await t.run(async (ctx) => {
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
    const invoiceStorageId = await ctx.storage.store(
      new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
    );
    return await ctx.db.insert("referrals", {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "client@example.test",
      status,
      commissionCents: 50_000,
      discountPercent: 10,
      discountAmountCents: 35_000,
      invoiceStorageId,
      invoiceUploadedAt: Date.now(),
      validatedAt: Date.now(),
      createdAt: Date.now(),
    });
  });
}

const statusOf = async (t: ReturnType<typeof convexTest>, id: Id<"referrals">) =>
  (await t.run((ctx) => ctx.db.get(id)))!.status;

describe("an unsigned affiliate gets no code", () => {
  test.each([
    ["signed up but never signed", { contractStatus: "pending_contract" as const }],
    ["superseded by a new version", { contractStatus: "blocked_new_version" as const }],
    ["suspended", { status: "suspended" as const }],
  ])("%s cannot generate one", async (_label, opts) => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, opts);

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.referralCodes.generateMyCode,
        {},
      ),
    ).rejects.toThrow();

    // Nothing minted: the refusal is not a silent no-op that leaves a code.
    expect(await t.run((ctx) => ctx.db.query("referralCodes").collect())).toEqual(
      [],
    );
  });

  test("nor claim a custom one", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, {
      contractStatus: "pending_contract",
    });

    await expect(
      t
        .withIdentity({ subject: userId })
        .mutation(api.referralCodes.customizeMyCode, { code: "GIULIA10" }),
    ).rejects.toThrow(/[Ss]ignez le contrat/);

    expect(await t.run((ctx) => ctx.db.query("referralCodes").collect())).toEqual(
      [],
    );
  });

  test("the refusal names the contract, so the affiliate knows where to go", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, {
      contractStatus: "pending_contract",
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.referralCodes.generateMyCode,
        {},
      ),
    ).rejects.toThrow(/[Ss]ignez le contrat/);
  });

  test("once signed, the same account mints one", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t);

    const code = await t
      .withIdentity({ subject: userId })
      .mutation(api.referralCodes.generateMyCode, {});
    // 8 random characters since #445, not 5. `validateCode` is a public,
    // unauthenticated oracle — it has to be, strangers type these codes — and
    // 32^5 ≈ 33.5M against a few hundred live codes made a blind sweep an
    // afternoon's work. 32^8 ≈ 1.1e12 does not. The alphabet is unchanged: no
    // I, O, 0 or 1, because these are read aloud across a counter.
    expect(code?.code).toMatch(/^BID-[A-Z2-9]{8}$/);
    expect(code?.isActive).toBe(true);
  });
});

describe("an unsigned affiliate is never payable", () => {
  test.each([
    ["never signed", { contractStatus: "pending_contract" as const }],
    ["signed a superseded version", { contractStatus: "blocked_new_version" as const }],
    ["suspended", { status: "suspended" as const }],
  ])(
    "a commission of an affiliate who %s stays validated",
    async (_label, opts) => {
      const t = convexTest(schema, modules);
      const { affiliateUserId } = await seedAffiliate(t, opts);
      const referralId = await seedCommission(t, affiliateUserId, "validated");

      await t.mutation(internal.referrals.markValidatedAsPayable, {});

      expect(await statusOf(t, referralId)).toBe("validated");
    },
  );

  test("the same commission, contract signed, is marked payable", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t);
    const referralId = await seedCommission(t, affiliateUserId, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});

    expect(await statusOf(t, referralId)).toBe("payable");
  });

  test("a row predating the contract system is still paid, and says so", async () => {
    /* Absent `contractStatus` means a row created before the field existed,
       which `migrations.addContractStatusToAffiliates` exists to grandfather.
       Refusing it here would stop paying real affiliates over a migration that
       has not been run; the same allowance the discount path makes, for the
       same reason. */
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t, {
      withContractStatus: false,
    });
    const referralId = await seedCommission(t, affiliateUserId, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});

    expect(await statusOf(t, referralId)).toBe("payable");
  });
});

describe("and no money leaves for one", () => {
  /* The last gate. `markValidatedAsPayable` refuses too, but standing can
     change between the two crons — `contractVersions.activate` moves every
     active affiliate to `blocked_new_version`, and an account can be suspended
     on a Tuesday — so the row this reads may have been queued while the
     contract still held. */
  test.each([
    ["never signed", { contractStatus: "pending_contract" as const }],
    ["signed a superseded version", { contractStatus: "blocked_new_version" as const }],
    ["suspended", { status: "suspended" as const }],
  ])("a payable commission of an affiliate who %s is not wired", async (_label, opts) => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t, opts);
    const referralId = await seedCommission(t, affiliateUserId, "payable");

    await t.action(internal.stripeConnect.processPayouts, {});
    await drainScheduled(t);

    expect(stripeFake.transfers).toEqual([]);
    // Left where the next run can find it, not stranded in `paying`.
    expect(await statusOf(t, referralId)).toBe("payable");
  });

  test("the same run pays an affiliate whose contract holds", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t);
    const referralId = await seedCommission(t, affiliateUserId, "payable");

    await t.action(internal.stripeConnect.processPayouts, {});
    await drainScheduled(t);

    expect(stripeFake.transfers).toHaveLength(1);
    expect(stripeFake.transfers[0]?.amount).toBe(50_000);
    expect(await statusOf(t, referralId)).toBe("paid");
  });
});
