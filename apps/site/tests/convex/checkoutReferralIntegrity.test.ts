/// <reference types="vite/client" />

/**
 * The checkout must not be tellable what to charge.
 *
 * `createCheckoutSession` is public and unauthenticated — anyone who reads the
 * Convex URL out of the browser bundle can call it — and it used to accept
 * `discountPercent`, `referrerId` and `referralCodeId` as arguments and bill
 * what it was handed. Measured before the fix, on Premium/yearly (list
 * 9 500 € excl. tax, 10 % code):
 *
 *     honest order amountCents  = 875000
 *     forged order amountCents  = 207500   (discountPercent: 99)
 *     discountPercent: 500      = -2800000, status « paid »
 *
 * and a forged `referrerId` minted a 9 000 € commission for an affiliate who
 * owned no code. `referralCodes.validateCode` is public too and hands out the
 * ids for any code, and affiliate codes are published by design, so nothing
 * about this needed guessing.
 *
 * Those figures are the record of the defect, measured on Premium when Premium
 * was still on sale. The cases below now run on Essentielle — see `PLAN` — so
 * the amounts they assert are smaller; the rule under test is unchanged.
 *
 * These cases hold the rule that replaced it: the customer says which code
 * they hold, the server says what it is worth.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { TEST_CHECKOUT_ENV } from "../../convex/stripeMode";
import { planPrices } from "../../convex/planPrices";
import { foundersOffer } from "../../convex/foundersOffer";
import { VAT } from "../../lib/legal/company";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.ts");

/* The plan under test has to be one that is OPEN for sale.
   `createCheckoutSession` refuses a closed plan before any referral logic runs
   (convex/planAvailability.ts), so a fixture pinned to a closed one makes every
   case below fail on the refusal rather than on the discount it is about. #350
   closed Premium — the plan these cases were originally measured on — which is
   why this now names the plan once and derives every amount from it.

   Essentielle/yearly: creation 3 500 € + yearly maintenance 1 000 €
   = 4 500 € excl. tax. */
const PLAN = "essentielle" as const;
const LIST_TOTAL =
  planPrices[PLAN].creation + planPrices[PLAN].maintenanceYearly;

const CHECKOUT = {
  plan: PLAN,
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
  /* Required since #349: the express request for immediate performance
     (art. L. 221-28). The handler refuses a checkout without it, so every
     case here has to carry it to reach the behaviour it is testing. */
  withdrawalWaiverConsent: true,
  /* Required since #346: what the summary the customer read actually
     quoted, so the handler can check it against what Stripe is about to
     charge. Same expression the other checkout suites use. */
  taxDisplayed: VAT.regime === "reel",
};

