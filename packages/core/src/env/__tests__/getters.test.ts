import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPackageEnv, getSiteEnv, _resetEnvCache } from '../getters'

// AWS moved to the site tier on 2026-08-28 — one account per client.
// See apps/docs/deployment/aws-ownership.md.
const VALID_PACKAGE_ENV = {
  OPENAI_API_KEY: 'sk-test123456',
}

const AWS_ENV = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
}

const VALID_SITE_ENV = {
  NEXT_PUBLIC_CONVEX_URL: 'https://test.convex.cloud',
  BETTER_AUTH_SECRET: 'my-secret-key',
}

describe('getPackageEnv', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    _resetEnvCache()
  })

  afterEach(() => {
    process.env = originalEnv
    _resetEnvCache()
  })

  it('returns validated env when all required vars are set', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV)
    const env = getPackageEnv()
    expect(env.OPENAI_API_KEY).toBe('sk-test123456')
  })

  it('does not carry the AWS credentials — they belong to the client', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV, AWS_ENV)
    const env = getPackageEnv()
    // A regression back to the package tier would put a fleet-wide key in
    // every deployment again, which is what #199 and #200 are about.
    expect(env).not.toHaveProperty('AWS_REGION')
    expect(env).not.toHaveProperty('AWS_ACCESS_KEY_ID')
    expect(env).not.toHaveProperty('AWS_SECRET_ACCESS_KEY')
  })

  it('reads the AWS credentials off the site tier instead', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV, AWS_ENV)
    const site = getSiteEnv()
    expect(site.AWS_REGION).toBe('eu-west-1')
    expect(site.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE')
  })

  it('returns memoized result on subsequent calls', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV)
    const first = getPackageEnv()
    const second = getPackageEnv()
    expect(first).toBe(second)
  })

  it('throws ZodError when required vars are missing', () => {
    expect(() => getPackageEnv()).toThrow()
  })

  it('resets cache when _resetEnvCache is called', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV)
    const first = getPackageEnv()

    _resetEnvCache()
    process.env.OPENAI_API_KEY = 'sk-rotated'
    const second = getPackageEnv()

    expect(first.OPENAI_API_KEY).toBe('sk-test123456')
    expect(second.OPENAI_API_KEY).toBe('sk-rotated')
  })
})

describe('getSiteEnv', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    _resetEnvCache()
  })

  afterEach(() => {
    process.env = originalEnv
    _resetEnvCache()
  })

  it('returns validated env when required vars are set', () => {
    Object.assign(process.env, VALID_SITE_ENV)
    const env = getSiteEnv()
    expect(env.NEXT_PUBLIC_CONVEX_URL).toBe('https://test.convex.cloud')
    expect(env.BETTER_AUTH_SECRET).toBe('my-secret-key')
  })

  it('returns memoized result on subsequent calls', () => {
    Object.assign(process.env, VALID_SITE_ENV)
    const first = getSiteEnv()
    const second = getSiteEnv()
    expect(first).toBe(second)
  })

  it('returns empty optional fields when no vars are set', () => {
    const env = getSiteEnv()
    expect(env.NEXT_PUBLIC_CONVEX_URL).toBeUndefined()
    expect(env.BETTER_AUTH_SECRET).toBeUndefined()
  })
})
