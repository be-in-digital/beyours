import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy } from "../lib/security/content-security-policy";
import { BOOKING_ORIGIN } from "../lib/site-config";

const PROD = {
  isDevelopment: false,
  convexUrl: "https://fearless-poodle-133.convex.cloud",
  bookingOrigin: BOOKING_ORIGIN,
};

/** Pulls one directive's source list out of the serialised policy. */
function directive(policy: string, name: string): string[] {
  const found = policy
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} in: ${policy}`);
  return found.split(" ").slice(1);
}

describe("buildContentSecurityPolicy — what it must keep blocking", () => {
  it("refuses framing, plugins, base hijacking and off-origin form posts", () => {
    const policy = buildContentSecurityPolicy(PROD);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
  });

  // 'unsafe-eval' is React Refresh and the Turbopack runtime. A production
  // bundle evaluates nothing, so granting it there would be a gift to nobody.
  it("grants 'unsafe-eval' to the dev server only", () => {
    expect(directive(buildContentSecurityPolicy(PROD), "script-src")).not.toContain(
      "'unsafe-eval'",
    );
    expect(
      directive(
        buildContentSecurityPolicy({ ...PROD, isDevelopment: true }),
        "script-src",
      ),
    ).toContain("'unsafe-eval'");
  });

  /**
   * Stripe is server-side and both money paths are top-level redirects, so no
   * Stripe origin belongs in a fetch directive. If embedded Checkout or
   * Elements ever lands, this test is meant to fail and be rewritten
   * deliberately — not to be the reason a nonexistent origin sat here for a
   * year.
   */
  it("names no Stripe origin", () => {
    expect(buildContentSecurityPolicy(PROD)).not.toContain("stripe.com");
  });
});

describe("buildContentSecurityPolicy — what it must keep allowing", () => {
  // components/booking-modal.tsx loads the embed script from this origin and
  // frames it. Drop any of the three and booking breaks.
  it("allows the Cal.com instance to load, frame and call home", () => {
    const policy = buildContentSecurityPolicy(PROD);
    for (const name of ["script-src", "frame-src", "connect-src"]) {
      expect(directive(policy, name)).toContain(BOOKING_ORIGIN);
    }
  });

  it("allows Convex over https and wss", () => {
    const sources = directive(buildContentSecurityPolicy(PROD), "connect-src");
    expect(sources).toContain("https://*.convex.cloud");
    expect(sources).toContain("wss://*.convex.cloud");
  });

  // A `convex dev` backend is http on localhost and outside the wildcard, so
  // it has to be added from NEXT_PUBLIC_CONVEX_URL — with its scheme read, not
  // assumed.
  it("adds a local backend with the http/ws pair it actually uses", () => {
    const sources = directive(
      buildContentSecurityPolicy({
        ...PROD,
        isDevelopment: true,
        convexUrl: "http://127.0.0.1:3210",
      }),
      "connect-src",
    );
    expect(sources).toContain("http://127.0.0.1:3210");
    expect(sources).toContain("ws://127.0.0.1:3210");
  });

  it("does not repeat a cloud deployment the wildcard already covers", () => {
    const sources = directive(buildContentSecurityPolicy(PROD), "connect-src");
    expect(sources).not.toContain("https://fearless-poodle-133.convex.cloud");
  });

  // lib/env.ts is the one place that reports a bad Convex URL. This builder
  // must not turn the same fault into a second, louder failure at build time.
  it("survives a missing or malformed Convex URL", () => {
    for (const convexUrl of [undefined, "", "   ", "not-a-url"]) {
      const sources = directive(
        buildContentSecurityPolicy({ ...PROD, convexUrl }),
        "connect-src",
      );
      expect(sources).toContain("https://*.convex.cloud");
    }
  });
});