beforeEach(() => {
  /* The no-payment path: the order is written and marked paid without Stripe,
     which is what lets these cases read `amountCents` off the row. The pricing
     decision under test is the same one the live path takes. */
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  vi.stubEnv(TEST_CHECKOUT_ENV, "true");
  vi.stubEnv("STRIPE_TAX_ENABLED", String(VAT.regime === "reel"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seedProgramme(
  t: ReturnType<typeof convexTest>,
  opts: {
    code?: string;
    isActive?: boolean;
    affiliateStatus?: "active" | "suspended" | "rejected";
    discountOverridePercent?: number;
    defaultDiscountPercent?: number;
    affiliateEmail?: string;
    commissionOverrideCents?: number;
    contractStatus?: "pending_contract" | "active" | "blocked_new_version";
  } = {},
) {
  return await t.run(async (ctx) => {
    await ctx.db.insert("affiliateSettings", {
      defaultCommissionCents: 50000,
      defaultDiscountPercent: opts.defaultDiscountPercent ?? 10,
      validationDelayDays: 30,
      programEnabled: true,
      updatedAt: Date.now(),
    });
    const userId = await ctx.db.insert("users", {
      email: opts.affiliateEmail ?? "apporteur@example.test",
    });
    const affiliateUserId = await ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: opts.affiliateStatus ?? ("active" as const),
      /* Signed, unless a case says otherwise. This defaulted to absent, which
         is the grandfathered path — so every case here was exercising the
         legacy allowance rather than a real affiliate. */
      contractStatus: opts.contractStatus ?? ("active" as const),
      stripeConnectStatus: "active" as const,
      discountOverridePercent: opts.discountOverridePercent,
      commissionOverrideCents: opts.commissionOverrideCents,
      createdAt: Date.now(),
    });
    const referralCodeId = await ctx.db.insert("referralCodes", {
      affiliateUserId,
      code: opts.code ?? "BID-HONEST",
      isCustom: false,
      isActive: opts.isActive ?? true,
      createdAt: Date.now(),
    });
    return { affiliateUserId, referralCodeId };
  });
}

/**
 * Take the founders offer off the table.
 *
 * The first ten Essentielle builds have their creation line zeroed
 * (`convex/foundersOffer.ts`), and only when NO referral applies — the two are
 * mutually exclusive by construction. That is precisely the condition every
 * case below that expects LIST PRICE is in: the code was refused, so no
 * referral resolved, so the founders offer takes over and the order comes back
 * at the maintenance line alone. The assertion would still be handed a number,
 * but it would be reading the founders freebie rather than the absence of a
 * discount.
 *
 * Selling the slots out first keeps "list price" meaning list price. The rows
 * go straight into the table rather than through `orders.create`, which is
 * rate-limited precisely to stop ten cheap calls consuming the offer.
 */
async function sellOutFoundersSlots(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    for (let i = 0; i < foundersOffer.totalSlots; i++) {
      await ctx.db.insert("orders", {
        customerEmail: `founder${i}@example.test`,
        customerFirstName: "Fondateur",
        customerLastName: String(i),
        customerPhone: "+33600000000",
        restaurantName: `Fondateur ${i}`,
        city: "Lyon",
        buyerType: "business" as const,
        plan: foundersOffer.plan,
        orderType: "creation" as const,
        billingPeriod: "yearly" as const,
        amountCents: planPrices[foundersOffer.plan].maintenanceYearly,
        status: "paid" as const,
        isFounders: true,
        createdAt: Date.now(),
      });
    }
  });
}

async function orderAmount(
  t: ReturnType<typeof convexTest>,
  orderId: string,
): Promise<number> {
  const order = await t.run((ctx) => ctx.db.get(orderId as Id<"orders">));
  if (!order) throw new Error(`No order ${orderId}`);
  return order.amountCents;
}

describe("the discount is derived, never accepted", () => {
  test("a caller-supplied discountPercent is refused outright", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t);

    /* Not "ignored" — refused. The argument no longer exists, and Convex
       rejects unknown fields, so the forgery cannot even be expressed. Cast
       because the point of the case is to send what the validator forbids. */
    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        referralCode: "BID-HONEST",
        discountPercent: 99,
      } as unknown as Parameters<
        typeof t.action<typeof api.stripe.createCheckoutSession>
      >[1]),
    ).rejects.toThrow(/discountPercent/);

    /* And it left nothing behind: a refused forgery must not hold a founders
       slot or show up in the ops console as revenue. */
    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toEqual([]);
  });

  test.each([
    ["referrerId", { referrerId: "10000;affiliateUsers" }],
    ["referralCodeId", { referralCodeId: "10000;referralCodes" }],
  ])("a caller-supplied %s is refused outright", async (field, extra) => {
    const t = convexTest(schema, modules);
    await seedProgramme(t);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        referralCode: "BID-HONEST",
        ...extra,
      } as unknown as Parameters<
        typeof t.action<typeof api.stripe.createCheckoutSession>
      >[1]),
    ).rejects.toThrow(new RegExp(field));
  });

  test("the code alone is billed at the code's own percent", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    // 4 500 € − 10 % of the 3 500 € creation line = 4 150 €.
    const expected = LIST_TOTAL - planPrices[PLAN].creation * 0.1;
    expect(await orderAmount(t, orderId)).toBe(expected);
    /* Pinned as a literal as well as derived. The derived form follows
       `planPrices`, so a change there would silently move every expectation in
       this file with it; this line makes such a change show up as one
       deliberate edit. */
    expect(expected).toBe(415000);
  });

  test("an affiliate's override wins over the programme default", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: 25 });

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(
      LIST_TOTAL - planPrices[PLAN].creation * 0.25,
    );
  });

  test("the code is matched case- and space-insensitively, as validateCode does", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "  bid-honest  ",
    });

    expect(await orderAmount(t, orderId)).toBe(
      LIST_TOTAL - planPrices[PLAN].creation * 0.1,
    );
  });
});

