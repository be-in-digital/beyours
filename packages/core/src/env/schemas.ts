import { z } from 'zod'

/**
 * BeInDigital platform-level env vars.
 * Shared across all restaurant deployments.
 * Owned by BeInDigital's AWS/API accounts.
 */
export const packageEnvSchema = z.object({
  // AWS (BeInDigital account)
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // OpenAI (BeInDigital pays for translations)
  OPENAI_API_KEY: z.string().startsWith('sk-'),

  // Uber Eats (BeInDigital app partner)
  UBER_EATS_CLIENT_ID: z.string().min(1).optional(),
  UBER_EATS_CLIENT_SECRET: z.string().min(1).optional(),
  UBER_EATS_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Deliveroo (BeInDigital app partner)
  DELIVEROO_CLIENT_ID: z.string().min(1).optional(),
  DELIVEROO_CLIENT_SECRET: z.string().min(1).optional(),
  DELIVEROO_WEBHOOK_SECRET: z.string().min(1).optional(),
})

/**
 * Per-restaurant site-level env vars.
 * Each deployment provides its own values.
 */
export const siteEnvSchema = z.object({
  // Convex
  CONVEX_DEPLOYMENT: z.string().min(1).optional(),
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  CONVEX_SITE_URL: z.string().url().optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url().optional(),
  SITE_URL: z.string().url().optional(),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Must be a 64-character hex string (32 bytes)')
    .optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ADMIN_URL: z.string().url().optional(),

  // AWS S3 (per-restaurant bucket)
  AWS_S3_BUCKET_NAME: z.string().min(1).optional(),

  // AWS SES (per-restaurant sending domain)
  AWS_SES_FROM_EMAIL: z.string().email().optional(),
  AWS_SES_FROM_NAME: z.string().min(1).optional(),
  AWS_SES_REPLY_TO_EMAIL: z.string().email().optional(),
  AWS_SES_CONFIGURATION_SET: z.string().min(1).optional(),

  // Monitoring (DSN per client)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Maps (key per client)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),

  // Stripe (per restaurant)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // PayPal (per restaurant)
  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),

  // SumUp (per restaurant)
  SUMUP_CLIENT_ID: z.string().min(1).optional(),
  SUMUP_CLIENT_SECRET: z.string().min(1).optional(),

  // Uber Eats site-level config
  UBER_EATS_SANDBOX_MODE: z.enum(['true', 'false']).optional(),

  // Deliveroo site-level config
  DELIVEROO_BRAND_ID: z.string().min(1).optional(),
  DELIVEROO_SITE_ID: z.string().min(1).optional(),
  DELIVEROO_IS_SANDBOX: z.enum(['true', 'false']).optional(),
})

export type PackageEnv = z.infer<typeof packageEnvSchema>
export type SiteEnv = z.infer<typeof siteEnvSchema>
