import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

// Destructure with explicit type assertion to avoid non-portable inferred type error
const betterAuth = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.CONVEX_SITE_URL!,
});

export const handler = betterAuth.handler;
export const getToken = betterAuth.getToken;
export const isAuthenticated = betterAuth.isAuthenticated;
export const preloadAuthQuery: (...args: any[]) => any = betterAuth.preloadAuthQuery;
export const fetchAuthQuery: (...args: any[]) => any = betterAuth.fetchAuthQuery;
export const fetchAuthMutation: (...args: any[]) => any = betterAuth.fetchAuthMutation;
export const fetchAuthAction: (...args: any[]) => any = betterAuth.fetchAuthAction;
