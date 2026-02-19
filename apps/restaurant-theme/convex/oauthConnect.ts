"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// OAuth provider configurations (SumUp + PayPal only — Stripe uses Account Links)
// ---------------------------------------------------------------------------

const OAUTH_PROVIDERS = {
  sumup: {
    authorizeUrl: "https://api.sumup.com/authorize",
    tokenUrl: "https://api.sumup.com/token",
    envClientId: "SUMUP_CLIENT_ID",
    envClientSecret: "SUMUP_CLIENT_SECRET",
    scope: "payments user.app-settings",
  },
  paypal: {
    authorizeUrl: "https://www.sandbox.paypal.com/signin/authorize",
    tokenUrl: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    envClientId: "PAYPAL_CLIENT_ID",
    envClientSecret: "PAYPAL_CLIENT_SECRET",
    scope: "openid email",
  },
} as const;

type OAuthProvider = keyof typeof OAUTH_PROVIDERS;

// ---------------------------------------------------------------------------
// Token response shapes
// ---------------------------------------------------------------------------

interface SumUpTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  merchant_code?: string;
}

interface PayPalTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  merchant_id?: string;
}

interface StripeAccountResponse {
  id: string;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  error?: { message: string };
}

interface StripeAccountLinkResponse {
  url: string;
  error?: { message: string };
}

// ---------------------------------------------------------------------------
// Inline AES-256-GCM encryption (Node.js runtime only)
// ---------------------------------------------------------------------------

async function encrypt(plaintext: string): Promise<string> {
  const { randomBytes, createCipheriv } = await import("crypto");

  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
  }

  const key = Buffer.from(hex, "hex");
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

// ---------------------------------------------------------------------------
// Action: generate connection URL for any provider
// ---------------------------------------------------------------------------

/**
 * Generate the connection URL for a given payment provider.
 *
 * - Stripe: Creates a connected account via Account Links (no OAuth).
 * - SumUp/PayPal: Standard OAuth authorization URL.
 *
 * The client redirects the browser to the returned URL.
 */
export const generateOAuthUrl = action({
  args: {
    provider: v.union(
      v.literal("stripe"),
      v.literal("sumup"),
      v.literal("paypal")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) throw new Error("CONVEX_SITE_URL environment variable is not configured");

    // -----------------------------------------------------------------------
    // Stripe: Account Links flow (no OAuth, no Client ID needed)
    // -----------------------------------------------------------------------
    if (args.provider === "stripe") {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

      // 1. Create a Standard connected account
      const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "type=standard",
      });
      const account = (await accountRes.json()) as StripeAccountResponse;
      if (!accountRes.ok || account.error) {
        throw new Error(account.error?.message ?? "Failed to create Stripe account");
      }

      // 2. Generate an onboarding link
      const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          account: account.id,
          return_url: `${siteUrl}/connect/stripe/callback?account_id=${account.id}`,
          refresh_url: `${siteUrl}/connect/stripe/refresh?account_id=${account.id}`,
          type: "account_onboarding",
        }),
      });
      const link = (await linkRes.json()) as StripeAccountLinkResponse;
      if (!linkRes.ok || link.error) {
        throw new Error(link.error?.message ?? "Failed to create Stripe onboarding link");
      }

      return { url: link.url, state: "" };
    }

    // -----------------------------------------------------------------------
    // SumUp / PayPal: Standard OAuth flow
    // -----------------------------------------------------------------------
    const config = OAUTH_PROVIDERS[args.provider as OAuthProvider];
    const clientId = process.env[config.envClientId];
    if (!clientId) {
      throw new Error(`${config.envClientId} environment variable is not configured`);
    }

    const redirectUri = `${siteUrl}/connect/${args.provider}/callback`;

    const { randomBytes } = await import("crypto");
    const state = randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
    });

    return {
      url: `${config.authorizeUrl}?${params.toString()}`,
      state,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal action: exchange OAuth code for tokens, encrypt, and persist
// ---------------------------------------------------------------------------

/**
 * Exchange an OAuth authorization code for tokens, encrypt them, and persist
 * the connection. Runs in Node.js to access the crypto module for encryption.
 *
 * Called by httpAction callbacks in oauthCallbackHandlers.ts via ctx.runAction.
 */
export const exchangeOAuthToken = internalAction({
  args: {
    provider: v.union(v.literal("sumup"), v.literal("paypal")),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const config = OAUTH_PROVIDERS[args.provider];
    const clientId = process.env[config.envClientId];
    const clientSecret = process.env[config.envClientSecret];

    if (!clientId || !clientSecret) {
      throw new Error("Missing provider credentials");
    }

    const siteUrl = process.env.CONVEX_SITE_URL ?? "";
    const redirectUri = `${siteUrl}/connect/${args.provider}/callback`;

    let merchantId = "";
    let accessToken = "";
    let refreshToken: string | undefined;
    let expiresIn: number | undefined;

    if (args.provider === "sumup") {
      const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: args.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });
      const json = (await res.json()) as SumUpTokenResponse;
      if (!res.ok) throw new Error("SumUp token exchange failed");
      merchantId = json.merchant_code ?? "";
      accessToken = json.access_token;
      refreshToken = json.refresh_token;
      expiresIn = json.expires_in;
    } else {
      // PayPal uses HTTP Basic auth
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: args.code,
          redirect_uri: redirectUri,
        }),
      });
      const json = (await res.json()) as PayPalTokenResponse;
      if (!res.ok) throw new Error("PayPal token exchange failed");
      merchantId = json.merchant_id ?? "";
      accessToken = json.access_token;
      refreshToken = json.refresh_token;
      expiresIn = json.expires_in;
    }

    // Encrypt tokens before persisting
    const encryptedAccessToken = await encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? await encrypt(refreshToken) : undefined;
    const tokenExpiresAt = expiresIn !== undefined ? Date.now() + expiresIn * 1000 : undefined;

    await ctx.runMutation(internal.paymentConnections.upsert, {
      provider: args.provider,
      merchantId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt,
      status: "connected" as const,
    });
  },
});
