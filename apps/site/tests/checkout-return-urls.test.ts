import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { siteOrigin } from "../convex/siteOrigin";

/**
 * Where Stripe sends a buyer back is the server's decision (#527).
 *
 * THE DEFECT. `stripe.createCheckoutSession` is a PUBLIC, unauthenticated
 * action — the deployment URL ships in the browser bundle — and it took
 * `successUrl` and `cancelUrl` as arguments and handed them to Stripe verbatim.
 * A genuine BeYours Checkout session, with the real company name and the real
 * card form, could be made to land on any domain after payment. A buyer who
 * paid would then be on a page somebody else controlled, having just typed
 * their card details on a page they had every reason to trust.
 *
 * Two halves, and both are needed. The behavioural half pins `siteOrigin`. The
 * source half pins that the action no longer ACCEPTS the arguments: a
 * deployment cannot be reached from here, so nothing else can prove the caller
 * has lost the ability to choose.
 */

const STRIPE = path.resolve(__dirname, "../convex/stripe.ts");
const source = fs.readFileSync(STRIPE, "utf8");

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("the checkout's return URLs", () => {
  it("reads SITE_URL, whatever a caller might have sent", () => {
    process.env.SITE_URL = "https://beyours.fr";
    expect(siteOrigin()).toBe("https://beyours.fr");
  });

  it("drops a trailing slash, so the joined path has exactly one", () => {
    // `${siteOrigin()}/checkout/success` is how both call sites build it, and
    // `https://beyours.fr//checkout/success` is a different URL to Stripe.
    process.env.SITE_URL = "https://beyours.fr/";
    expect(`${siteOrigin()}/checkout/success`).toBe("https://beyours.fr/checkout/success");
  });

  it("falls back to the production site rather than to `undefined`", () => {
    // Deliberate, and the behaviour that was already there: a misconfigured
    // deployment sends a buyer to the real site, not to `undefined/checkout/…`.
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteOrigin()).toBe("https://beyours.fr");
  });

  it("prefers SITE_URL over the NEXT_PUBLIC_ copy", () => {
    process.env.SITE_URL = "https://staging.beyours.fr";
    process.env.NEXT_PUBLIC_SITE_URL = "https://beyours.fr";
    expect(siteOrigin()).toBe("https://staging.beyours.fr");
  });
});

describe("the action no longer lets a caller choose", () => {
  it("declares neither successUrl nor cancelUrl as an argument", () => {
    expect(source).not.toMatch(/successUrl:\s*v\./);
    expect(source).not.toMatch(/cancelUrl:\s*v\./);
  });

  it("builds both from siteOrigin(), and reads neither off args", () => {
    expect(source).toContain("success_url: `${siteOrigin()}/checkout/success");
    expect(source).toContain("cancel_url: `${siteOrigin()}/checkout/cancel");
    expect(source).not.toContain("args.successUrl");
    expect(source).not.toContain("args.cancelUrl");
  });

  it("does it on the test-mode path too", () => {
    // That path returns a URL to the browser instead of creating a session, and
    // it carried the same argument. A redirect a caller chose is a redirect a
    // caller chose, whether Stripe performs it or the page does.
    expect(source).toContain("${siteOrigin()}/checkout/success?orderId=${orderId}&test=1");
  });

  it("is reading the file it thinks it is", () => {
    // Anti-vacuity: every assertion above is `not.toContain` on a string, and
    // all four would pass on an empty file or a bad path.
    expect(source).toContain("createCheckoutSession");
    expect(source.length).toBeGreaterThan(5_000);
  });
});
