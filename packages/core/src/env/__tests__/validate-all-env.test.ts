import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateAllEnv, formatEnvReport, _resetEnvCache } from '../getters'

const VALID_PACKAGE_ENV = {
  OPENAI_API_KEY: 'sk-test123456',
}

/** The ten a restaurant deployment cannot boot without. */
const VALID_SITE_ENV = {
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
  CONVEX_SITE_URL: 'https://test.convex.site',
  SITE_URL: 'https://resto.example.com',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'a'.repeat(64),
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  AWS_S3_BUCKET_NAME: 'resto-bucket',
  AWS_SES_FROM_EMAIL: 'noreply@resto.example.com',
}

const VALID_ENV = { ...VALID_PACKAGE_ENV, ...VALID_SITE_ENV }

/** Env is process-wide; every test starts from a clean slate. */
function setEnv(vars: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) delete process.env[key]
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value
  }
}

describe('validateAllEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    _resetEnvCache()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    _resetEnvCache()
  })

  it('returns ok=true when every required var is set', () => {
    setEnv(VALID_ENV)
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(true)
    expect(missing).toHaveLength(0)
  })

  // The bug this schema split exists to fix: a deployment with only the four
  // BeYours platform vars used to boot printing "validated successfully", then
  // fail at the restaurant one feature at a time.
  it('refuses a deployment carrying only the package vars', () => {
    setEnv(VALID_PACKAGE_ENV)
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)

    for (const name of Object.keys(VALID_SITE_ENV)) {
      expect(missing.some((m) => m.name === name && m.tier === 'site')).toBe(true)
    }
  })

  it('refuses a .env.example copied and left unfilled', () => {
    setEnv({
      ...VALID_PACKAGE_ENV,
      ...Object.fromEntries(Object.keys(VALID_SITE_ENV).map((name) => [name, ''])),
    })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.filter((m) => m.tier === 'site')).toHaveLength(
      Object.keys(VALID_SITE_ENV).length
    )
  })

  it('reports an unset variable as "non définie", not as a type error', () => {
    setEnv({ ...VALID_ENV, AWS_S3_BUCKET_NAME: undefined })
    const { missing } = validateAllEnv()
    expect(missing.find((m) => m.name === 'AWS_S3_BUCKET_NAME')?.message).toBe(
      'non définie'
    )
  })

  it('keeps the format hint for a variable that IS set but malformed', () => {
    setEnv({ ...VALID_ENV, ENCRYPTION_KEY: 'too-short' })
    const { missing } = validateAllEnv()
    expect(missing.find((m) => m.name === 'ENCRYPTION_KEY')?.message).toContain(
      'openssl rand -hex 32'
    )
  })

  it('rejects a BETTER_AUTH_SECRET under 32 characters', () => {
    setEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: 'short' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'BETTER_AUTH_SECRET')).toBe(true)
  })

  it('reports a missing AWS_REGION against the SITE tier, not the package one', () => {
    setEnv({ ...VALID_ENV, AWS_REGION: undefined })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    // Still fatal at boot — only the tier changed (2026-08-28, one AWS
    // account per client). Reporting it as 'package' would send an operator
    // looking in the fleet's credentials instead of their own.
    expect(missing.some((m) => m.name === 'AWS_REGION' && m.tier === 'site')).toBe(true)
    expect(missing.some((m) => m.tier === 'package')).toBe(false)
  })

  it('returns missing for OPENAI_API_KEY with wrong prefix', () => {
    setEnv({ ...VALID_ENV, OPENAI_API_KEY: 'bad-key' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'OPENAI_API_KEY' && m.tier === 'package')).toBe(
      true
    )
  })

  it('reports site-level errors when an invalid URL is provided', () => {
    setEnv({ ...VALID_ENV, NEXT_PUBLIC_CONVEX_URL: 'not-a-url' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(
      missing.some((m) => m.name === 'NEXT_PUBLIC_CONVEX_URL' && m.tier === 'site')
    ).toBe(true)
  })

  it('ignores empty strings on genuinely optional vars', () => {
    setEnv({ ...VALID_ENV, NEXT_PUBLIC_SENTRY_DSN: '', AWS_SES_FROM_NAME: '' })
    expect(validateAllEnv().ok).toBe(true)
  })
})

