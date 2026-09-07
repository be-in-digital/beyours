/**
 * The environment variables, as data rather than as a schema.
 *
 * `validateAllEnv()` answers "is this deployment configured?" — it reads
 * `process.env` and reports what is wrong. That is the wrong shape for the
 * three things that also need the lists:
 *
 *  - the `pnpm env:setup` wizard, which has to ASK for a variable that is not
 *    set yet, grouped by the integration it belongs to;
 *  - `pnpm env:sync`, which has to know which keys the Convex deployment needs
 *    a copy of;
 *  - `.env.example`, and the boilerplate generator that writes it.
 *
 * All three used to restate the lists by hand. `apps/themes/scripts/env.mjs`
 * carried its own `REQUIRED`, `GROUPS` and `CONVEX_KEYS` under the comment
 * "keep them in sync when the engine is updated" — an instruction nobody can
 * follow reliably, and had not: its `CONVEX_KEYS` was missing
 * `AWS_S3_PUBLIC_BASE_URL`, `EMAIL_API_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`,
 * `AUTH_ALLOW_UNVERIFIED_EMAIL`, `NEXT_PUBLIC_APP_URL` and the six `BID_*` /
 * `STRIPE_BID_*` keys, every one of which `convex/*.ts` reads from
 * `process.env`. A missing key there is not a lint failure — it is a Convex
 * function reading `undefined` in production.
 *
 * So the lists live here once, and `required` is DERIVED from the Zod shapes
 * rather than retyped beside them. The tests in `__tests__/manifest.test.ts`
 * hold the rest: every name here has to exist in one of the two schemas, and
 * every all-or-nothing group has to match `SITE_FEATURE_GROUPS`.
 *
 * Kept free of `process.env` on purpose — this module describes what a
 * deployment needs, it does not look at what one has. That is what makes it
 * usable from a setup wizard running before any of it is set.
 *
 * See #37.
 *
 * @module env/manifest
 */

import {
  packageEnvSchema,
  siteEnvRequiredSchema,
  siteEnvOptionalSchema,
  SITE_FEATURE_GROUPS,
} from './schemas'

/** Which schema owns a variable. Mirrors `EnvTier` minus the `feature` case. */
export type EnvManifestTier = 'package' | 'site'

export interface EnvManifestGroup {
  /**
   * What the operator is being asked about, in the words the wizard shows.
   * French: this is read by the person setting up a restaurant, not by a
   * contributor.
   */
  feature: string
  vars: readonly string[]
  /**
   * The subset of `vars` that must be set together or not at all.
   *
   * Half a payment provider is worse than none — the admin offers the method,
   * the customer picks it, and the charge fails at the till. So
   * `siteEnvOptionalSchema` refuses a partially configured feature at boot, and
   * this is the same rule ahead of time, for a wizard that would rather warn
   * than let the deploy fail.
   *
   * A SUBSET, not the whole group, and the difference carries a decision each
   * time. `STRIPE_PUBLISHABLE_KEY` is absent from Stripe's: no line of the
   * product reads it, so demanding it would gate a deploy on a value nothing
   * consumes. `PAYPAL_SANDBOX_MODE` is absent from PayPal's because it has its
   * own rule in `env/sandbox.ts`. Derived from `SITE_FEATURE_GROUPS` rather
   * than restated, so the two cannot disagree.
   */
  requiredTogether: readonly string[]
  tier: EnvManifestTier
}

export interface EnvManifest {
  /** Every variable a deployment refuses to boot without, both tiers. */
  required: readonly string[]
  /** Optional integrations, in the order a setup wizard should offer them. */
  groups: readonly EnvManifestGroup[]
  /**
   * Variables the CONVEX deployment needs its own copy of.
   *
   * Convex functions run in their own isolate with their own environment: a
   * value in `.env.local` is invisible to them. This is the set that
   * `convex/*.ts` and the packages it imports read from `process.env`, and it
   * is what `pnpm env:sync` and `pnpm convex:env` push across.
   */
  convexKeys: readonly string[]
}

/** Zod object shapes expose their keys; this is just the readable spelling. */
const keysOf = (schema: { shape: Record<string, unknown> }): string[] =>
  Object.keys(schema.shape)

/**
 * Every variable the schema binds into an all-or-nothing rule, flattened.
 *
 * Intersected with each group's own `vars` below, so a group states its
 * variables once and the strictness comes from the schema.
 */
