/// <reference types="vite/client" />

/**
 * The checkout session must keep the card, and must keep BNPL on the page.
 *
 * WHY THIS FILE EXISTS. #322 found that nothing attached a reusable payment
 * method to the customer, so every maintenance subscription — a
 * `charge_automatically` one, 240 to 2 400 € a year — was built against a
 * customer with nothing to charge. Its first renewal invoice failed, dunning
 * started, and `/maintenance/status` cut a client's updates a year after they
 * had paid, over a card nobody ever asked them for.
 *
 * The fix was one option on the Checkout session, and it landed with no test
 * at all (#411, B2-F6): `grep -rn setup_future_usage` over `apps/` and
 * `packages/` returned the two lines of the fix itself and nothing else.
 *
 * WHY THE SHAPE OF THE OPTION IS THE WHOLE POINT, and why a test that only
 * asserted "the card is saved" would be worse than none. There are two ways to
 * ask Stripe for this:
 *
 *   payment_intent_data: { setup_future_usage: "off_session" }   ← WRONG
 *   payment_method_options: { card: { setup_future_usage: … } }  ← what we do
 *
 * They look interchangeable and are not. The first applies to the whole
 * intent, and Stripe responds by REMOVING from the Checkout page every method
 * that cannot honour it — silently dropping Alma and Klarna, the two BNPL
 * options this page offers on purpose. The buyer never sees them and nothing
 * anywhere errors. The per-method form saves the card when a card is used and
 * leaves the page alone.
 *
 * So these cases pin both halves: the card is kept, AND the whole-intent form
 * is absent, AND the BNPL methods are still on the session. A revert to the
 * tempting one-liner fails here rather than in a quarter's renewal figures.
 */

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { VAT } from "../../lib/legal/company";

const modules = import.meta.glob("../../convex/**/*.ts");

/** Every `checkout.sessions.create` call, as Stripe would have received it. */
const stripeFake = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, unknown>>,
}));

vi.mock("stripe", () => {
  class FakeStripe {
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          stripeFake.sessions.push(params);
          return {
            id: `cs_test_${stripeFake.sessions.length}`,
            url: "https://checkout.stripe.test/session",
          };
        },
      },
    };
    coupons = {
      create: async (params: Record<string, unknown>) => ({
        id: "coupon_1",
        ...params,
      }),
    };
  }
  return { default: FakeStripe };
});

/** What the regime in force requires of the charging flags. */
const CHARGING_EXPECTED = VAT.regime === "reel";

const STRIPE_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_TAX_ENABLED: String(CHARGING_EXPECTED),
  STRIPE_PRICE_ESSENTIELLE_MONTHLY: "price_ess_monthly",
  STRIPE_PRICE_ESSENTIELLE_YEARLY: "price_ess_yearly",
  STRIPE_PRICE_PREMIUM_MONTHLY: "price_prem_monthly",
  STRIPE_PRICE_PREMIUM_YEARLY: "price_prem_yearly",
  /* The founders offer is capped by a persistent Stripe coupon, and a LIVE
     checkout that cannot reach it is refused rather than served free
     (convex/foundersOffer.ts). Both have to be here or every case below dies
     on that refusal before a session is ever created. */
  STRIPE_FOUNDERS_COUPON_ID: "coupon_founders",
  STRIPE_PRODUCT_CREATION_ESSENTIELLE: "prod_creation_ess",
  STRIPE_PRODUCT_CREATION_PREMIUM: "prod_creation_prem",
};

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const [key, value] of Object.entries(STRIPE_ENV)) {
    saved.set(key, process.env[key]);
    process.env[key] = value;
  }
  // The deliberate no-payment path must stay off: it returns before a session
  // is ever created, and every assertion here would then pass on an empty list.
  saved.set("BEYOURS_TEST_CHECKOUT", process.env.BEYOURS_TEST_CHECKOUT);
  delete process.env.BEYOURS_TEST_CHECKOUT;
  stripeFake.sessions.length = 0;
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
  vi.unstubAllEnvs();
});

/* Essentielle: Premium is `coming_soon` and the checkout refuses it before it
   reaches the session, which would make every case here pass on the wrong
   refusal (convex/planAvailability.ts). */
function checkoutArgs(buyerType: "business" | "personal" = "business") {
  return {
    plan: "essentielle" as const,
    orderType: "creation" as const,
    buyerType,
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
    taxDisplayed: CHARGING_EXPECTED,
  };
}

async function openCheckout(buyerType: "business" | "personal" = "business") {
  const t = convexTest(schema, modules);
  await t.action(api.stripe.createCheckoutSession, checkoutArgs(buyerType));
  expect(stripeFake.sessions).toHaveLength(1);
  return stripeFake.sessions[0]!;
}

describe("the Checkout session keeps a card the renewals can be charged to", () => {
  test("asks Stripe to save the card off-session", async () => {
    const session = await openCheckout();
    expect(session.payment_method_options).toEqual({
      card: { setup_future_usage: "off_session" },
    });
  });

  test("does not ask for it on the whole intent, which would drop Alma and Klarna", async () => {
    // THE REGRESSION this file exists for. `payment_intent_data.
    // setup_future_usage` is the form everyone reaches for, and Stripe answers
    // it by removing every method that cannot be saved off-session — so the
    // BNPL options disappear from the page with nothing raised anywhere.
    const session = await openCheckout();
    const intentData = session.payment_intent_data as
      | Record<string, unknown>
      | undefined;
    expect(intentData?.setup_future_usage).toBeUndefined();
  });

  test("leaves the BNPL methods on the page for a business buyer", async () => {
    const session = await openCheckout("business");
    expect(session.payment_method_types).toEqual(["card", "alma"]);
  });

  test("adds Klarna for a personal buyer, and still keeps the card option", async () => {
    const session = await openCheckout("personal");
    expect(session.payment_method_types).toEqual(["card", "alma", "klarna"]);
    expect(session.payment_method_options).toEqual({
      card: { setup_future_usage: "off_session" },
    });
  });

  test("the fake records what it was actually called with", () => {
    // Guards the guard: every case above reads its assertion out of this list,
    // so a fake that recorded nothing would make all of them vacuous.
    expect(stripeFake.sessions).toEqual([]);
  });
});
