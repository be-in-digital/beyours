/// <reference types="vite/client" />

/**
 * A deployment without a Stripe key does not sell for free (#155).
 *
 * `getStripe()` returning `null` used to answer two questions at once — "a
 * developer has no key" and "production lost its key" — and every money path
 * assumed the first. The rule below separates them, and these cases are what
 * hold the separation: the fake path has to be asked for by name, and every
 * way of *almost* asking for it refuses instead.
 */

import { describe, expect, test } from "vitest";
import {
  StripeNotConfiguredError,
  TEST_CHECKOUT_ENV,
  resolveStripeAccess,
} from "../../convex/stripeMode";

const OPERATION = "ouvrir une session de paiement";

describe("resolveStripeAccess — a configured deployment", () => {
  test("is live, and hands back the key it was configured with", () => {
    const access = resolveStripeAccess(OPERATION, {
      STRIPE_SECRET_KEY: "sk_live_abc",
    });

    expect(access).toEqual({ mode: "live", secretKey: "sk_live_abc" });
  });

  test("stays live even with the test flag left on", () => {
    // The safe direction. A flag forgotten on a deployment that later gets a
    // real key must not keep giving the product away — the key decides.
    const access = resolveStripeAccess(OPERATION, {
      STRIPE_SECRET_KEY: "sk_live_abc",
      [TEST_CHECKOUT_ENV]: "true",
    });

    expect(access.mode).toBe("live");
  });
});

describe("resolveStripeAccess — the deliberate test path", () => {
  test("is available when the flag says so exactly", () => {
    const access = resolveStripeAccess(OPERATION, {
      [TEST_CHECKOUT_ENV]: "true",
    });

    expect(access).toEqual({ mode: "test" });
  });
});

describe("resolveStripeAccess — an unconfigured deployment", () => {
  test("refuses rather than letting the sale through", () => {
    expect(() => resolveStripeAccess(OPERATION, {})).toThrow(
      StripeNotConfiguredError
    );
  });

  test("refuses on an empty key, which is how a cleared env var reads", () => {
    // The test→live swap that clears the value instead of replacing it — the
    // shape the audit called out. An empty string is not a key.
    expect(() =>
      resolveStripeAccess(OPERATION, { STRIPE_SECRET_KEY: "" })
    ).toThrow(StripeNotConfiguredError);
  });

  test.each(["1", "yes", "TRUE", "True", " true", "false", ""])(
    "refuses when the flag reads %o rather than \"true\"",
    (value) => {
      // Only the exact string opts in. A mistyped flag stopping checkout is a
      // support ticket; a mistyped flag enabling it is a free product.
      expect(() =>
        resolveStripeAccess(OPERATION, { [TEST_CHECKOUT_ENV]: value })
      ).toThrow(StripeNotConfiguredError);
    }
  );

  test("names the operation and both ways out", () => {
    // The error is read by whoever is staring at a broken deployment.
    try {
      resolveStripeAccess(OPERATION, {});
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain(OPERATION);
      expect(message).toContain("STRIPE_SECRET_KEY");
      expect(message).toContain(TEST_CHECKOUT_ENV);
    }
  });
});
