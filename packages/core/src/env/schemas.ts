import { z } from 'zod'

/**
 * Optional field: an empty string means "not set".
 *
 * `.env.example` ships every key with an empty value, so a template copied and
 * left unfilled arrives here as `''`. For an OPTIONAL variable that genuinely
 * means "unset" and must pass. For a REQUIRED one it must not — which is why
 * the required tier below never routes through this helper.
 */
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional())

/**
 * BeYours platform-level env vars.
 * Shared across all restaurant deployments.
 * Owned by BeYours's AWS/API accounts.
 */
export const packageEnvSchema = z.object({
  // AWS used to live here, as one fleet-wide account. It is a SITE variable
  // now — every client owns its AWS account, so its bucket and its sender go
  // with it when it leaves. See apps/docs/deployment/aws-ownership.md.

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
 * The seven variables a restaurant deployment cannot run without.
 *
 * Each one, left unset, used to surface as a feature quietly not working in
 * front of the restaurant owner rather than as a failed deploy:
 *
 * | Variable                 | Silent failure it used to cause                 |
 * |--------------------------|-------------------------------------------------|
 * | NEXT_PUBLIC_CONVEX_URL   | no backend — every query hangs                  |
 * | CONVEX_SITE_URL          | webhook + OAuth callback URLs point nowhere     |
 * | SITE_URL                 | password reset returns early, mail never sent   |
 * | BETTER_AUTH_SECRET       | same early return; sessions unsignable          |
 * | ENCRYPTION_KEY           | OAuth tokens cannot be stored at rest           |
 * | AWS_S3_BUCKET_NAME       | no upload target                                |
 * | AWS_SES_FROM_EMAIL       | no transactional mail leaves the deployment     |
 *
 * `AWS_S3_PUBLIC_BASE_URL` is NOT among them, though the audit that prompted
 * this listed it: since the private-bucket decision it names an optional CDN,
 * and unset means the app serves media through its own /api/files proxy — a
 * supported configuration, not a broken one. Requiring it would force a CDN on
 * every fresh deployment.
 *
 * These are declared WITHOUT `opt()` on purpose: `z.string().min(1)`,
 * `.url()` and `.email()` all reject `''`, so a `.env` copied from the
 * template and left unfilled fails here instead of at the client.
 */
const siteRequiredShape = {
  // Convex — the backend itself
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  CONVEX_SITE_URL: z.string().url(),

  // Auth
  SITE_URL: z.string().url(),
  // Better Auth signs sessions with this. 32 chars is the floor for the
  // `openssl rand -base64 32` the template tells operators to run.
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'Must be at least 32 characters — generate with: openssl rand -base64 32'),
  ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'Must be a 64-character hex string (32 bytes) — generate with: openssl rand -hex 32'
    ),

  // AWS credentials, for the restaurant's OWN account. They were package-level
  // — one fleet-wide key shipped to every deployment — until 2026-08-28, which
  // meant any client's backend could reach every other client's media, and an
  // offboarded one kept working credentials. One account per client makes that
  // structural: see apps/docs/deployment/aws-ownership.md.
  // Still required, and still without `opt()`: the tier changed, not whether a
  // deployment can boot without them.
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  // AWS S3 (per-restaurant bucket). Required even though the bucket is
  // private: the app's own /api/files proxy reads from it, so without a bucket
  // there is nowhere to upload to and nothing to serve.
  AWS_S3_BUCKET_NAME: z.string().min(1),

  // AWS SES (per-restaurant sending domain)
  AWS_SES_FROM_EMAIL: z.string().email(),
} as const

/**
 * Everything a deployment can legitimately run without.
 * Sorted by the feature it belongs to; see `SITE_FEATURE_GROUPS` for the
 * all-or-nothing rules that apply once a feature is switched on at all.
 */
