/**
 * Boot-time environment validation for apps/site (beyours.fr).
 *
 * This app depends on none of the engine packages, so it does not share
 * `@be-in-digital/core/env` — it has its own surface and its own rules here.
 * Dependency-free on purpose: no zod, nothing new in the bundle.
 *
 * ── What this can and cannot see ────────────────────────────────────────────
 * Only the NEXT.JS process env. The Stripe keys, the AWS credentials, the
 * e-mail provider and the four maintenance Price IDs live on the CONVEX
 * deployment (`npx convex env set …`), which this code never runs in. So they
 * are checked when present — true in local dev, where `.env.local` holds
 * everything — and never demanded. Only what the Next server genuinely needs
 * to serve a correct page is required.
 */

import { VAT } from './legal/company'

export type EnvTier = 'required' | 'format' | 'feature'

export interface EnvProblem {
  name: string
  message: string
  tier: EnvTier
}

/** The fallback in components/convex-provider.tsx. Reaching it means no backend. */
const PLACEHOLDER_CONVEX_URL = 'https://placeholder.convex.cloud'

type Check = (value: string) => string | null

const isUrl: Check = (v) => {
  try {
    const { protocol } = new URL(v)
    return protocol === 'http:' || protocol === 'https:' ? null : 'doit être une URL http(s)'
  } catch {
    return 'doit être une URL absolue (https://…)'
  }
}

const isEmail: Check = (v) => (/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(v) ? null : 'doit être une adresse e-mail')

const isBool: Check = (v) => (v === 'true' || v === 'false' ? null : 'doit valoir "true" ou "false"')

const startsWith =
  (prefix: string): Check =>
  (v) =>
    v.startsWith(prefix) ? null : `doit commencer par "${prefix}"`

const isOneOf =
  (...allowed: string[]): Check =>
  (v) =>
    allowed.includes(v) ? null : `doit valoir ${allowed.map((a) => `"${a}"`).join(' ou ')}`

/**
 * What the Next server cannot serve a correct page without.
 *
 * Both have a fallback at their read site, and that is the problem: unset,
 * `NEXT_PUBLIC_CONVEX_URL` silently points the whole site at a placeholder
 * deployment, and `NEXT_PUBLIC_SITE_URL` gets beyours.fr baked into a preview
 * or staging build's canonical links and e-mail logos.
 */
const REQUIRED: { name: string; check: Check }[] = [
  {
    name: 'NEXT_PUBLIC_CONVEX_URL',
    check: (v) =>
      v === PLACEHOLDER_CONVEX_URL
        ? 'vaut encore le placeholder — aucun backend ne répondra'
        : isUrl(v),
  },
  { name: 'NEXT_PUBLIC_SITE_URL', check: isUrl },
]

/** The four maintenance Price IDs. `convex/stripe.ts` throws on any one missing. */
const MAINTENANCE_PRICES = [
  'STRIPE_PRICE_ESSENTIELLE_MONTHLY',
  'STRIPE_PRICE_ESSENTIELLE_YEARLY',
  'STRIPE_PRICE_PREMIUM_MONTHLY',
  'STRIPE_PRICE_PREMIUM_YEARLY',
]

/**
 * The persistent creation Products the founders coupon and every targeted
 * referral discount are restricted to (`applies_to`).
 *
 * The plan → env-name mapping lives in `CREATION_PRODUCT_ENV`
 * (convex/stripe.ts:65-68); these two lists must name the same variables.
 */
const CREATION_PRODUCTS = [
  'STRIPE_PRODUCT_CREATION_ESSENTIELLE',
  'STRIPE_PRODUCT_CREATION_PREMIUM',
]

