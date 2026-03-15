import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getPackageEnv, getSiteEnv, _resetEnvCache } from '../getters'

const VALID_PACKAGE_ENV = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  OPENAI_API_KEY: 'sk-test123456',
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
    expect(env.AWS_REGION).toBe('eu-west-1')
    expect(env.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE')
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
    process.env.AWS_REGION = 'us-east-1'
    const second = getPackageEnv()

    expect(first.AWS_REGION).toBe('eu-west-1')
    expect(second.AWS_REGION).toBe('us-east-1')
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

  it('throws ZodError when required vars are missing', () => {
    expect(() => getSiteEnv()).toThrow()
  })
})
