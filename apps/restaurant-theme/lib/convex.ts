import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const betterAuth = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.CONVEX_SITE_URL!,
});

export const handler = betterAuth.handler;
export const getToken = betterAuth.getToken;
export const isAuthenticated = betterAuth.isAuthenticated;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const preloadAuthQuery: any = betterAuth.preloadAuthQuery;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchAuthQuery: any = betterAuth.fetchAuthQuery;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchAuthMutation: any = betterAuth.fetchAuthMutation;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetchAuthAction: any = betterAuth.fetchAuthAction;
