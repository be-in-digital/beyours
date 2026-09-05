// @vitest-environment node
/// <reference types="vite/client" />

/**
 * Nothing customer-billing is readable without a session (#154).
 *
 * Three public queries answered to anyone holding the deployment URL — which
 * ships in the browser bundle:
 *
 *   invoices.getByEmail       an email → up to 50 invoices, invoicePdfUrl and
 *                             hostedInvoiceUrl included
 *   subscriptions.getByEmail  an email → plan, status, Stripe ids
 *   orders.get                an id → the whole document: email, name, phone,
 *                             restaurant, city, SIRET, amountCents, session id
 *
 * None had a caller. They were written for a customer area that does not
 * exist, and they sat six lines from `getCheckoutAccess`, whose comment states
 * the rule they broke.
 *
 * Deleting them is a one-line diff that a later "the client area needs this"
 * reverses just as easily, so what is pinned here is the *surface* rather than
 * the three names: these modules expose exactly this much and no more. A new
 * public function fails this test until someone lists it, which is the moment
 * to ask whether it should be reading from a session instead of an argument.
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/** `export const foo = query(` — and not `internalQuery(`, which is fine. */
const PUBLIC_EXPORT = /^export const ([A-Za-z0-9_]+) = (query|mutation|action)\(/gm;

function publicFunctionsOf(module: string): string[] {
  const source = readFileSync(
    new URL(`../../convex/${module}.ts`, import.meta.url),
    "utf-8"
  );
  return [...source.matchAll(PUBLIC_EXPORT)].map((m) => m[1]!).sort();
}

describe("the modules that hold a customer's commercial record", () => {
  test("invoices exposes nothing publicly", () => {
    expect(publicFunctionsOf("invoices")).toEqual([]);
  });

  test("subscriptions exposes nothing publicly", () => {
    expect(publicFunctionsOf("subscriptions")).toEqual([]);
  });

  test("payments exposes nothing publicly", () => {
    // Already true before the fix; asserted so it stays that way.
    expect(publicFunctionsOf("payments")).toEqual([]);
  });

  test("orders exposes exactly the two that earn it", () => {
    // `getCheckoutAccess` — a boolean and a first name, deliberately narrow,
    //   because the orderId travels in a URL.
    // `countFoundersSold` — a count of remaining seats, shown on the pricing
    //   page before anyone signs in. It reveals nothing about a customer.
    expect(publicFunctionsOf("orders")).toEqual([
      "countFoundersSold",
      "getCheckoutAccess",
    ]);
  });
});

describe("the module that decides a discount", () => {
  /* `referralCodes` holds the derivation `createCheckoutSession` now depends
     on. `resolveForCheckout` — which returns the code id, the affiliate who
     earns the commission and the percent off — is an internalQuery, and must
     stay one: the whole point of deriving those three server-side is lost the
     moment a client can call the thing that derives them. */
  test("referralCodes exposes exactly the four that earn it", () => {
    expect(publicFunctionsOf("referralCodes")).toEqual([
      // The affiliate's own code, read from their session.
      "customizeMyCode",
      "generateMyCode",
      "getMyCode",
      // Public and unauthenticated by design: the storefront prices a typed-in
      // code before anyone signs in. A display value only — see
      // tests/convex/checkoutReferralIntegrity.test.ts.
      "validateCode",
    ]);
  });

  test("resolveForCheckout is not reachable from a browser", () => {
    expect(publicFunctionsOf("referralCodes")).not.toContain(
      "resolveForCheckout",
    );
  });
});

describe("the three that were removed", () => {
  test.each([
    ["invoices", "getByEmail"],
    ["subscriptions", "getByEmail"],
    ["orders", "get"],
  ])("%s.%s is gone", (module, name) => {
    expect(publicFunctionsOf(module)).not.toContain(name);
  });
});
