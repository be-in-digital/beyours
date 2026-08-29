import type { NextConfig } from "next";
import { buildContentSecurityPolicy } from "./lib/security/content-security-policy";
import { BOOKING_ORIGIN } from "./lib/site-config";

/**
 * Evaluated once, at build time. `NEXT_PUBLIC_CONVEX_URL` is read from the same
 * environment that inlines it into the client bundle, so the policy and the
 * code it governs cannot describe two different backends.
 */
const contentSecurityPolicy = buildContentSecurityPolicy({
  isDevelopment: process.env.NODE_ENV !== "production",
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  bookingOrigin: BOOKING_ORIGIN,
});

const nextConfig: NextConfig = {
  /**
   * One block for every path. Unlike `apps/reference`, no route here serves
   * user-supplied bytes that would need a stricter policy of their own: the
   * only API route is `/api/signer-ip`, which returns the caller's own IP as
   * JSON, and uploaded files are held by Convex and linked to, never proxied.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          // Nothing embeds this app — verified across the repo, the only iframe
          // being apps/themes framing its own storefront preview. The demos
          // under /demo/[slug] are pages of this app, not embeds of it, so DENY
          // costs nothing and there is no route to carve out.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /**
           * `payment=()` is safe precisely because Stripe is never embedded
           * here: checkout and Connect onboarding are top-level redirects, so
           * the Payment Request API is never called on this origin. Embedded
           * Checkout or Elements would need this entry dropped and the Stripe
           * origins added to the CSP — the two changes go together.
           */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          /**
           * Severs `window.opener` between this app and anything it navigates
           * to or is opened by. Nothing here calls `window.open`, and the
           * Cal.com booking iframe is unaffected — COOP governs the top-level
           * browsing context group, not nested frames.
           *
           * Its companion COEP is deliberately absent: it would require the Cal
           * instance to serve CORP headers on the embed, which is not ours to
           * change, and would break booking to buy cross-origin isolation this
           * app has no use for.
           */
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
