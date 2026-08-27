import { z } from 'zod'

/** Treat empty strings as undefined so optional fields don't fail validation */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional())

/**
 * BeYours platform-level env vars.
 * Shared across all restaurant deployments.
 * Owned by BeYours's AWS/API accounts.
 */
export const packageEnvSchema = z.object({
  // AWS (BeYours account)
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // OpenAI (BeYours pays for translations)
  OPENAI_API_KEY: z.string().startsWith('sk-'),

  // Uber Eats (BeYours app partner)
  UBER_EATS_CLIENT_ID: opt(z.string().min(1)),
  UBER_EATS_CLIENT_SECRET: opt(z.string().min(1)),
  UBER_EATS_WEBHOOK_SECRET: opt(z.string().min(1)),

  // Uber Direct (delivery-as-a-service). Rides on the Uber Eats app
  // credentials; only the webhook secret can differ, and it falls back to the
  // Uber Eats one when unset.
  UBER_DIRECT_WEBHOOK_SECRET: opt(z.string().min(1)),

  // Deliveroo (BeYours app partner)
  DELIVEROO_CLIENT_ID: opt(z.string().min(1)),
  DELIVEROO_CLIENT_SECRET: opt(z.string().min(1)),
  DELIVEROO_WEBHOOK_SECRET: opt(z.string().min(1)),
})

/**
 * Per-restaurant site-level env vars.
 * Each deployment provides its own values.
 */
export const siteEnvSchema = z.object({
  // Convex
  CONVEX_DEPLOYMENT: opt(z.string().min(1)),
  NEXT_PUBLIC_CONVEX_URL: opt(z.string().url()),
  CONVEX_SITE_URL: opt(z.string().url()),

  // Auth
  BETTER_AUTH_SECRET: opt(z.string().min(1)),
  BETTER_AUTH_URL: opt(z.string().url()),
  SITE_URL: opt(z.string().url()),
  ENCRYPTION_KEY: opt(
    z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-character hex string (32 bytes)')
  ),

  // App
  NEXT_PUBLIC_APP_URL: opt(z.string().url()),
  ADMIN_URL: opt(z.string().url()),

  // AWS S3 (per-restaurant bucket)
  AWS_S3_BUCKET_NAME: opt(z.string().min(1)),

  // AWS SES (per-restaurant sending domain)
  AWS_SES_FROM_EMAIL: opt(z.string().email()),
  AWS_SES_FROM_NAME: opt(z.string().min(1)),
  AWS_SES_REPLY_TO_EMAIL: opt(z.string().email()),
  AWS_SES_CONFIGURATION_SET: opt(z.string().min(1)),

  // Monitoring (DSN per client)
  NEXT_PUBLIC_SENTRY_DSN: opt(z.string().url()),

  // Maps (key per client)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: opt(z.string().min(1)),

  // Stripe (per restaurant)
  STRIPE_SECRET_KEY: opt(z.string().startsWith('sk_')),
  STRIPE_PUBLISHABLE_KEY: opt(z.string().startsWith('pk_')),
  STRIPE_WEBHOOK_SECRET: opt(z.string().startsWith('whsec_')),

  // PayPal (per restaurant)
  PAYPAL_CLIENT_ID: opt(z.string().min(1)),
  PAYPAL_CLIENT_SECRET: opt(z.string().min(1)),
  // IMPORTANT: when UNSET this defaults to PRODUCTION. Keep "true" for sandbox.
  PAYPAL_SANDBOX_MODE: opt(z.enum(['true', 'false'])),

  // SumUp (per restaurant)
  SUMUP_CLIENT_ID: opt(z.string().min(1)),
  SUMUP_CLIENT_SECRET: opt(z.string().min(1)),

  // Uber Eats site-level config
  UBER_EATS_SANDBOX_MODE: opt(z.enum(['true', 'false'])),

  // Deliveroo site-level config
  DELIVEROO_BRAND_ID: opt(z.string().min(1)),
  DELIVEROO_SITE_ID: opt(z.string().min(1)),
  DELIVEROO_IS_SANDBOX: opt(z.enum(['true', 'false'])),
})

export type PackageEnv = z.infer<typeof packageEnvSchema>
export type SiteEnv = z.infer<typeof siteEnvSchema>