/** Checked only when set — most of these are Convex-side in production. */
const OPTIONAL: { name: string; check: Check }[] = [
  { name: 'NEXT_PUBLIC_CONVEX_SITE_URL', check: isUrl },
  { name: 'CONVEX_SITE_URL', check: isUrl },
  { name: 'SITE_URL', check: isUrl },
  { name: 'NEXT_PUBLIC_TVA_ENABLED', check: isBool },
  { name: 'STRIPE_TAX_ENABLED', check: isBool },
  { name: 'STRIPE_SECRET_KEY', check: startsWith('sk_') },
  /* Turns the no-payment checkout path on. Only "true" enables it; anything
     else refuses the sale rather than completing it for free — see
     convex/stripeMode.ts. Never set on a deployment that sells. */
  { name: 'BEYOURS_TEST_CHECKOUT', check: isBool },
  { name: 'STRIPE_WEBHOOK_SECRET', check: startsWith('whsec_') },
  // Connect-scoped endpoint: its own endpoint, so its own secret.
  { name: 'STRIPE_CONNECT_WEBHOOK_SECRET', check: startsWith('whsec_') },
  /* No prefix check: a coupon id is whatever the account owner typed into the
     dashboard (the runbook recommends a readable one), not a generated `co_`. */
  { name: 'STRIPE_FOUNDERS_COUPON_ID', check: () => null },
  /* Stripe object ids carry their type in the prefix, and these two families
     sit next to each other in every checklist and every `convex env set` run.
     A Price pasted into a Product var is accepted right up to `applies_to`,
     which then matches nothing: the founders discount spreads pro rata over
     the maintenance line instead of zeroing the creation one. */
  ...CREATION_PRODUCTS.map((name) => ({ name, check: startsWith('prod_') })),
  ...MAINTENANCE_PRICES.map((name) => ({ name, check: startsWith('price_') })),
  { name: 'EMAIL_PROVIDER', check: isOneOf('ses', 'resend') },
  { name: 'EMAIL_FROM', check: isEmail },
  { name: 'RESEND_FROM_EMAIL', check: isEmail },
  { name: 'AWS_SES_FROM_EMAIL', check: isEmail },
  { name: 'CONTACT_EMAIL', check: isEmail },
  { name: 'BID_NOTIFY_EMAIL', check: isEmail },
  { name: 'BOOKING_URL', check: isUrl },
  { name: 'CALENDLY_URL', check: isUrl },
  { name: 'LIVE_URL', check: isUrl },
]