describe("a code that must not discount anything", () => {
  test.each([
    ["unknown", { code: "BID-HONEST" }, "BID-NOSUCH"],
    ["deactivated", { isActive: false }, "BID-HONEST"],
    ["owned by a suspended affiliate", { affiliateStatus: "suspended" as const }, "BID-HONEST"],
  ])("a %s code is billed at list price and earns no commission", async (_label, seed, code) => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, seed);
    await sellOutFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: code,
    });

    expect(await orderAmount(t, orderId)).toBe(LIST_TOTAL);
    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toEqual([]);
  });

  /* The guard compared the two addresses as raw strings, and an adversarial
     re-check walked through it with one character: `apporteur+facture@` is the
     same inbox as `apporteur@`, so the affiliate bought their own build at
     750 € off AND paid themselves a 500 € commission — repeatable, because
     each invented tag is also a fresh rate-limit subject. */
  test.each([
    ["the same address", "apporteur@example.test"],
    ["a different case", "APPORTEUR@Example.test"],
    ["a sub-address label", "apporteur+facture@example.test"],
    ["a label and case", "Apporteur+BeYours@example.test"],
    ["surrounding whitespace", "  apporteur@example.test  "],
    ["a fully-qualified domain", "apporteur@example.test."],
  ])("the affiliate buying as %s gets no discount", async (_label, buyer) => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { affiliateEmail: "apporteur@example.test" });
    await sellOutFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      customerEmail: buyer,
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(LIST_TOTAL);
    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toEqual([]);
  });

  test("gmail's dots do not buy a second identity either", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { affiliateEmail: "jean.dupont@gmail.com" });
    await sellOutFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      customerEmail: "jeandupont+beyours@gmail.com",
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(LIST_TOTAL);
  });

  test("a genuine third party still gets the discount", async () => {
    // The guard must refuse the affiliate, not every customer.
    const t = convexTest(schema, modules);
    await seedProgramme(t, { affiliateEmail: "apporteur@example.test" });

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      customerEmail: "chef@trattoria.fr",
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(
      LIST_TOTAL - planPrices[PLAN].creation * 0.1,
    );
    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toHaveLength(1);
  });
});

describe("the storefront is never shown a code the checkout will refuse", () => {
  test.each([
    ["above 100", 9999],
    ["negative", -5],
  ])("validateCode reports a %s percent as invalid", async (_label, percent) => {
    /* This is the one direction the two could still drift: the checkout was
       bounded and `validateCode` was not, so a misconfigured percent was
       advertised as a good code and then hard-refused at payment. Telling a
       customer their code works and then failing the sale is worse than
       declining it up front. */
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: percent });

    const shown = await t.query(api.referralCodes.validateCode, {
      code: "BID-HONEST",
    });
    expect(shown.valid).toBe(false);

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        referralCode: "BID-HONEST",
      }),
    ).rejects.toThrow(/Remise de parrainage invalide/);
  });
});

describe("a code only discounts while its contract holds", () => {
  test.each([
    ["never signed the contract", "pending_contract" as const],
    ["is on a superseded version", "blocked_new_version" as const],
  ])("an affiliate who %s earns nothing", async (_label, contractStatus) => {
    /* `affiliateUsers.createAfterSignup` is public and grants
       `status: "active"`, so without this the programme was self-service: sign
       up, mint a code, take 750 € off a friend's build and accrue a 500 €
       commission with nothing signed. */
    const t = convexTest(schema, modules);
    await seedProgramme(t, { contractStatus });
    await sellOutFoundersSlots(t);

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(LIST_TOTAL);
    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toEqual([]);
  });

  test("the storefront is told so too, not just the checkout", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { contractStatus: "pending_contract" });

    const shown = await t.query(api.referralCodes.validateCode, {
      code: "BID-HONEST",
    });
    expect(shown.valid).toBe(false);
  });

  test("a row predating the contract system still works", async () => {
    /* Absent is grandfathered on purpose — `createAfterSignup` cannot produce
       it, and refusing it would kill a real affiliate's code if the migration
       has not been run. See convex/affiliateStanding.ts. */
    const t = convexTest(schema, modules);
    await seedProgramme(t);
    await t.run(async (ctx) => {
      const affiliate = await ctx.db.query("affiliateUsers").first();
      await ctx.db.patch(affiliate!._id, { contractStatus: undefined });
    });

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    expect(await orderAmount(t, orderId)).toBe(
      LIST_TOTAL - planPrices[PLAN].creation * 0.1,
    );
  });
});

