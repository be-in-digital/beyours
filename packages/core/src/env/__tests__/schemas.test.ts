import { describe, it, expect } from 'vitest'
import { packageEnvSchema, siteEnvSchema } from '../schemas'

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

  it('accepts minimal required fields', () => {
    const result = siteEnvSchema.safeParse(validSiteEnv)
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

  it('rejects missing NEXT_PUBLIC_CONVEX_URL', () => {
    const { NEXT_PUBLIC_CONVEX_URL: _, ...rest } = validSiteEnv
    const result = siteEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing BETTER_AUTH_SECRET', () => {
    const { BETTER_AUTH_SECRET: _, ...rest } = validSiteEnv
    const result = siteEnvSchema.safeParse(rest)
    expect(result.success).toBe(false)
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
