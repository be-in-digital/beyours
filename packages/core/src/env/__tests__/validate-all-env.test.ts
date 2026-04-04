import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateAllEnv, formatEnvReport, _resetEnvCache } from '../getters'

const VALID_PACKAGE_ENV = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  OPENAI_API_KEY: 'sk-test123456',
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

  it('returns ok=true when all required package vars are set', () => {
    Object.assign(process.env, VALID_PACKAGE_ENV)
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(true)
    expect(missing).toHaveLength(0)
  })

  it('returns missing package vars when AWS_REGION is absent', () => {
    Object.assign(process.env, {
      ...VALID_PACKAGE_ENV,
      AWS_REGION: undefined,
    })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'AWS_REGION' && m.tier === 'package')).toBe(true)
  })

  it('returns missing for OPENAI_API_KEY with wrong prefix', () => {
    Object.assign(process.env, {
      ...VALID_PACKAGE_ENV,
      OPENAI_API_KEY: 'bad-key',
    })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'OPENAI_API_KEY' && m.tier === 'package')).toBe(true)
  })

  it('reports site-level errors when invalid URL is provided', () => {
    Object.assign(process.env, {
      ...VALID_PACKAGE_ENV,
      NEXT_PUBLIC_CONVEX_URL: 'not-a-url',
    })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(missing.some((m) => m.name === 'NEXT_PUBLIC_CONVEX_URL' && m.tier === 'site')).toBe(true)
  })

  it('ignores empty optional strings (treated as undefined)', () => {
    Object.assign(process.env, {
      ...VALID_PACKAGE_ENV,
      STRIPE_SECRET_KEY: '',
      DELIVEROO_CLIENT_ID: '',
    })
    const { ok } = validateAllEnv()
    expect(ok).toBe(true)
  })
})

describe('formatEnvReport', () => {
  it('formats package-level missing vars', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'Required', tier: 'package' },
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

  it('formats both tiers together', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'Required', tier: 'package' },
      { name: 'STRIPE_SECRET_KEY', message: 'Invalid', tier: 'site' },
    ])
    expect(report).toContain('Package-level')
    expect(report).toContain('Site-level')
    expect(report).toContain('2 variable(s)')
  })

  it('includes .env.example hint', () => {
    const report = formatEnvReport([
      { name: 'AWS_REGION', message: 'Required', tier: 'package' },
    ])
    expect(report).toContain('.env.example')
    expect(report).toContain('.env.local')
  })
})
