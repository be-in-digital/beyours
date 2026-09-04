import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isSandbox,
  checkSandboxFlags,
  SANDBOX_FLAGS,
  SANDBOX_FLAG_RULES,
  _resetSandboxWarnings,
} from '../sandbox'
import type { SandboxPlatform } from '../sandbox'
import { validateAllEnv, _resetEnvCache } from '../getters'

const FLAG_NAMES = Object.values(SANDBOX_FLAGS)
const PLATFORMS: SandboxPlatform[] = ['uberEats', 'deliveroo', 'paypal']

describe('isSandbox', () => {
  let originalEnv: NodeJS.ProcessEnv
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalEnv = { ...process.env }
    for (const name of FLAG_NAMES) delete process.env[name]
    _resetSandboxWarnings()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    _resetSandboxWarnings()
    warn.mockRestore()
  })

  // The defect this module exists for. Every call site used to read
  // `site.X === "true"`, so an UNSET variable meant production: a deployment
  // that had never heard of the flag pointed sandbox credentials at the live
  // Uber Eats, the live Deliveroo and the live PayPal.
  it.each(PLATFORMS)('falls back to sandbox when %s has no flag set', (platform) => {
    expect(isSandbox(platform)).toBe(true)
  })

  it.each(PLATFORMS)('reads "true" as sandbox for %s', (platform) => {
    process.env[SANDBOX_FLAGS[platform]] = 'true'
    expect(isSandbox(platform)).toBe(true)
  })

  it.each(PLATFORMS)('reads "false" as production for %s', (platform) => {
    process.env[SANDBOX_FLAGS[platform]] = 'false'
    expect(isSandbox(platform)).toBe(false)
  })

  // A template copied and left unfilled arrives as '', exactly like unset.
  it.each(PLATFORMS)('treats an empty value for %s as unset', (platform) => {
    process.env[SANDBOX_FLAGS[platform]] = ''
    expect(isSandbox(platform)).toBe(true)
  })

  // The direction that matters: no typo may ever open the live host.
  it.each(['yes', 'no', 'FALSE', 'False', '0', '1', 'off', 'production'])(
    'refuses to read %s as production',
    (junk) => {
      process.env.UBER_EATS_SANDBOX_MODE = junk
      expect(isSandbox('uberEats')).toBe(true)
    }
  )

  it('tolerates surrounding whitespace on both values', () => {
    process.env.DELIVEROO_IS_SANDBOX = '  false  '
    expect(isSandbox('deliveroo')).toBe(false)

    process.env.DELIVEROO_IS_SANDBOX = ' true '
    expect(isSandbox('deliveroo')).toBe(true)
  })

  it('reads each platform off its own variable', () => {
    process.env.UBER_EATS_SANDBOX_MODE = 'false'
    expect(isSandbox('uberEats')).toBe(false)
    expect(isSandbox('deliveroo')).toBe(true)
    expect(isSandbox('paypal')).toBe(true)
  })

  it('warns once per flag, not once per call', () => {
    isSandbox('uberEats')
    isSandbox('uberEats')
    isSandbox('uberEats')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('UBER_EATS_SANDBOX_MODE')
  })

  it('names the offending value when the flag is malformed', () => {
    process.env.PAYPAL_SANDBOX_MODE = 'oui'
    isSandbox('paypal')
    expect(String(warn.mock.calls[0][0])).toContain('"oui"')
  })

  it('says nothing when the mode is declared', () => {
    process.env.UBER_EATS_SANDBOX_MODE = 'false'
    process.env.DELIVEROO_IS_SANDBOX = 'true'
    isSandbox('uberEats')
    isSandbox('deliveroo')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('checkSandboxFlags', () => {
  // Demanding PAYPAL_SANDBOX_MODE from a restaurant that does not take PayPal
  // is noise, and noise is what gets suppressed.
  it('is silent when no integration is configured', () => {
    expect(checkSandboxFlags({})).toEqual([])
  })

  it.each(SANDBOX_FLAG_RULES)(
    'requires $flag once $feature is configured',
    ({ flag, enabledBy }) => {
      const problems = checkSandboxFlags({ [enabledBy[0]]: 'a-credential' })
      expect(problems.map((p) => p.name)).toContain(flag)
    }
  )

  it.each(SANDBOX_FLAG_RULES)(
    'accepts $feature declared as "true"',
    ({ flag, enabledBy }) => {
      expect(
        checkSandboxFlags({ [enabledBy[0]]: 'a-credential', [flag]: 'true' })
      ).toEqual([])
    }
  )

  it.each(SANDBOX_FLAG_RULES)(
    'accepts $feature declared as "false"',
    ({ flag, enabledBy }) => {
      expect(
        checkSandboxFlags({ [enabledBy[0]]: 'a-credential', [flag]: 'false' })
      ).toEqual([])
    }
  )

  it.each(SANDBOX_FLAG_RULES)(
    'rejects a junk value for $flag and quotes it back',
    ({ flag, enabledBy }) => {
      const [problem] = checkSandboxFlags({
        [enabledBy[0]]: 'a-credential',
        [flag]: 'yes',
      })
      expect(problem?.name).toBe(flag)
      expect(problem?.message).toContain('"yes"')
    }
  )

  // An empty value is a template copied and left unfilled, not a declaration.
  it.each(SANDBOX_FLAG_RULES)(
    'treats an empty $flag as undeclared',
    ({ flag, enabledBy }) => {
      const problems = checkSandboxFlags({
        [enabledBy[0]]: 'a-credential',
        [flag]: '   ',
      })
      expect(problems.map((p) => p.name)).toContain(flag)
    }
  )

  it('ignores a credential left as an empty string', () => {
    expect(checkSandboxFlags({ UBER_EATS_CLIENT_ID: '' })).toEqual([])
  })

  // The brand/site ids are e2e fixtures — a live deployment reads them off its
  // stored Deliveroo connection. Gating a deploy on them would fire on a
  // machine that only runs the Deliveroo scenarios.
  it('does not treat the Deliveroo e2e ids as the integration being on', () => {
    expect(checkSandboxFlags({ DELIVEROO_BRAND_ID: 'brand-1' })).toEqual([])
    expect(checkSandboxFlags({ DELIVEROO_SITE_ID: 'site-1' })).toEqual([])
  })

  it('reports every integration that owes an answer', () => {
    const problems = checkSandboxFlags({
      UBER_EATS_CLIENT_ID: 'ue',
      DELIVEROO_CLIENT_ID: 'del',
      PAYPAL_CLIENT_ID: 'pp',
    })
    expect(problems.map((p) => p.name).sort()).toEqual(
      [...FLAG_NAMES].sort()
    )
  })
})

// The requirement is enforced at BOOT, where it is loud, early and fixable —
// never as a throw inside a webhook, where it would become a lost order.
describe('validateAllEnv — sandbox declarations', () => {
  const VALID_ENV = {
    OPENAI_API_KEY: 'sk-test123456',
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

  let originalEnv: NodeJS.ProcessEnv

  const setEnv = (vars: Record<string, string>): void => {
    process.env = { ...vars } as NodeJS.ProcessEnv
    _resetEnvCache()
  }

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
    _resetEnvCache()
  })

  it('boots a deployment that uses none of the three integrations', () => {
    setEnv(VALID_ENV)
    expect(validateAllEnv().ok).toBe(true)
  })

  it('refuses to boot Uber Eats with no declared mode', () => {
    setEnv({
      ...VALID_ENV,
      UBER_EATS_CLIENT_ID: 'ue-client',
      UBER_EATS_CLIENT_SECRET: 'ue-secret',
    })
    const { ok, missing } = validateAllEnv()
    expect(ok).toBe(false)
    expect(
      missing.some(
        (m) => m.name === 'UBER_EATS_SANDBOX_MODE' && m.tier === 'feature'
      )
    ).toBe(true)
  })

  it('boots Uber Eats once the mode is declared', () => {
    setEnv({
      ...VALID_ENV,
      UBER_EATS_CLIENT_ID: 'ue-client',
      UBER_EATS_CLIENT_SECRET: 'ue-secret',
      UBER_EATS_SANDBOX_MODE: 'false',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  it('refuses to boot Deliveroo with no declared mode', () => {
    setEnv({
      ...VALID_ENV,
      DELIVEROO_CLIENT_ID: 'del-client',
      DELIVEROO_CLIENT_SECRET: 'del-secret',
    })
    const { missing } = validateAllEnv()
    expect(missing.some((m) => m.name === 'DELIVEROO_IS_SANDBOX')).toBe(true)
  })

  it('boots Deliveroo once the mode is declared', () => {
    setEnv({
      ...VALID_ENV,
      DELIVEROO_CLIENT_ID: 'del-client',
      DELIVEROO_CLIENT_SECRET: 'del-secret',
      DELIVEROO_IS_SANDBOX: 'true',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  it('refuses to boot PayPal with no declared mode', () => {
    setEnv({
      ...VALID_ENV,
      PAYPAL_CLIENT_ID: 'pp-id',
      PAYPAL_CLIENT_SECRET: 'pp-secret',
    })
    const { missing } = validateAllEnv()
    expect(missing.some((m) => m.name === 'PAYPAL_SANDBOX_MODE')).toBe(true)
  })

  it('boots PayPal once the mode is declared', () => {
    setEnv({
      ...VALID_ENV,
      PAYPAL_CLIENT_ID: 'pp-id',
      PAYPAL_CLIENT_SECRET: 'pp-secret',
      PAYPAL_SANDBOX_MODE: 'false',
    })
    expect(validateAllEnv().ok).toBe(true)
  })

  // A `.env` copied from the template and left unfilled must not read as a
  // configured integration.
  it('does not fire on credentials left as empty strings', () => {
    setEnv({
      ...VALID_ENV,
      UBER_EATS_CLIENT_ID: '',
      DELIVEROO_CLIENT_ID: '',
      PAYPAL_CLIENT_ID: '',
    })
    expect(validateAllEnv().ok).toBe(true)
  })
})
