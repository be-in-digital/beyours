/**
 * The application's Content-Security-Policy.
 *
 * There was none. The header block next to it set five other security headers,
 * so the omission read like a decision rather than a gap.
 *
 * What this policy is, and is not
 * -------------------------------
 * `script-src` still carries `'unsafe-inline'`. Next.js bootstraps hydration
 * from inline `<script>` tags, and the alternative — a per-request nonce — has
 * to be minted in middleware, which opts every page out of static rendering.
 * That is a rendering-architecture decision, not a security fix, and it is not
 * made here.
 *
 * So this policy does not stop injected inline script. What it does stop is
 * cheap and worth having: `<base>` hijacking, plugin and object embedding,
 * framing by another site, and forms that post somewhere else.
 *
 * It is deliberately not the control that closes the stored-XSS report. That
 * one is `buildFileResponseHeaders` in `lib/services/file-serving.ts`, which
 * puts `default-src 'none'; sandbox` on every proxied upload — a strict policy,
 * on the only responses whose bodies a user supplied, needing no nonce.
 */

/**
 * Directives whose values do not change between environments.
 *
 * `connect-src` stays open to `https:`/`wss:`: the Convex deployment URL is a
 * per-client runtime value, and `headers()` is evaluated at build time, so
 * pinning it here would bake one client's backend into another client's build.
 */
const BASE_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  // Blocks a <base> tag redirecting every relative URL on the page.
  "base-uri": ["'self'"],
  // No <object>/<embed>: legacy plugin content is a scripting surface.
  "object-src": ["'none'"],
  // Same intent as the X-Frame-Options: DENY alongside it, for browsers that
  // prefer CSP.
  "frame-ancestors": ["'none'"],
  // An injected form cannot post the page's fields to another origin.
  "form-action": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "blob:", "https:"],
  "frame-src": ["'self'", "https:"],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
}

/**
 * The Convex origin, but only when it is a loopback address.
 *
 * `connect-src` is open to `https:`/`wss:`, which covers every real deployment.
 * It does not cover a Convex backend running on the machine itself, because
 * that one is plain `http:`/`ws:` — and a production build refuses `ws:`, by
 * design and by test. The end-to-end suite runs `pnpm start` against exactly
 * such a backend, so without this every Convex query in the browser is blocked
 * and every admin screen sits on a loading skeleton forever.
 *
 * Only loopback hosts are admitted, so this cannot widen a deployed policy: a
 * client's `NEXT_PUBLIC_CONVEX_URL` is an `https://…convex.cloud` address and
 * returns nothing here. Granting a page the right to talk to 127.0.0.1 also
 * grants nothing to a remote attacker.
 */
function loopbackConvexSources(convexUrl?: string): string[] {
  if (!convexUrl) return []
  let url: URL
  try {
    url = new URL(convexUrl)
  } catch {
    return []
  }
  const host = url.hostname
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  if (!isLoopback) return []
  const socket = url.protocol === "https:" ? "wss:" : "ws:"
  return [url.origin, `${socket}//${url.host}`]
}

/**
 * The hosts the Maps JS API serves its own code from: the entry point, and the
 * bundle it pulls in once it is running.
 */
const GOOGLE_MAPS_SCRIPT_SOURCES = [
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
]

export function buildContentSecurityPolicy(options: {
  isDevelopment: boolean
  /** `NEXT_PUBLIC_CONVEX_URL`. Only used when it names a loopback backend. */
  convexUrl?: string
}): string {
  const directives: Record<string, string[]> = {
    ...BASE_DIRECTIVES,
    // 'unsafe-eval' is the dev server's: React Refresh and the Turbopack
    // runtime evaluate modules. A production build does not, so it is not
    // granted there.
    // Google Maps is admitted by name because the storefront loads it by name.
    //
    // `useGooglePlacesAutocomplete` injects a <script> from
    // maps.googleapis.com, and a policy of `'self' 'unsafe-inline'` refused it:
    // the browser blocked the load, `window.google` stayed undefined, and the
    // address field on checkout silently stopped suggesting anything. Nobody
    // saw it because the e2e test that covers it was among the several hundred
    // that never ran.
    //
    // Not gated on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. `/address-test` falls
    // back to a fixture key so the suite can intercept the request, so a build
    // without the variable still injects the tag; a policy that dropped the
    // hosts there would refuse the very thing the test exists to exercise.
    // Neither host serves user-supplied content, which is what makes naming
    // them cheap.
    "script-src": options.isDevelopment
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", ...GOOGLE_MAPS_SCRIPT_SOURCES]
      : ["'self'", "'unsafe-inline'", ...GOOGLE_MAPS_SCRIPT_SOURCES],
    // ws: is the HMR socket.
    "connect-src": [
      ...(options.isDevelopment
        ? ["'self'", "https:", "wss:", "ws:"]
        : ["'self'", "https:", "wss:"]),
      ...loopbackConvexSources(options.convexUrl),
    ],
  }

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ")
}