describe("a misconfigured percent refuses the sale rather than invoicing it", () => {
  /* These are admin-written and unbounded (`admin.updateSettings` and
     `discountOverridePercent` both take a bare v.number()), so the bound has
     to be enforced where the money is computed. 101 % is what produced the
     -28 000 € order. */
  test.each([
    ["above 100", 101],
    ["far above 100", 500],
    ["negative", -5],
  ])("a %s override is refused", async (_label, discountOverridePercent) => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent });

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        referralCode: "BID-HONEST",
      }),
    ).rejects.toThrow(/Remise de parrainage invalide/);

    // Refused before the order exists — no negative row, no founders slot held.
    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toEqual([]);
  });

  test("no order can ever be written for a negative amount", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: 500 });

    await expect(
      t.action(api.stripe.createCheckoutSession, {
        ...CHECKOUT,
        referralCode: "BID-HONEST",
      }),
    ).rejects.toThrow();

    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders.filter((o) => o.amountCents < 0)).toEqual([]);
  });
});

describe("the commission follows the code, not the caller", () => {
  test("the referral is attributed to the code's owner", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId, referralCodeId } = await seedProgramme(t);

    /* A second affiliate, with a fat override, that the code does NOT belong
       to. Before the fix the caller named the payee: passing this id alongside
       someone else's code wrote a 9 000 € commission to it. */
    const outsider = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "outsider@example.test" });
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate" as const,
        status: "active" as const,
        stripeConnectStatus: "active" as const,
        commissionOverrideCents: 900000,
        createdAt: Date.now(),
      });
    });

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals).toHaveLength(1);
    expect(referrals[0]!.referrerId).toBe(affiliateUserId);
    expect(referrals[0]!.referralCodeId).toBe(referralCodeId);
    expect(referrals[0]!.orderId).toBe(orderId);
    // The programme default, not the outsider's 9 000 €.
    expect(referrals[0]!.commissionCents).toBe(50000);
    expect(referrals.some((r) => r.referrerId === outsider)).toBe(false);
  });

  test("the discount recorded on the referral is the derived one", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: 15 });

    await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
    expect(referrals[0]!.discountPercent).toBe(15);
    expect(referrals[0]!.discountAmountCents).toBe(
      planPrices[PLAN].creation * 0.15,
    );
  });
});

describe("validateCode and the checkout cannot drift", () => {
  test("what the storefront is shown is what the checkout charges", async () => {
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: 30 });

    const shown = await t.query(api.referralCodes.validateCode, {
      code: "BID-HONEST",
    });
    expect(shown.valid).toBe(true);

    const charged = await t.run(async (ctx) =>
      ctx.runQuery(internal.referralCodes.resolveForCheckout, {
        code: "BID-HONEST",
      }),
    );

    expect(charged).not.toBeNull();
    expect(charged!.discountPercent).toBe(shown.discountPercent);
    expect(charged!.referralCodeId).toBe(shown.referralCodeId);
    expect(charged!.referrerId).toBe(shown.affiliateUserId);
  });

  test("a percent the storefront never saw is still the one charged", async () => {
    /* The drift that matters is not two functions disagreeing on a good code
       — it is the storefront being shown one number while the checkout bills
       another. Change the affiliate between the two reads: the checkout must
       follow the database, not whatever the page was told earlier. */
    const t = convexTest(schema, modules);
    await seedProgramme(t, { discountOverridePercent: 30 });

    const shown = await t.query(api.referralCodes.validateCode, {
      code: "BID-HONEST",
    });
    expect(shown.discountPercent).toBe(30);

    await t.run(async (ctx) => {
      const affiliate = await ctx.db.query("affiliateUsers").first();
      await ctx.db.patch(affiliate!._id, { discountOverridePercent: 5 });
    });

    const { orderId } = await t.action(api.stripe.createCheckoutSession, {
      ...CHECKOUT,
      referralCode: "BID-HONEST",
    });

    // 5 %, the current value — not the 30 % the page is still displaying.
    expect(await orderAmount(t, orderId)).toBe(
      LIST_TOTAL - planPrices[PLAN].creation * 0.05,
    );
  });
});