const siteOptionalShape = {
  // Convex
  CONVEX_DEPLOYMENT: opt(z.string().min(1)),
  // Client-side twin of CONVEX_SITE_URL, must stay on the same subdomain.
  NEXT_PUBLIC_CONVEX_SITE_URL: opt(z.string().url()),

  // Auth
  BETTER_AUTH_URL: opt(z.string().url()),
  // Fails CLOSED: verification is relaxed only on an explicit "true".
  // Declared so an operator can discover it exists at all.
  AUTH_ALLOW_UNVERIFIED_EMAIL: opt(z.enum(['true', 'false'])),
  // Claims the FIRST super-admin seat on a fresh deployment. Also fails
  // closed: unset refuses everyone. Set it on the CONVEX deployment.
  ADMIN_BOOTSTRAP_TOKEN: opt(z.string().min(1)),
  // Dedicated credential for POST /api/email/send, separating the mail relay
  // from the session-signing key. Optional only while deployments migrate:
  // unset, the route falls back to BETTER_AUTH_SECRET. Set it on BOTH the
  // Next.js env and the Convex deployment — the route authenticates with it
  // and convex/auth.ts presents it.
  EMAIL_API_SECRET: opt(
    z.string().min(32, 'Must be at least 32 characters — generate with: openssl rand -base64 32')
  ),

  /*
    Which SNS topic `/webhooks/ses` accepts, as a full ARN — comma-separated
    for the rare deployment with more than one.

    WHY IT EXISTS. The webhook verified Amazon's RSA signature and stopped
    there. That proves AMAZON sent the message; it does not prove OUR topic
    did, because every SNS topic in every AWS account is signed by the same
    infrastructure with a certificate on the same hosts. And the endpoint
    confirmed any subscription whose `SubscribeURL` was on an Amazon host, so
    an attacker pointed their own topic at it and it subscribed itself — after
    which their messages carried a genuine signature and could mark any
    subscriber bounced or complained.

    Unset, the endpoint REFUSES: it confirms no subscription and it accepts no
    notification, logging `topic_not_configured` and the ARN it saw, which is
    the value to paste here. It used to accept notifications in that state, on
    the grounds that SNS delivers only to a confirmed subscription — but the
    endpoint is an HTTPS URL anyone can POST to, so an attacker publishes on
    their own topic and replays the JSON Amazon signed for them. Convex-side:
    the verifier reads it there.
  */
  SES_SNS_TOPIC_ARN: opt(z.string().min(1)),

  /*
    SES_SNS_ALLOW_ANY_TOPIC — the escape hatch back to the old behaviour, for a
    deployment that is mid-configuration and must keep recording bounces on a
    subscription an operator already confirmed. "true" and nothing else; it
    never lets the endpoint CONFIRM a subscription, which is the defect that
    made a forged topic self-service. A separate variable on purpose: restoring
    a fail-open should be something a person did, not a default nobody chose.
  */
  SES_SNS_ALLOW_ANY_TOPIC: opt(z.enum(['true', 'false'])),

  // AWS S3 media URLs. The bucket is private — see
  // apps/docs/deployment/s3-bucket-policy.md. Set this to the CDN that fronts
  // it (CloudFront with an origin access control); leave it unset and media is
  // served by the app's own /api/files proxy. Optional on purpose: a fresh
  // deployment renders its own images with no CDN and no DNS.
  AWS_S3_PUBLIC_BASE_URL: opt(z.string().url()),

  // App URLs
  NEXT_PUBLIC_APP_URL: opt(z.string().url()),
  // Canonical public URL for SEO metadata and the sitemap. Unset, the site is
  // indexed under whatever host Next guesses.
  NEXT_PUBLIC_SITE_URL: opt(z.string().url()),
  ADMIN_URL: opt(z.string().url()),

  // AWS SES (per-restaurant sending domain)
  AWS_SES_FROM_NAME: opt(z.string().min(1)),
  AWS_SES_REPLY_TO_EMAIL: opt(z.string().email()),
  AWS_SES_CONFIGURATION_SET: opt(z.string().min(1)),

  // Monitoring — one Sentry PROJECT per client, so a restaurant's errors, its
  // quota and its retention stay its own. See apps/docs/deployment/sentry.md.
  //
  // The DSN is the isolation. It is validated as a URL rather than as a DSN on
  // purpose: tightening a variable deployments already carry would turn a wrong
  // value into a refused boot. The shape is checked in `sentry/`, which
  // disables reporting and says so instead.
  NEXT_PUBLIC_SENTRY_DSN: opt(z.string().url()),
  // Overrides the environment events are filed under. Unset, `VERCEL_ENV`
  // already keeps a client's preview deploys out of its production issues.
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: opt(z.string().min(1)),
  // Pins the release. Unset, `VERCEL_GIT_COMMIT_SHA` is used — it must match
  // what the source maps were uploaded under or stack traces stay minified.
  NEXT_PUBLIC_SENTRY_RELEASE: opt(z.string().min(1)),
  // 0 to 1. Defaults to 0.1 in production: tracing every transaction spends a
  // restaurant's free-tier quota on a Saturday night, and Sentry then drops the
  // errors that mattered.
  // Kept a string rather than coerced: READER_RELAXED re-declares every newly
  // added field as a string, and a number here would make `SiteEnv` disagree
  // with what `getSiteEnv()` actually returns.
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: opt(
    z
      .string()
      .refine(
        (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1,
        'attendu : un nombre entre 0 et 1',
      ),
  ),

  // Which transport carries this deployment's email. SES when unset, so an
  // existing client does not move.
  //
  // It exists because every client owns its AWS account and files its own SES
  // production-access request, and approval is not guaranteed — one has been
  // refused. Such a deployment had no path to sending email at all until #212.
  // An unknown value is refused rather than silently falling back to SES: a
  // typo that kept sending through the provider the operator is trying to leave
  // is indistinguishable from a working migration.
  EMAIL_PROVIDER: opt(z.enum(['ses', 'resend'])),
  // Required once EMAIL_PROVIDER=resend, which the schema cannot express as an
  // all-or-nothing group (the rule is conditional, not symmetric).
  // `resolveEmailProvider` reports the incomplete case at send time instead.
  RESEND_API_KEY: opt(z.string().startsWith('re_')),
  // The sender verified at Resend. Falls back to AWS_SES_FROM_EMAIL, so an
  // operator who flips the switch and changes nothing else keeps sending from
  // the address they already verified.
  RESEND_FROM_EMAIL: opt(z.string().email()),
  // The Svix signing secret for `/webhooks/resend`, from the Resend dashboard.
  //
  // Set on the CONVEX deployment — the handler reads it there, the same way
  // SES_SNS_TOPIC_ARN is read by `/webhooks/ses`. Without it that route
  // REFUSES every delivery (401) rather than processing an unverified body:
  // the handler marks subscribers bounced and complained from ids and
  // addresses in the payload, so accepting an unsigned one would let anybody
  // suppress mail to a real customer.
  //
  // A Resend deployment WITHOUT this variable has no feedback path at all —
  // dead addresses are re-mailed on every campaign and a spam report is never
  // recorded — which is the state every Resend client shipped in before #444.
  RESEND_WEBHOOK_SECRET: opt(z.string().min(1)),

  // Sentry source-map upload (build time) — all three or none, see
  // SITE_FEATURE_GROUPS. The token is a secret and belongs on the build host,
  // never in a NEXT_PUBLIC_ variable.
  SENTRY_ORG: opt(z.string().min(1)),
  SENTRY_PROJECT: opt(z.string().min(1)),
  SENTRY_AUTH_TOKEN: opt(z.string().min(1)),

  // Maps (key per client)
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: opt(z.string().min(1)),

  // Stripe (per restaurant) — all three or none, see SITE_FEATURE_GROUPS
  STRIPE_SECRET_KEY: opt(z.string().startsWith('sk_')),
  // Declared for the setup wizard and the templates; no runtime read yet.
  STRIPE_PUBLISHABLE_KEY: opt(z.string().startsWith('pk_')),
  STRIPE_WEBHOOK_SECRET: opt(z.string().startsWith('whsec_')),

  // PayPal (per restaurant)
  PAYPAL_CLIENT_ID: opt(z.string().min(1)),
  PAYPAL_CLIENT_SECRET: opt(z.string().min(1)),
  // Sandbox flag. Declared optional HERE so a value already sitting in a
  // deployment is never rejected by the reader, and required by
  // `checkSandboxFlags()` at boot as soon as PayPal is configured at all.
  // Unset at runtime resolves to SANDBOX, never to production — env/sandbox.ts.
  PAYPAL_SANDBOX_MODE: opt(z.enum(['true', 'false'])),

  // SumUp (per restaurant)
  SUMUP_CLIENT_ID: opt(z.string().min(1)),
  SUMUP_CLIENT_SECRET: opt(z.string().min(1)),

  // Uber Eats site-level config. Required once the Uber Eats credentials are
  // set — see `checkSandboxFlags()`; unset at runtime means SANDBOX.
  UBER_EATS_SANDBOX_MODE: opt(z.enum(['true', 'false'])),

  // Deliveroo site-level config. The brand/site ids are e2e fixtures — a
  // live deployment reads them from its stored Deliveroo connection.
  DELIVEROO_BRAND_ID: opt(z.string().min(1)),
  DELIVEROO_SITE_ID: opt(z.string().min(1)),
  // Required once the Deliveroo credentials are set — see
  // `checkSandboxFlags()`; unset at runtime means SANDBOX.
  DELIVEROO_IS_SANDBOX: opt(z.enum(['true', 'false'])),

  // CMS media
  UNSPLASH_ACCESS_KEY: opt(z.string().min(1)),

  // BeYours billing (Stripe BID) — BeYours invoicing the restaurant owner.
  // Lives on the CONVEX deployment, not on Vercel.
  STRIPE_BID_SECRET_KEY: opt(z.string().startsWith('sk_')),
  STRIPE_BID_WEBHOOK_SECRET: opt(z.string().startsWith('whsec_')),
  STRIPE_BID_PRICE_MAINTENANCE: opt(z.string().min(1)),
  // The six Auto Blog plan prices, monthly and annual. `bidSubscription.ts`
  // reads all six from `process.env` — checkout resolves a plan to a price,
  // the webhook resolves a price back to a plan — and none of them was
  // declared anywhere until 07/09/2026, which is why the paid tier could not
  // be provisioned by following the documentation.
  //
  // Declared, not grouped: `SITE_FEATURE_GROUPS` would refuse to boot a
  // deployment holding some of them, and a missing one breaks only its own
  // plan's checkout. The .env examples say "all six or none"; boot does not
  // enforce it, on purpose.
  STRIPE_BID_PRICE_STARTER: opt(z.string().min(1)),
  STRIPE_BID_PRICE_PRO: opt(z.string().min(1)),
  STRIPE_BID_PRICE_ENTERPRISE: opt(z.string().min(1)),
  STRIPE_BID_PRICE_STARTER_ANNUAL: opt(z.string().min(1)),
  STRIPE_BID_PRICE_PRO_ANNUAL: opt(z.string().min(1)),
  STRIPE_BID_PRICE_ENTERPRISE_ANNUAL: opt(z.string().min(1)),
  // Absolute app URL used to build checkout redirect and customer-email links.
  BID_APP_URL: opt(z.string().url()),
  BID_NOTIFY_EMAIL: opt(z.string().email()),

  // Contact
  CONTACT_EMAIL: opt(z.string().email()),
  NEXT_PUBLIC_BID_SUPPORT_EMAIL: opt(z.string().email()),
} as const

/**
 * Features that are all-or-nothing.
 *
 * Half a payment provider is worse than none: the admin offers the method, the
 * customer picks it, and the charge fails at the till. Once ANY variable in a
 * group is set the whole group is required.
 */
export const SITE_FEATURE_GROUPS: {
  feature: string
  vars: readonly (keyof typeof siteOptionalShape)[]
}[] = [
  {
    // STRIPE_PUBLISHABLE_KEY is deliberately absent: no line of the product
    // reads it today, so demanding it would gate a deploy on a value nothing
    // consumes. The secret key and the webhook secret are the real pair —
    // charging without verifying the webhook loses order confirmations.
    feature: 'Stripe (restaurant payments)',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    feature: 'PayPal (restaurant payments)',
    vars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  },
  {
    feature: 'SumUp (restaurant payments)',
    vars: ['SUMUP_CLIENT_ID', 'SUMUP_CLIENT_SECRET'],
  },
  {
    feature: 'BeYours billing (maintenance renewal)',
    vars: ['STRIPE_BID_SECRET_KEY', 'STRIPE_BID_WEBHOOK_SECRET', 'BID_APP_URL'],
  },
  {
    // Half of this uploads nothing, and the deployment reports errors as
    // minified stack traces — `a.b is not a function` at `page-4f2c.js:1`,
    // against a build nobody can reproduce. The DSN is deliberately NOT in the
    // group: a DSN on its own is a complete, working configuration.
    feature: 'Sentry source maps (readable stack traces)',
    vars: ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'],
  },
]

/** Adds "you configured half of X" issues to whichever schema carries it. */
const checkFeatureGroups = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx
): void => {
  for (const { feature, vars } of SITE_FEATURE_GROUPS) {
    const set = vars.filter((name) => value[name] !== undefined)
    if (set.length === 0 || set.length === vars.length) continue

    for (const name of vars) {
      if (value[name] !== undefined) continue
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: `requise dès que ${feature} est configuré (${set.join(', ')} déjà posée${
          set.length === 1 ? '' : 's'
        })`,
      })
    }
  }
}

