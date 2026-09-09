/**
 * The Content-Security-Policy for apps/site.
 *
 * There was none, on the app that takes the money (Stripe Checkout), runs the
 * internal ops console (`app/admin`) and the affiliate portal
 * (`app/parrainage`). `next.config.ts` was an empty stub, so unlike
 * `apps/reference` — which set five other headers and only lacked a CSP — the
 * omission here was not a decision about CSP. It was no decision at all.
 *
 * The shape below is borrowed from
 * `apps/reference/lib/security/content-security-policy.ts`. The values are
 * not. That app is the engine's test bench, cloned per client, and it loads
 * nothing this one loads. Every origin here is present because something in
 * this repository demonstrably fetches it, and the comment says what.
 *
 * What this policy is, and is not
 * -------------------------------
 * `script-src` carries `'unsafe-inline'`. Next.js bootstraps hydration from
 * inline `<script>` tags, and the alternative — a per-request nonce — has to be
 * minted in middleware. This app has no middleware at all, and nearly all of it
 * is statically rendered: the marketing pages, the 50 `/templates/[slug]`
 * pages, the 50 `/demo/[slug]` storefronts. Adding middleware to mint a nonce
 * would opt every one of them out of static rendering. That is a
 * rendering-architecture decision, not a security fix, and it is not made here.
 *
 * So this policy does not stop injected inline script. It also does not stop a
 * script that is already running from leaking what it reads: CSP has no say
 * over top-level navigation, and `location = "https://…"` needs no directive.
 *
 * What it does stop is cheap and worth having: `<base>` hijacking, plugin and
 * object embedding, being framed by another site, forms that post somewhere
 * else, and subresources pulled from origins this app has no business talking
 * to.
 *
 * Why Stripe is absent
 * --------------------
 * A CSP written from the outside would add `js.stripe.com` and
 * `hooks.stripe.com` and consider checkout covered. This app would never use
 * them. There is no `@stripe/stripe-js` dependency; `stripe` is imported
 * server-side only, inside Convex actions (`convex/stripe.ts`,
 * `convex/stripeConnect.ts`). Both money paths leave the origin rather than
 * embed anything: checkout creates a hosted Session and the browser follows
 * `session.url` (`components/checkout/checkout-flow.tsx`), and affiliate
 * onboarding follows a Connect Account Link
 * (`app/parrainage/dashboard/profil/page.tsx`). Those are top-level
 * navigations, which no directive here governs, so the Stripe entries would be
 * dead weight — and dead entries are how a policy stops being read.
 *
 * Embedded Checkout or Elements would change that. This file, and the
 * `payment=()` in the `Permissions-Policy` next to it, are what has to change
 * with them.
 */

import { sentryIngestOrigin } from "../observability/sentry";

/**
 * Where the Convex backend is allowed to be.
 *
 * `apps/reference` leaves `connect-src` open to all of `https:`/`wss:`, because
 * its Convex URL is a per-client runtime value and pinning it would bake one
 * client's backend into another client's build. That reasoning does not carry
 * over here — this app is one deployment (beyours.fr) — but a narrower answer
 * than "the Convex domain" is still out of reach.
 *
 * The affiliate invoice upload POSTs to a URL the backend mints at runtime with
 * `ctx.storage.generateUploadUrl()`
 * (`components/parrainage/invoice-upload.tsx`). Nothing readable at build time
 * says which host that URL lands on, and a payout blocked by a CSP violation is
 * a worse failure than a `connect-src` one label wider. So `convex.cloud` is
 * allowed as a domain, and this is the loosest thing in the policy.
 *
 * It buys one thing anyway: a build whose `NEXT_PUBLIC_CONVEX_URL` went missing
 * still falls back to `placeholder.convex.cloud` and still fails exactly the way
 * bug #6 failed (see `.env.production.example`), with no CSP violation layered
 * on top to misdirect whoever debugs it next time.
 */
const CONVEX_CLOUD = ["https://*.convex.cloud", "wss://*.convex.cloud"];

/**
 * The deployment origin, when the wildcard above does not already cover it: a
 * `convex dev` backend on localhost, or a self-hosted deployment.
 *
 * A malformed value is skipped rather than thrown on. `lib/env.ts` already
 * validates this variable and reports it at server start; two components
 * reporting one fault teaches nobody which of them to fix.
 */
function extraConvexOrigins(convexUrl: string | undefined): string[] {
  const raw = convexUrl?.trim();
  if (!raw) return [];

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return [];
  }

  // `hostname` rather than `host`: the port must not decide whether the
  // wildcard already covers this deployment.
  if (parsed.hostname.endsWith(".convex.cloud")) return [];

  // The scheme is read rather than assumed because a local backend
  // (`http://127.0.0.1:3210`) is served over http, and pinning `https:`/`wss:`
  // would break `convex dev`.
  const secure = parsed.protocol === "https:";
  return [
    `${secure ? "https" : "http"}://${parsed.host}`,
    `${secure ? "wss" : "ws"}://${parsed.host}`,
  ];
}