describe('validateAllEnv — feature groups', () => {
  const originalEnv = process.env

  beforeEach(() => {
    _resetEnvCache()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    _resetEnvCache()
  })

  it('accepts a feature left entirely unconfigured', () => {
    setEnv(VALID_ENV)
    expect(validateAllEnv().ok).toBe(true)
  })

  it('accepts a feature configured in full', () => {
    setEnv({
      ...VALID_ENV,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  // Half a payment provider is worse than none: the admin offers the method,
  // the customer picks it, and the charge fails at the till.
  it('rejects a half-configured Stripe and names the gap', () => {
    setEnv({ ...VALID_ENV, STRIPE_SECRET_KEY: 'sk_test_123' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)

    const webhook = missing.find((m) => m.name === 'STRIPE_WEBHOOK_SECRET')
    expect(webhook?.tier).toBe('feature')
    expect(webhook?.message).toContain('Stripe')
    expect(webhook?.message).toContain('STRIPE_SECRET_KEY')
  })

  it('rejects a PayPal client id with no secret', () => {
    setEnv({ ...VALID_ENV, PAYPAL_CLIENT_ID: 'paypal-id' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(
      missing.some((m) => m.name === 'PAYPAL_CLIENT_SECRET' && m.tier === 'feature')
    ).toBe(true)
  })

  it('leaves the e2e-only Deliveroo ids ungrouped', () => {
    setEnv({ ...VALID_ENV, DELIVEROO_BRAND_ID: 'brand-1' })
    expect(validateAllEnv().ok).toBe(true)
  })

  // Nothing reads the publishable key, so it must not gate a Stripe deploy.
  it('does not demand STRIPE_PUBLISHABLE_KEY alongside a configured Stripe', () => {
    setEnv({
      ...VALID_ENV,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  it('does not fire on an empty string, which means unconfigured', () => {
    setEnv({ ...VALID_ENV, SUMUP_CLIENT_ID: '', SUMUP_CLIENT_SECRET: '' })
    expect(validateAllEnv().ok).toBe(true)
  })

  // A DSN on its own is a complete Sentry setup: errors arrive, only the stack
  // traces stay minified. Demanding the upload trio here would gate every
  // client site on a build-host secret most of them will never have.
  it('accepts a Sentry DSN with no source-map upload configured', () => {
    setEnv({ ...VALID_ENV, NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.de.sentry.io/2' })
    expect(validateAllEnv().ok).toBe(true)
  })

  it('rejects half a source-map upload and names the gap', () => {
    setEnv({ ...VALID_ENV, SENTRY_ORG: 'beyours' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)

    const token = missing.find((m) => m.name === 'SENTRY_AUTH_TOKEN')
    expect(token?.tier).toBe('feature')
    expect(token?.message).toContain('Sentry')
    expect(token?.message).toContain('SENTRY_ORG')
    expect(missing.some((m) => m.name === 'SENTRY_PROJECT' && m.tier === 'feature')).toBe(true)
  })

  it('accepts a source-map upload configured in full', () => {
    setEnv({
      ...VALID_ENV,
      NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.de.sentry.io/2',
      SENTRY_ORG: 'beyours',
      SENTRY_PROJECT: 'pizzeria-napoli',
      SENTRY_AUTH_TOKEN: 'sntrys_token',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  it('rejects a traces sample rate that is not a rate', () => {
    setEnv({ ...VALID_ENV, NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '50%' })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE')).toBe(true)
  })

  it('accepts a traces sample rate inside 0..1', () => {
    setEnv({ ...VALID_ENV, NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0.25' })
    expect(validateAllEnv().ok).toBe(true)
  })
})

describe('formatEnvReport', () => {
  it('formats package-level missing vars', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'non définie', tier: 'package' },
    ])
    expect(report).toContain('AWS_REGION')
    expect(report).toContain('Package-level')
    expect(report).toContain('1 variable(s)')
  })

  it('formats site-level missing vars', () => {
    const report = formatEnvReport([
      { name: 'NEXT_PUBLIC_CONVEX_URL', message: 'Invalid url', tier: 'site' },
    ])
    expect(report).toContain('NEXT_PUBLIC_CONVEX_URL')
    expect(report).toContain('Site-level')
  })

  it('gives half-configured features their own section', () => {
    const report = formatEnvReport([
      { name: 'STRIPE_WEBHOOK_SECRET', message: 'Required once Stripe…', tier: 'feature' },
    ])
    expect(report).toContain('STRIPE_WEBHOOK_SECRET')
    expect(report).toContain('à moitié')
  })

  it('formats every tier together', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'non définie', tier: 'package' },
      { name: 'SITE_URL', message: 'non définie', tier: 'site' },
      { name: 'STRIPE_WEBHOOK_SECRET', message: 'Required once…', tier: 'feature' },
    ])
    expect(report).toContain('Package-level')
    expect(report).toContain('Site-level')
    expect(report).toContain('à moitié')
    expect(report).toContain('3 variable(s)')
  })

  it('includes the .env.example hint', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'non définie', tier: 'package' },
    ])
    expect(report).toContain('.env.example')
    expect(report).toContain('.env.local')
  })
})