/**
 * Strict tier — what a deployment must have to boot.
 * Used by `validateAllEnv()` at startup, never by the runtime getters.
 */
export const siteEnvRequiredSchema = z.object(siteRequiredShape)

/**
 * Feature-gated tier — optional, but internally consistent.
 * Used by `validateAllEnv()` at startup, never by the runtime getters.
 */
export const siteEnvOptionalSchema = z
  .object(siteOptionalShape)
  .superRefine(checkFeatureGroups)

/**
 * Fields the READER checks less strictly than boot does.
 *
 * `getSiteEnv()` parses the whole of `process.env`, so every validator in the
 * reader is a way for an unrelated code path — a Stripe charge, a kitchen
 * ticket — to throw on a variable it never reads. Newly declaring a variable
 * must not create that hazard for values already sitting in deployments.
 *
 * So format is enforced once, at boot, and the reader only asks "is there
 * something there". Only two kinds of field belong here: those this change
 * newly declares, and `BETTER_AUTH_SECRET`, whose floor this change raised
 * from 1 to 32. Relaxing anything else would loosen a check that deployed
 * sites already pass.
 */
const READER_RELAXED = new Set<string>([
  'BETTER_AUTH_SECRET',
  'EMAIL_API_SECRET',
  'AWS_S3_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_CONVEX_SITE_URL',
  'AUTH_ALLOW_UNVERIFIED_EMAIL',
  'ADMIN_BOOTSTRAP_TOKEN',
  'NEXT_PUBLIC_SITE_URL',
  'UNSPLASH_ACCESS_KEY',
  'STRIPE_BID_SECRET_KEY',
  'STRIPE_BID_WEBHOOK_SECRET',
  'STRIPE_BID_PRICE_MAINTENANCE',
  'BID_APP_URL',
  'BID_NOTIFY_EMAIL',
  'CONTACT_EMAIL',
  'NEXT_PUBLIC_BID_SUPPORT_EMAIL',
  'NEXT_PUBLIC_SENTRY_ENVIRONMENT',
  'NEXT_PUBLIC_SENTRY_RELEASE',
  'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
])

