/// <reference types="vite/client" />

/**
 * « Programme actif », and what it used to switch off: nothing.
 *
 * `affiliateSettings.programEnabled` had two writers — the admin console's
 * toggle (`admin.updateSettings`) and `saSeed` — and not one reader anywhere on
 * the money path. Measured before the fix, on a deployment with
 * `programEnabled: false`:
 *
 *     validateCode("BID-HONEST")     -> valid: true, 10 %
 *     createCheckoutSession(…)       -> 415 000 instead of 450 000
 *     createFromCheckout(…)          -> status « pending », 500 € accrued
 *     markValidatedAsPayable()       -> status « payable »
 *     processPayouts()               -> transfers.create, money gone
 *
 * A switch labelled « Programme actif » that stops nothing is worse than no
 * switch at all, because it is reached for in exactly the moment something has
 * gone wrong — a code leaked, a partner fired, a discount miscomputed — and it
 * reports success while the leak continues.
 *
 * Each case below is that same probe, one link at a time.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { TEST_CHECKOUT_ENV } from "../../convex/stripeMode";
import { planPrices } from "../../convex/planPrices";
import { VAT } from "../../lib/legal/company";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

const CODE = "BID-HONEST";
const COMMISSION_CENTS = 50_000;

/** Essentielle creation 3 500 € + yearly maintenance 1 000 € = 4 500 € excl. tax. */
const LIST_TOTAL =
  planPrices.essentielle.creation + planPrices.essentielle.maintenanceYearly;

const CHECKOUT = {
  plan: "essentielle" as const,
  orderType: "creation" as const,
  buyerType: "business" as const,
  billingPeriod: "yearly" as const,
  customerEmail: "chef@trattoria.fr",
  customerFirstName: "Giulia",
  customerLastName: "Rossi",
  customerPhone: "+33612345678",
  restaurantName: "Trattoria Rossi",
  city: "Lyon",
  successUrl: "https://beyours.fr/checkout/success",
  cancelUrl: "https://beyours.fr/checkout",
  withdrawalWaiverConsent: true,
  taxDisplayed: VAT.regime === "reel",
};

/** The no-payment path, so the order row can be read back. */
function stubTestCheckout() {
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv(TEST_CHECKOUT_ENV, "true");
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
}

beforeEach(stubTestCheckout);
afterEach(() => vi.unstubAllEnvs());

/**
 * One affiliate in perfect standing, holding one code, under a programme that
 * is on or off.
 *
 * Everything except `programEnabled` is deliberately impeccable: contract
 * signed, account active, Stripe Connect live, SIRET on file. Each case then
 * flips the one switch, so a refusal can only have come from it.
 */
async function seedProgramme(
  t: ReturnType<typeof convexTest>,
  programEnabled: boolean,
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("affiliateSettings", {
      defaultCommissionCents: COMMISSION_CENTS,
      defaultDiscountPercent: 10,
      validationDelayDays: 30,
      programEnabled,
      updatedAt: Date.now(),
    });
    const userId = await ctx.db.insert("users", {
      email: "apporteur@example.test",
    });
    const affiliateUserId = await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: "active" as const,
      contractStatus: "active" as const,
      siret: "12345678901234",
      stripeConnectAccountId: "acct_test",
      stripeConnectStatus: "active" as const,
      createdAt: Date.now(),
    });
    const referralCodeId = await ctx.db.insert("referralCodes", {
      affiliateUserId,
      code: CODE,
      isCustom: false,
      isActive: true,
      createdAt: Date.now(),
    });
    return { userId, affiliateUserId, referralCodeId };
  });
}

/** A paid order plus a commission on it, in whichever state the case needs. */
async function seedCommission(
  t: ReturnType<typeof convexTest>,
  ids: { affiliateUserId: Id<"affiliateUsers">; referralCodeId: Id<"referralCodes"> },
  status: "validated" | "payable",
) {
  return await t.run(async (ctx) => {
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
      amountCents: LIST_TOTAL,
      status: "paid" as const,
      isFounders: false,
      createdAt: Date.now(),
    });
    // art. 4.2: no payout without the affiliate's own invoice on file.
    const invoiceStorageId = await ctx.storage.store(
      new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
    );
    return await ctx.db.insert("referrals", {
      referrerId: ids.affiliateUserId,
      referralCodeId: ids.referralCodeId,
      orderId,
      customerEmail: "client@example.test",
      status,
      commissionCents: COMMISSION_CENTS,
      discountPercent: 10,
      discountAmountCents: 35_000,
      invoiceStorageId,
      invoiceUploadedAt: Date.now(),
      validatedAt: Date.now(),
      createdAt: Date.now(),
    });
  });
}

/**
 * Take the ten founders slots, so a checkout without a referral is billed at
 * list price.
 *
 * The founders offer zeroes the creation line for the first ten Essentielle
 * builds and does not stack with a referral (convex/foundersOffer.ts). So the
 * moment the kill-switch takes the referral away, the founders offer takes the
 * same 3 500 € back off — a correct outcome, and a second mechanism moving the
 * number this suite exists to pin down. Filling the slots puts the checkout in
 * the state it spends all but its first ten sales in.
 */
