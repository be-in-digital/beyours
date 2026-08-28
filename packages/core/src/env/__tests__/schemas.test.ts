import { describe, it, expect } from 'vitest'
import {
  packageEnvSchema,
  siteEnvSchema,
  siteEnvRequiredSchema,
  siteEnvOptionalSchema,
  SITE_FEATURE_GROUPS,
} from '../schemas'

describe('packageEnvSchema', () => {
  const validPackageEnv = {
    AWS_REGION: 'eu-west-1',
    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    OPENAI_API_KEY: 'sk-test123456',
  }

  it('accepts valid required fields', () => {
    const result = packageEnvSchema.safeParse(validPackageEnv)
    expect(result.success).toBe(true)
  })

  it('accepts all optional integration fields', () => {
    const result = packageEnvSchema.safeParse({
      ...validPackageEnv,
      UBER_EATS_CLIENT_ID: 'ue-client',
      UBER_EATS_CLIENT_SECRET: 'ue-secret',
      UBER_EATS_WEBHOOK_SECRET: 'ue-webhook',
      DELIVEROO_CLIENT_ID: 'del-client',
      DELIVEROO_CLIENT_SECRET: 'del-secret',
      DELIVEROO_WEBHOOK_SECRET: 'del-webhook',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing AWS_REGION', () => {
    const { AWS_REGION: _, ...rest } = validPackageEnv
    const result = packageEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing OPENAI_API_KEY', () => {
    const { OPENAI_API_KEY: _, ...rest } = validPackageEnv
    const result = packageEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects OPENAI_API_KEY without sk- prefix', () => {
    const result = packageEnvSchema.safeParse({
      ...validPackageEnv,
      OPENAI_API_KEY: 'bad-key',
    })
    expect(result.success).toBe(false)
  })
})

describe('siteEnvSchema', () => {
  const validSiteEnv = {
    NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
    BETTER_AUTH_SECRET: 'my-secret-key',
  }

  it('accepts empty object (all fields optional)', () => {
    const result = siteEnvSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts all optional fields', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      CONVEX_DEPLOYMENT: 'dev:test-123',
      CONVEX_SITE_URL: 'https://test.convex.site',
      ENCRYPTION_KEY: 'a'.repeat(64),
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      AWS_SES_FROM_EMAIL: 'noreply@test.com',
      DELIVEROO_IS_SANDBOX: 'true',
      UBER_EATS_SANDBOX_MODE: 'false',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid NEXT_PUBLIC_CONVEX_URL (not a url)', () => {
    const result = siteEnvSchema.safeParse({
      NEXT_PUBLIC_CONVEX_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts missing BETTER_AUTH_SECRET', () => {
    const result = siteEnvSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid ENCRYPTION_KEY (not 64 hex chars)', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      ENCRYPTION_KEY: 'too-short',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid 64-char hex ENCRYPTION_KEY', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    })
    expect(result.success).toBe(true)
  })

  it('rejects STRIPE_SECRET_KEY without sk_ prefix', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      STRIPE_SECRET_KEY: 'bad_key',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid DELIVEROO_IS_SANDBOX value', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      DELIVEROO_IS_SANDBOX: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL for CONVEX_SITE_URL', () => {
    const result = siteEnvSchema.safeParse({
      ...validSiteEnv,
      CONVEX_SITE_URL: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('siteEnvRequiredSchema', () => {
  const VALID = {
    NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
    CONVEX_SITE_URL: 'https://test.convex.site',
    SITE_URL: 'https://resto.example.com',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    ENCRYPTION_KEY: 'a'.repeat(64),
    AWS_S3_BUCKET_NAME: 'resto-bucket',
    AWS_S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
    AWS_SES_FROM_EMAIL: 'noreply@resto.example.com',
  }

  it('accepts a fully configured deployment', () => {
    expect(siteEnvRequiredSchema.safeParse(VALID).success).toBe(true)
  })

  it('rejects an empty object', () => {
    expect(siteEnvRequiredSchema.safeParse({}).success).toBe(false)
  })

  // The whole point of the split: `opt()` mapped '' to undefined, so a template
  // copied and left unfilled validated clean.
  it.each(Object.keys(VALID))('rejects %s left as an empty string', (name) => {
    const result = siteEnvRequiredSchema.safeParse({ ...VALID, [name]: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((i) => i.path[0] === name)).toBe(true)
  })

  it.each(Object.keys(VALID))('rejects %s when absent', (name) => {
    const { [name]: _dropped, ...rest } = VALID
    expect(siteEnvRequiredSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a BETTER_AUTH_SECRET shorter than 32 characters', () => {
    const result = siteEnvRequiredSchema.safeParse({
      ...VALID,
      BETTER_AUTH_SECRET: 'x'.repeat(31),
    })
    expect(result.success).toBe(false)
  })

  it('rejects AWS_S3_PUBLIC_BASE_URL that is not a URL', () => {
    const result = siteEnvRequiredSchema.safeParse({
      ...VALID,
      AWS_S3_PUBLIC_BASE_URL: 'cdn.example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('siteEnvOptionalSchema', () => {
  it('accepts an empty object', () => {
    expect(siteEnvOptionalSchema.safeParse({}).success).toBe(true)
  })

  it('declares every variable the runtime reads', () => {
    const declared = Object.keys(siteEnvOptionalSchema._def.shape)
    for (const name of [
      'AWS_S3_PUBLIC_BASE_URL' in {} ? '' : 'ADMIN_BOOTSTRAP_TOKEN',
      'NEXT_PUBLIC_SITE_URL',
      'BID_APP_URL',
      'UNSPLASH_ACCESS_KEY',
      'AUTH_ALLOW_UNVERIFIED_EMAIL',
      'NEXT_PUBLIC_CONVEX_SITE_URL',
      'CONTACT_EMAIL',
      'BID_NOTIFY_EMAIL',
      'STRIPE_BID_SECRET_KEY',
      'STRIPE_BID_WEBHOOK_SECRET',
      'STRIPE_BID_PRICE_MAINTENANCE',
    ]) {
      expect(declared).toContain(name)
    }
  })

  it('rejects an unknown AUTH_ALLOW_UNVERIFIED_EMAIL value', () => {
    expect(
      siteEnvOptionalSchema.safeParse({ AUTH_ALLOW_UNVERIFIED_EMAIL: 'yes' }).success
    ).toBe(false)
  })

  it('holds every feature group to all-or-nothing', () => {
    for (const { vars } of SITE_FEATURE_GROUPS) {
      const [first, ...rest] = vars
      expect(rest.length).toBeGreaterThan(0)

      const partial = siteEnvOptionalSchema.safeParse({ [first]: placeholderFor(first) })
      expect(partial.success).toBe(false)

      const full = siteEnvOptionalSchema.safeParse(
        Object.fromEntries(vars.map((v) => [v, placeholderFor(v)]))
      )
      expect(full.success).toBe(true)
    }
  })
})

/** A value each feature-group variable will actually accept. */
function placeholderFor(name: string): string {
  if (name.endsWith('_WEBHOOK_SECRET')) return 'whsec_test'
  if (name.startsWith('STRIPE_') && name.endsWith('_SECRET_KEY')) return 'sk_test'
  if (name === 'STRIPE_SECRET_KEY') return 'sk_test'
  if (name === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test'
  if (name.endsWith('_URL')) return 'https://app.example.com'
  if (name.endsWith('_EMAIL')) return 'ops@example.com'
  return 'value'
}

// The reader and the boot tiers are two contracts over one variable set. If a
// variable is added to boot and forgotten in the reader, `getSiteEnv()` silently
// stops returning it — the exact class of silent failure this split exists to end.
describe('siteEnvSchema (reader)', () => {
  it('covers every variable both boot tiers declare', () => {
    const reader = Object.keys(siteEnvSchema._def.shape)
    const boot = [
      ...Object.keys(siteEnvRequiredSchema._def.shape),
      ...Object.keys(siteEnvOptionalSchema._def.shape),
    ]
    for (const name of boot) expect(reader).toContain(name)
    expect(reader).toHaveLength(boot.length)
  })

  it('never throws on a value the strict tier would reject', () => {
    const result = siteEnvSchema.safeParse({
      BETTER_AUTH_SECRET: 'short',
      AWS_S3_PUBLIC_BASE_URL: 'cdn.example.com',
      BID_APP_URL: 'not-a-url',
      CONTACT_EMAIL: 'not-an-email',
    })
    expect(result.success).toBe(true)
  })
})
