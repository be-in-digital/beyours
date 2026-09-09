/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Origins the Next.js auth handler accepts, mirroring `convex/auth.ts`.
 *
 * A client site runs on its own domain; the extra dev port only exists because
 * a second workspace takes 3000.
 */
export function nextTrustedOrigins(authUrl: string | undefined): string[] {
  const base = authUrl ?? "http://localhost:3000";
  const isLocal = /^https?:\/\/localhost(:\d+)?\/?$/i.test(base);
  return isLocal ? [...new Set([base, "http://localhost:3000", "http://localhost:3001"])] : [base];
}

// Lazy singleton to avoid throwing during Next.js build
// when CONVEX_SITE_URL is not available in the build environment.
let _auth: any;
function auth() {
  if (!_auth) {
    _auth = convexBetterAuthNextJs({
      convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
      convexSiteUrl: process.env.CONVEX_SITE_URL!,
      // `http://localhost:3001` used to be appended here unconditionally, so
      // every delivered client site trusted a development origin it has no use
      // for — the same defect as `convex/auth.ts`, on the Next.js half of the
      // seam, and the reason fixing only one of them would have left the hole
      // open. Localhost is trusted exactly while this site IS localhost.
      trustedOrigins: nextTrustedOrigins(process.env.BETTER_AUTH_URL),
    } as any);
  }
  return _auth;
}

export const handler = {
  GET: (request: Request) => auth().handler.GET(request),
  POST: (request: Request) => auth().handler.POST(request),
};
export const getToken = (...args: any[]) => auth().getToken(...args);
export const isAuthenticated = (...args: any[]) => auth().isAuthenticated(...args);
export const preloadAuthQuery = (...args: any[]) => auth().preloadAuthQuery(...args);
export const fetchAuthQuery = (...args: any[]) => auth().fetchAuthQuery(...args);
export const fetchAuthMutation = (...args: any[]) => auth().fetchAuthMutation(...args);
export const fetchAuthAction = (...args: any[]) => auth().fetchAuthAction(...args);