async function exhaustFoundersSlots(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    for (let i = 0; i < 10; i++) {
      await ctx.db.insert("orders", {
        customerEmail: `founder${i}@example.test`,
        customerFirstName: "Alex",
        customerLastName: "Martin",
        customerPhone: "+33600000000",
        restaurantName: `Chez Alex ${i}`,
        city: "Paris",
        buyerType: "business" as const,
        plan: "essentielle" as const,
        orderType: "creation" as const,
        billingPeriod: "yearly" as const,
        amountCents: planPrices.essentielle.maintenanceYearly,
        status: "paid" as const,
        isFounders: true,
        createdAt: Date.now(),
      });
    }
  });
}

const statusOf = async (t: ReturnType<typeof convexTest>, id: Id<"referrals">) =>
  (await t.run((ctx) => ctx.db.get(id)))!.status;

describe("switched off, a code is worth nothing", () => {
  test("validateCode refuses it", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, false);

    const result = await t.query(api.referralCodes.validateCode, { code: CODE });
    expect(result.valid).toBe(false);
    // Indistinguishable from a code that does not exist: the storefront must
    // not advertise that the programme merely paused.
    expect(result.error).toBe("Code invalide ou désactivé");
  });

  test("the checkout bills the list price", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, false);
    await exhaustFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: CODE,
    });

    const order = await t.run((ctx) => ctx.db.get(orderId as Id<"orders">));
    expect(order!.amountCents).toBe(LIST_TOTAL);
    // …and no commission was accrued along the way.
    expect(await t.run((ctx) => ctx.db.query("referrals").collect())).toEqual([]);
  });

  test("switched on, the same call is discounted — so the refusal was the switch", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, true);
    await exhaustFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: CODE,
    });

    const order = await t.run((ctx) => ctx.db.get(orderId as Id<"orders">));
    expect(order!.amountCents).toBe(
      LIST_TOTAL - planPrices.essentielle.creation * 0.1,
    );
    expect(await t.run((ctx) => ctx.db.query("referrals").collect())).toHaveLength(1);
  });
});

describe("switched off, no commission becomes payable", () => {
  test("a commission that settles late is held, not accrued", async () => {
    /* The one case the checkout gate cannot cover: a Stripe session stays
       payable for up to 24 h, so a sale discounted while the programme was on
       can settle after it was switched off. The webhook's `createFromCheckout`
       runs against metadata written before the switch. The row is kept — the
       customer really did get the discount and an operator has to be able to
       see that — and it is kept OUT of every path that pays. */
    const t = convexTest(schema, modules);
    const ids = await seedProgramme(t, false);

    const orderId = await t.run((ctx) =>
      ctx.db.insert("orders", {
        customerEmail: "late@example.test",
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
      }),
    );

    const referralId = await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: ids.affiliateUserId,
      referralCodeId: ids.referralCodeId,
      orderId,
      customerEmail: "late@example.test",
      commissionCents: COMMISSION_CENTS,
      discountPercent: 10,
      discountAmountCents: 35_000,
    });

    const referral = await t.run((ctx) => ctx.db.get(referralId));
    expect(referral!.status).toBe("blocked");
    expect(referral!.blockedAt).toBeGreaterThan(0);
    expect(referral!.statusReason).toMatch(/programEnabled/);

    /* And « blocked » really is terminal for every automatic path: neither cron
       reads it, so it can only move by an operator's hand. */
    await t.mutation(internal.referrals.validatePendingReferrals, {});
    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    expect(await statusOf(t, referralId)).toBe("blocked");
  });

  test("markValidatedAsPayable marks nothing", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedProgramme(t, false);
    const referralId = await seedCommission(t, ids, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    expect(await statusOf(t, referralId)).toBe("validated");
  });

  test("switched on, the same commission is marked payable", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedProgramme(t, true);
    const referralId = await seedCommission(t, ids, "validated");

    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    expect(await statusOf(t, referralId)).toBe("payable");
  });
});

describe("switched off, the payout cron wires nothing", () => {
  /* The rows that reached `payable` BEFORE the switch was thrown are already in
     the queue `processPayouts` reads, so gating only the cron that queues them
     would still let a whole run out.

     Measured by ORDERING rather than by mocking Stripe: with no key and no
     deliberate test-mode flag, `resolveStripeAccess` throws. So a run that
     resolves quietly can only have returned before reaching Stripe, and the
     control case below shows it throws when the programme is on. */
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv(TEST_CHECKOUT_ENV, "");
  });

  test("it returns before Stripe is ever reached, and the row is untouched", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedProgramme(t, false);
    const referralId = await seedCommission(t, ids, "payable");

    await expect(
      t.action(internal.stripeConnect.processPayouts, {}),
    ).resolves.toBeNull();

    // Still payable: not claimed (`paying`), not paid, not cancelled.
    expect(await statusOf(t, referralId)).toBe("payable");
    expect(
      (await t.run((ctx) => ctx.db.get(referralId)))!.stripeTransferId,
    ).toBeUndefined();
  });

  test("switched on, the same run gets as far as Stripe", async () => {
    const t = convexTest(schema, modules);
    const ids = await seedProgramme(t, true);
    await seedCommission(t, ids, "payable");

    await expect(
      t.action(internal.stripeConnect.processPayouts, {}),
    ).rejects.toThrow(/STRIPE_SECRET_KEY/);
  });
});
