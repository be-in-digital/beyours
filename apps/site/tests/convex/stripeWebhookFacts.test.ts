/// <reference types="vite/client" />

/**
 * Every field read the webhook makes off a Stripe object, pinned one by one.
 *
 * This is the file that was missing. The SDK pins API version
 * 2026-02-25.clover, on which `invoice.subscription` and
 * `subscription.current_period_*` no longer exist — and `http.ts` read them
 * anyway, through `Record<string, unknown>` and `as` casts, so `tsc` was blind
 * and no test named the events. Same lesson the `toFacts` test next door
 * records: the mapping is the part that can be wrong, so it is the part that
 * needs its own cases.
 */

import { describe, expect, test } from "vitest";
import type Stripe from "stripe";
import {
  invoicePlanHint,
  invoiceSubscriptionId,
  legacyShapeWarning,
  optionalText,
  refId,
  subscriptionPeriod,
  toMillis,
  STRIPE_PINNED_API_VERSION,
} from "../../convex/stripeWebhookFacts";

const invoice = (over: Record<string, unknown> = {}) =>
  ({ id: "in_1", object: "invoice", ...over }) as unknown as Stripe.Invoice;

const subscription = (over: Record<string, unknown> = {}) =>
  ({ id: "sub_1", object: "subscription", ...over }) as unknown as Stripe.Subscription;

const item = (start: number, end: number) => ({
  id: `si_${start}`,
  object: "subscription_item",
  current_period_start: start,
  current_period_end: end,
});

describe("invoiceSubscriptionId", () => {
  test("reads the current shape: parent.subscription_details.subscription", () => {
    expect(
      invoiceSubscriptionId(
        invoice({
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_premium" },
          },
        }),
      ),
    ).toEqual({ id: "sub_premium", legacy: false });
  });

  test("unwraps an expanded subscription object", () => {
    expect(
      invoiceSubscriptionId(
        invoice({
          parent: {
            subscription_details: {
              subscription: { id: "sub_expanded", object: "subscription" },
            },
          },
        }),
      ).id,
    ).toBe("sub_expanded");
  });

  test("falls back to the removed top-level field, and says so", () => {
    /* A replay of an event rendered at an older API version still has to link
       its invoice — Stripe re-sends the payload as first rendered. Silent
       would be worse than broken: it would look fixed. */
    expect(invoiceSubscriptionId(invoice({ subscription: "sub_old" }))).toEqual({
      id: "sub_old",
      legacy: true,
    });
  });

  test("prefers the current shape when both are present", () => {
    expect(
      invoiceSubscriptionId(
        invoice({
          subscription: "sub_old",
          parent: { subscription_details: { subscription: "sub_new" } },
        }),
      ),
    ).toEqual({ id: "sub_new", legacy: false });
  });

  test.each([
    ["no parent", {}],
    ["a null parent", { parent: null }],
    ["a quote parent", { parent: { type: "quote_details", quote_details: { quote: "qt_1" } } }],
    ["a null subscription_details", { parent: { subscription_details: null } }],
  ])("returns nothing for %s", (_label, over) => {
    expect(invoiceSubscriptionId(invoice(over)).id).toBeUndefined();
  });
});

describe("invoicePlanHint", () => {
  test("reads the plan Stripe snapshots onto the invoice", () => {
    expect(
      invoicePlanHint(
        invoice({
          parent: {
            subscription_details: {
              subscription: "sub_1",
              metadata: { plan: "premium", billingPeriod: "yearly" },
            },
          },
        }),
      ),
    ).toBe("premium");
  });

  test.each([
    ["an unknown plan", "entreprise"],
    ["an empty string", ""],
  ])("refuses %s rather than guessing", (_label, plan) => {
    expect(
      invoicePlanHint(
        invoice({ parent: { subscription_details: { metadata: { plan } } } }),
      ),
    ).toBeUndefined();
  });

  test("returns nothing when there is no metadata at all", () => {
    expect(invoicePlanHint(invoice())).toBeUndefined();
  });
});

describe("subscriptionPeriod", () => {
  test("reads the current shape: items.data[].current_period_*", () => {
    expect(
      subscriptionPeriod(
        subscription({ items: { object: "list", data: [item(1000, 2000)] } }),
      ),
    ).toEqual({ start: 1000, end: 2000, legacy: false });
  });

  test("spans every item — earliest start, latest end", () => {
    /* Ours are single-item, but `coveredUntil` decides whether a paying client
       keeps service, so the multi-item answer errs long deliberately. */
    expect(
      subscriptionPeriod(
        subscription({
          items: { object: "list", data: [item(1500, 2500), item(1000, 2000)] },
        }),
      ),
    ).toEqual({ start: 1000, end: 2500, legacy: false });
  });

  test("falls back to the removed top-level fields, and says so", () => {
    expect(
      subscriptionPeriod(
        subscription({ current_period_start: 100, current_period_end: 200 }),
      ),
    ).toEqual({ start: 100, end: 200, legacy: true });
  });

  test("prefers items over the removed fields", () => {
    expect(
      subscriptionPeriod(
        subscription({
          current_period_start: 1,
          current_period_end: 2,
          items: { object: "list", data: [item(1000, 2000)] },
        }),
      ),
    ).toEqual({ start: 1000, end: 2000, legacy: false });
  });

  test.each([
    ["an empty item list", { items: { object: "list", data: [] } }],
    ["no items at all", {}],
  ])("reports nothing for %s — never a zero", (_label, over) => {
    /* The caller must then write NOTHING. A 0 would set coveredUntil to the
       epoch and expire a client who is paying, which is worse than a stale
       value. */
    const period = subscriptionPeriod(subscription(over));
    expect(period).toEqual({ start: undefined, end: undefined, legacy: false });
    expect(toMillis(period.end)).toBeUndefined();
  });
});

describe("the null-to-undefined conversions", () => {
  /* Stripe returns `null`; Convex `v.optional(...)` accepts an ABSENT key and
     rejects `null`. Passing one through made the mutation throw, the handler
     answer 500, and Stripe retry the event forever. */
  test.each([
    ["a bare id", "cus_1", "cus_1"],
    ["an expanded object", { id: "cus_2" }, "cus_2"],
    ["null", null, undefined],
    ["undefined", undefined, undefined],
  ])("refId turns %s into the id", (_label, input, expected) => {
    expect(refId(input as string | { id: string } | null | undefined)).toBe(expected);
  });

  test.each([
    ["a string", "BID-0042", "BID-0042"],
    ["null", null, undefined],
    ["an empty string", "", ""],
  ])("optionalText passes %s through without null", (_label, input, expected) => {
    expect(optionalText(input as string | null)).toBe(expected);
  });

  test.each([
    [1731536000, 1731536000000],
    [0, 0],
    [null, undefined],
    [undefined, undefined],
  ])("toMillis(%s) = %s", (input, expected) => {
    expect(toMillis(input as number | null | undefined)).toBe(expected);
  });
});

describe("the legacy warning", () => {
  test("names the version actually delivered and the one expected", () => {
    const message = legacyShapeWarning("Facture in_1", "2024-06-20");
    expect(message).toContain("in_1");
    expect(message).toContain("2024-06-20");
    expect(message).toContain(STRIPE_PINNED_API_VERSION);
  });

  test("stays readable when Stripe sent no version", () => {
    expect(legacyShapeWarning("Facture in_1", null)).toContain("inconnue");
  });
});