const ALL_OR_NOTHING_VARS = new Set<string>(
  SITE_FEATURE_GROUPS.flatMap((group) => group.vars as readonly string[])
)

/**
 * Optional variables that are NOT part of any integration a wizard offers.
 *
 * Named rather than silently dropped: the manifest test asserts that every
 * optional key is either in a group or listed here, so a variable added to the
 * schema cannot quietly become invisible to the wizard. That is the failure
 * this module exists to prevent, one level up.
 */
export const UNGROUPED_OPTIONAL_VARS: readonly string[] = [
  // Convex writes this into .env.local itself, during `convex dev`.
  'CONVEX_DEPLOYMENT',
  'NEXT_PUBLIC_CONVEX_SITE_URL',
  // Derived from SITE_URL when unset; asking twice would invite them to differ.
  'BETTER_AUTH_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SITE_URL',
  'ADMIN_URL',
  // Fail-closed switches. An operator who needs one knows its name; offering
  // them in a wizard invites turning verification off to make a test pass.
  'AUTH_ALLOW_UNVERIFIED_EMAIL',
  'ADMIN_BOOTSTRAP_TOKEN',
  // Generated, not asked for — see GENERATORS in the wizard.
  'EMAIL_API_SECRET',
  // Only meaningful once a CDN fronts the bucket, which is a later decision.
  'AWS_S3_PUBLIC_BASE_URL',
  // Set per build by the deploy, not by hand.
  'NEXT_PUBLIC_SENTRY_ENVIRONMENT',
  'NEXT_PUBLIC_SENTRY_RELEASE',
  'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  // Declared so an operator can discover they exist; both default sensibly.
  'CONTACT_EMAIL',
  'NEXT_PUBLIC_BID_SUPPORT_EMAIL',
]

const GROUP_DECLARATIONS: readonly Omit<EnvManifestGroup, 'requiredTogether'>[] = [
  {
    // The bucket, the region and the two credentials are REQUIRED, so they are
    // asked for before any of this; what is left here is the optional shape of
    // the sender.
    feature: 'AWS SES — options d\'envoi (nom, reply-to, configuration set)',
    tier: 'site',
    vars: [
      'AWS_SES_FROM_NAME',
      'AWS_SES_REPLY_TO_EMAIL',
      'AWS_SES_CONFIGURATION_SET',
    ],
  },
  {
    feature: 'Stripe (paiement CB)',
    tier: 'site',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    feature: 'PayPal',
    tier: 'site',
    vars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_SANDBOX_MODE'],
  },
  {
    feature: 'SumUp',
    tier: 'site',
    vars: ['SUMUP_CLIENT_ID', 'SUMUP_CLIENT_SECRET'],
  },
  {
    feature: 'Uber Eats',
    tier: 'package',
    vars: [
      'UBER_EATS_CLIENT_ID',
      'UBER_EATS_CLIENT_SECRET',
      'UBER_EATS_WEBHOOK_SECRET',
      'UBER_EATS_SANDBOX_MODE',
    ],
  },
  {
    // Rides on the Uber Eats credentials; only the webhook secret can differ,
    // and it falls back to the Uber Eats one when unset.
    feature: 'Uber Direct (livraison)',
    tier: 'package',
    vars: ['UBER_DIRECT_WEBHOOK_SECRET'],
  },
  {
    feature: 'Deliveroo',
    tier: 'package',
    vars: [
      'DELIVEROO_CLIENT_ID',
      'DELIVEROO_CLIENT_SECRET',
      'DELIVEROO_WEBHOOK_SECRET',
      'DELIVEROO_BRAND_ID',
      'DELIVEROO_SITE_ID',
      'DELIVEROO_IS_SANDBOX',
    ],
  },
  {
    feature: 'Google Maps (adresses)',
    tier: 'site',
    vars: ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'],
  },
  {
    // The DSN alone is a COMPLETE configuration: errors are reported, only the
    // stack traces stay minified. It stays in its own group for that reason —
    // folding it in with the three upload keys would make a working install
    // report as half-configured.
    feature: 'Sentry (monitoring) — 1 projet par client',
    tier: 'site',
    vars: ['NEXT_PUBLIC_SENTRY_DSN'],
  },
  {
    feature: 'Sentry source maps — traces lisibles en production',
    tier: 'site',
    vars: ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'],
  },
  {
    feature: 'Unsplash (médias CMS)',
    tier: 'site',
    vars: ['UNSPLASH_ACCESS_KEY'],
  },
  {
    // BeYours' own billing, not the restaurant's. Set on the deployment that
    // sells the maintenance renewal.
    feature: 'BeYours billing (renouvellement de maintenance)',
    tier: 'site',
    vars: [
      'STRIPE_BID_SECRET_KEY',
      'STRIPE_BID_WEBHOOK_SECRET',
      'STRIPE_BID_PRICE_MAINTENANCE',
      'BID_APP_URL',
      'BID_NOTIFY_EMAIL',
    ],
  },
]

