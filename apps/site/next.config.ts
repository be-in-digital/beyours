import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { buildContentSecurityPolicy } from "./lib/security/content-security-policy";
import { validateSiteEnv, formatSiteEnvReport, isInlinedAtBuild } from "./lib/env";
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

/**
 * Report the variables this build is about to freeze into the client bundle.
 *
 * This has to live here rather than in `instrumentation.ts`, and the reason is
 * worth writing down because it is not guessable: Next 16 with Turbopack does
 * NOT call `register()` during `next build`. Measured — a full build with
 * `NEXT_PUBLIC_TVA_ENABLED` deliberately unset emits no `[env]` line at all,
 * so the boot check runs only when a server starts, long after the bundle was
 * written. `next.config.ts` is evaluated during the build itself, which is why
 * the CSP above already reads its Convex URL from here.
 *
 * It matters most for the charging flag. `/checkout` and `/tarifs` are
 * prerendered as static content, so the VAT branch of the order summary is
 * baked into HTML here and afterwards served straight from the CDN — no server
 * boot, and therefore no boot check, stands between that page and the customer.
 * `resolveTvaEnabled` is what keeps the baked value right; this is what says so
 * out loud while the build that bakes it is still running.
 *
 * Only the inlined half is judged, since the Stripe, AWS and e-mail variables
 * live on the Convex deployment and are absent from every build by design. It
 * warns and never throws: CI compiles this app against a deliberate placeholder
 * Convex URL, and a deployment whose flag is wrong is still refused at boot and
 * its sales still refused at checkout.
 *
 * Gated on the build phase, and that gate is load-bearing rather than tidy:
 * this file is evaluated by `next dev` and `next start` too, where the env it
 * can read is the RUNTIME env and not the one the bundle was compiled from.
 * Reporting there would be both a false alarm (a correct server whose bundle
 * is fine) and a false silence (a stale bundle built without the flag, started
 * with it) — announced under a heading that says "build". `instrumentation.ts`
 * covers the runtime, from the runtime, and says so.
 */
function reportInlinedEnv(): void {
  const problems = validateSiteEnv().problems.filter(
    (p) => isInlinedAtBuild(p) && p.tier !== "required",
  );
  if (problems.length === 0) return;
  console.warn(
    "[env] build : variables inlinées dans le bundle client à corriger",
  );
  console.warn(formatSiteEnvReport(problems));
}

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

/* The phase comes from Next itself. `process.env.NEXT_PHASE` is NOT set when
   this file is evaluated — measured: gating on it silenced the report during a
   real `next build` — so the phase argument is the only reliable signal, and it
   is the documented one. */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) reportInlinedEnv();
  return nextConfig;
}