/** All-or-nothing groups: half of one of these is worse than none of it. */
const FEATURE_GROUPS: { feature: string; vars: string[] }[] = [
  {
    feature: 'Stripe',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
  {
    // A sale that reaches checkout with one of these unset is debited and
    // never provisioned — convex/stripe.ts throws mid-session.
    feature: 'Prix de maintenance Stripe',
    vars: MAINTENANCE_PRICES,
  },
  {
    /* resolveFoundersPricing (convex/foundersOffer.ts:71-84) needs BOTH: the
       coupon enforces the 10-slot cap through max_redemptions, and the product
       is what that coupon is restricted to. On a deployment holding a Stripe
       key, either one missing throws FoundersOfferUnavailableError mid-checkout
       — the first founders sale is refused in front of the customer instead of
       being reported here, at boot, while it is still cheap to fix.
       ESSENTIELLE is named literally because it is `foundersOffer.plan`; the
       test suite pins the two together so a change of plan cannot pass. */
    feature: 'Offre fondateurs',
    vars: ['STRIPE_FOUNDERS_COUPON_ID', 'STRIPE_PRODUCT_CREATION_ESSENTIELLE'],
  },
  {
    /* Not blocking on its own — an ordinary sale still completes. What half of
       this pair costs is the split on the invoice: a discount with no product
       to point at spreads pro rata over every line, billing an amortizable
       investment and a deductible charge in the wrong proportions. */
    feature: 'Produits de création Stripe',
    vars: CREATION_PRODUCTS,
  },
]

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== ''

/**
 * Validate the Next process env. Never throws — the caller decides.
 */
export function validateSiteEnv(
  source: Record<string, string | undefined> = process.env
): { ok: boolean; problems: EnvProblem[] } {
  const problems: EnvProblem[] = []

  for (const { name, check } of REQUIRED) {
    const value = source[name]
    if (!isSet(value)) {
      problems.push({ name, message: 'non définie', tier: 'required' })
      continue
    }
    const failure = check(value)
    if (failure) problems.push({ name, message: failure, tier: 'required' })
  }

  for (const { name, check } of OPTIONAL) {
    const value = source[name]
    if (!isSet(value)) continue
    const failure = check(value)
    if (failure) problems.push({ name, message: failure, tier: 'format' })
  }

  for (const { feature, vars } of FEATURE_GROUPS) {
    const set = vars.filter((name) => isSet(source[name]))
    if (set.length === 0 || set.length === vars.length) continue

    for (const name of vars) {
      if (isSet(source[name])) continue
      problems.push({
        name,
        message: `requise dès que ${feature} est configuré (${set.length}/${vars.length} déjà posée(s))`,
        tier: 'feature',
      })
    }
  }

  // The storefront reads NEXT_PUBLIC_TVA_ENABLED and Stripe reads
  // STRIPE_TAX_ENABLED, but neither of them decides anything: the regime
  // declared in lib/legal/company.ts does. Both flags are measured against it
  // rather than against each other, because agreeing with each other and being
  // wrong together is exactly the state this is here to catch — a company on
  // the régime réel charging no VAT still owes it, and every invoice it issues
  // in the meantime is wrong.
  //
  // Checked only where visible: in production STRIPE_TAX_ENABLED lives on the
  // Convex deployment, so a one-sided Next env is normal, not an error.
  const chargingExpected = VAT.regime === 'reel'
  const expected = String(chargingExpected)
  const regimeLabel = chargingExpected
    ? 'régime réel (TVA due)'
    : 'franchise en base (art. 293 B du CGI)'

  for (const name of ['NEXT_PUBLIC_TVA_ENABLED', 'STRIPE_TAX_ENABLED']) {
    const value = source[name]
    if (!isSet(value) || value === expected) continue
    problems.push({
      name,
      message:
        `vaut "${value}" alors que VAT.regime déclare ${regimeLabel} ` +
        `(lib/legal/company.ts) — les factures émises seraient incohérentes ; ` +
        `attendu "${expected}", et les deux drapeaux vont ensemble`,
      tier: 'feature',
    })
  }

  const emailProvider = source.EMAIL_PROVIDER
  if (emailProvider === 'resend' && !isSet(source.RESEND_API_KEY)) {
    problems.push({
      name: 'RESEND_API_KEY',
      message: 'requise avec EMAIL_PROVIDER="resend"',
      tier: 'feature',
    })
  }
  if (emailProvider === 'ses') {
    for (const name of ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
      if (!isSet(source[name])) {
        problems.push({
          name,
          message: 'requise avec EMAIL_PROVIDER="ses"',
          tier: 'feature',
        })
      }
    }
  }

  return { ok: problems.length === 0, problems }
}

const SECTIONS: { tier: EnvTier; title: string }[] = [
  { tier: 'required', title: '── Requises (serveur Next) ──' },
  { tier: 'format', title: '── Format invalide ──' },
  { tier: 'feature', title: '── Fonctionnalité configurée à moitié ──' },
]

/** Format the problems for the boot log. */
export function formatSiteEnvReport(problems: EnvProblem[]): string {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    "║   apps/site — VARIABLES D'ENVIRONNEMENT À CORRIGER          ║",
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ]

  for (const { tier, title } of SECTIONS) {
    const vars = problems.filter((p) => p.tier === tier)
    if (vars.length === 0) continue

    lines.push(`  ${title}`)
    for (const p of vars) lines.push(`    ✗ ${p.name}: ${p.message}`)
    lines.push('')
  }

  lines.push(`  Total: ${problems.length} variable(s) à corriger`)
  lines.push('  → Voir apps/site/.env.example (et .env.production.example pour la prod).')
  lines.push(
    '  → Les clés Stripe / AWS / e-mail vivent sur le déploiement CONVEX, pas sur Vercel.'
  )
  lines.push('')

  return lines.join('\n')
}