const readerShape = Object.fromEntries(
  [...Object.entries(siteRequiredShape), ...Object.entries(siteOptionalShape)].map(
    ([name, schema]) => [
      name,
      READER_RELAXED.has(name)
        ? opt(z.string().min(1))
        : // Already-optional fields carry their own `opt()`; required ones need it.
          name in siteRequiredShape
          ? opt(schema as z.ZodType)
          : schema,
    ]
  )
)

/**
 * Lenient reader over BOTH tiers — every field optional.
 *
 * This is what `getSiteEnv()` parses, and it stays permissive on purpose. The
 * getters run inside Convex actions, where the deployment holds its own subset
 * of the variables (`ENCRYPTION_KEY` yes, `NEXT_PUBLIC_CONVEX_URL` no).
 * Throwing there would turn a boot-time configuration problem into a failed
 * customer order. Boot-time enforcement belongs to the two schemas above.
 */
export const siteEnvSchema = z.object(readerShape) as z.ZodObject<
  {
    [K in keyof typeof siteRequiredShape]: ReturnType<
      typeof opt<(typeof siteRequiredShape)[K]>
    >
  } & typeof siteOptionalShape
>

export type PackageEnv = z.infer<typeof packageEnvSchema>
export type SiteEnv = z.infer<typeof siteEnvSchema>
export type SiteEnvRequired = z.infer<typeof siteEnvRequiredSchema>