/**
 * Variables the Convex isolate reads from its own `process.env`.
 *
 * Measured, not guessed: this is the union of every `process.env.X` in
 * `apps/*\/convex/**` and in the packages those functions import. The test
 * beside this file pins each name to one of the two schemas so a rename cannot
 * leave a dangling entry, but nothing can tell from here whether a Convex
 * function has STOPPED reading one — that stays a human check.
 */
const CONVEX_KEYS: readonly string[] = [
  // Auth and crypto
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'SITE_URL',
  'CONVEX_SITE_URL',
  'ENCRYPTION_KEY',
  'AUTH_ALLOW_UNVERIFIED_EMAIL',
  'ADMIN_BOOTSTRAP_TOKEN',
  'NEXT_PUBLIC_APP_URL',
  // The mail relay's own credential, and the fallback it replaces.
  'EMAIL_API_SECRET',
  // AWS — the client's own account
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_PUBLIC_BASE_URL',
  'AWS_SES_FROM_EMAIL',
  'AWS_SES_FROM_NAME',
  'AWS_SES_REPLY_TO_EMAIL',
  'AWS_SES_CONFIGURATION_SET',
  // Translation
  'OPENAI_API_KEY',
  // Payments
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_SANDBOX_MODE',
  'SUMUP_CLIENT_ID',
  'SUMUP_CLIENT_SECRET',
  // Delivery platforms
  'UBER_EATS_CLIENT_ID',
  'UBER_EATS_CLIENT_SECRET',
  'UBER_EATS_WEBHOOK_SECRET',
  'UBER_EATS_SANDBOX_MODE',
  'UBER_DIRECT_WEBHOOK_SECRET',
  'DELIVEROO_CLIENT_ID',
  'DELIVEROO_CLIENT_SECRET',
  'DELIVEROO_WEBHOOK_SECRET',
  'DELIVEROO_BRAND_ID',
  'DELIVEROO_SITE_ID',
  'DELIVEROO_IS_SANDBOX',
  // CMS media search
  'UNSPLASH_ACCESS_KEY',
  // BeYours billing — the maintenance renewal runs in Convex
  'STRIPE_BID_SECRET_KEY',
  'STRIPE_BID_WEBHOOK_SECRET',
  'STRIPE_BID_PRICE_MAINTENANCE',
  'BID_APP_URL',
  'BID_NOTIFY_EMAIL',
]

/**
 * Whether a variable is required, asked of the schema itself.
 *
 * The `opt()` helper wraps a field in `.optional()`, so an optional field
 * accepts `undefined` and a required one does not. That single question is the
 * whole test — no second list of names to keep aligned, which is the mistake
 * this module exists to remove.
 */
function isRequiredField(field: unknown): boolean {
  const schema = field as { safeParse?: (v: unknown) => { success: boolean } }
  if (typeof schema?.safeParse !== 'function') return false
  return !schema.safeParse(undefined).success
}

/**
 * The lists, in a shape a script can consume.
 *
 * `required` is derived: whatever `packageEnvSchema` refuses to leave unset,
 * plus the whole of `siteEnvRequiredSchema` — which is required by
 * construction, that being what the schema is for. Retyping either list here
 * is precisely the mistake this module removes.
 */
export const envManifest: EnvManifest = {
  required: [
    ...Object.entries(packageEnvSchema.shape)
      .filter(([, field]) => isRequiredField(field))
      .map(([name]) => name),
    ...keysOf(siteEnvRequiredSchema),
  ],
  groups: GROUP_DECLARATIONS.map((group) => ({
    ...group,
    requiredTogether: group.vars.filter((name) => ALL_OR_NOTHING_VARS.has(name)),
  })),
  convexKeys: CONVEX_KEYS,
}

/**
 * The optional site tier, flattened — every variable that is neither required
 * nor in a group is expected to appear in `UNGROUPED_OPTIONAL_VARS`.
 *
 * Exported for the test, and for a generator writing `.env.example`.
 */
export const optionalSiteVars: readonly string[] = keysOf(siteEnvOptionalSchema)