export interface ContentSecurityPolicyOptions {
  isDevelopment: boolean;
  /** Raw `NEXT_PUBLIC_CONVEX_URL`; absent or malformed is tolerated. */
  convexUrl?: string;
  /**
   * Origin of the self-hosted Cal.com instance behind the booking modal.
   * Passed in from `BOOKING_ORIGIN` (`lib/site-config.ts`) rather than written
   * here, so the origin the embed loads and the origin the policy allows are
   * the same string.
   */
  bookingOrigin: string;
  /**
   * Raw `NEXT_PUBLIC_SENTRY_DSN`. The browser SDK POSTs every event to the
   * ingest host inside it, and `connect-src 'self'` blocks that — silently, in
   * the console, with the SDK reporting success. A deployment with no DSN adds
   * no entry, which is the normal state of CI and of local development.
   */
  sentryDsn?: string;
}

export function buildContentSecurityPolicy(
  options: ContentSecurityPolicyOptions,
): string {
  const { isDevelopment, convexUrl, bookingOrigin, sentryDsn } = options;

  /* Derived from the DSN rather than written out, so the host events are sent
     to and the host the policy allows cannot be two different strings. A
     malformed DSN yields nothing here and is reported by `resolveSentryOptions`
     at boot; two components shouting about one fault teaches nobody which to
     fix. */
  const sentryOrigin = sentryIngestOrigin(sentryDsn);

  /* The booking modal (`components/booking-modal.tsx`) is the only third-party
     script on the site. `@calcom/embed-react` appends a
     `<script src="<bookingOrigin>/embed/embed.js">` to `<head>`, then builds an
     iframe on that same origin — hence `script-src` and `frame-src`, and
     `connect-src` because the embed calls back to its own instance.

     The package's built-in default is `https://app.cal.com/embed/embed.js`.
     Cal is self-hosted here and both call sites pass `embedJsUrl` explicitly,
     so `app.cal.com` is deliberately not allowed: if that default ever fires it
     is a bug, and a blocked script is how we would find out. */

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    // 'unsafe-eval' is the dev server's: React Refresh and the Turbopack
    // runtime evaluate modules. A production build does not. This used to name
    // three.js as the other thing that does not need eval; the WebGL hero it
    // was there for rendered on no page and went with its dependencies.
    "script-src": isDevelopment
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", bookingOrigin]
      : ["'self'", "'unsafe-inline'", bookingOrigin],

    // Next.js emits the critical CSS inline, `next/font/local` injects its
    // @font-face block, framer-motion animates through style attributes, and
    // the Cal embed styles its wrapper from script. All of that is inline
    // style; there is no nonce here to hash it against.
    "style-src": ["'self'", "'unsafe-inline'"],

    // Every image is local (`public/`, served through `/_next/image`). `data:`
    // is for the two `data:image/svg+xml` grain textures in `app/globals.css`
    // and for the blur placeholders `next/image` inlines. No remote host, which
    // is why `next.config.ts` declares no `images.remotePatterns` either.
    "img-src": ["'self'", "data:"],

    // The nine woff2 files are committed and served from `/_next/static`.
    // `app/layout.tsx` explains why they are not fetched from Google at build
    // time; this is the line that has to change if that ever gets reversed.
    "font-src": ["'self'"],

    // Convex over WebSocket is what every `useQuery` on the admin console and
    // the affiliate portal rides on; see CONVEX_CLOUD above for why the domain
    // is allowed whole.
    "connect-src": [
      "'self'",
      ...CONVEX_CLOUD,
      ...extraConvexOrigins(convexUrl),
      bookingOrigin,
      // The Sentry ingest endpoint the browser SDK POSTs envelopes to. Absent
      // when this deployment has no Sentry project.
      ...(sentryOrigin ? [sentryOrigin] : []),
      // ws: is the HMR socket.
      ...(isDevelopment ? ["ws:"] : []),
    ],

    // 'self' covers the Next.js dev overlay. Nothing in the app frames a
    // same-origin page: `/demo/[slug]` renders the storefront directly
    // (`components/templates/storefront-demo.tsx`), it does not embed it.
    "frame-src": ["'self'", bookingOrigin],

    // Blocks a <base> tag redirecting every relative URL on the page.
    "base-uri": ["'self'"],

    // No <object>/<embed>: legacy plugin content is a scripting surface.
    "object-src": ["'none'"],

    // Same intent as the X-Frame-Options: DENY alongside it, for browsers that
    // prefer CSP. Nothing embeds this app: the only iframe in the repo is
    // `apps/themes/app/preview/[pageSlug]`, which frames its own storefront,
    // and the demos are pages of this app rather than embeds of it.
    "frame-ancestors": ["'none'"],

    // Every form here submits through onSubmit; not one carries an `action`.
    // An injected form cannot post the page's fields to another origin.
    "form-action": ["'self'"],
  };

  // media-src, worker-src, manifest-src and child-src are deliberately absent:
  // this app plays no media, starts no worker and ships no web manifest, so
  // each of them falls back to `default-src 'self'` — which is what they would
  // have said. Listing them would only make the policy look better researched
  // than it is.
  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}
