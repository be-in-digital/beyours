import { describe, expect, it, vi } from 'vitest'
import {
  DEVELOPMENT_TRACES_SAMPLE_RATE,
  PRODUCTION_TRACES_SAMPLE_RATE,
  isSentryDsn,
  resolveSentryEnvironment,
  resolveSentryOptions,
  resolveSentryRelease,
  scrubSentryEvent,
  type SentryEnvSource,
} from '../index'

const DSN = 'https://abc123def456@o4507.ingest.de.sentry.io/4508'
const OTHER_DSN = 'https://999zzz@o1111.ingest.us.sentry.io/2222'

/** Never falls back to the real `process.env` — these must be hermetic. */
const resolve = (env: SentryEnvSource, warn = () => {}) =>
  resolveSentryOptions('browser', env, warn)

describe('isSentryDsn', () => {
  it('accepts a real DSN', () => {
    expect(isSentryDsn(DSN)).toBe(true)
    expect(isSentryDsn(OTHER_DSN)).toBe(true)
  })

  it('accepts a self-hosted DSN on a plain host', () => {
    expect(isSentryDsn('https://key@sentry.beyours.fr/12')).toBe(true)
  })

  it('rejects a URL that is not a DSN', () => {
    // Passes the schema's `.url()` and is exactly what an operator pastes when
    // they copy the project page instead of the client key.
    expect(isSentryDsn('https://sentry.io/organizations/beyours/projects/pizza')).toBe(false)
  })

  it('rejects a DSN with no project id', () => {
    expect(isSentryDsn('https://abc123@o4507.ingest.de.sentry.io/')).toBe(false)
  })

  it('rejects a DSN with no public key', () => {
    expect(isSentryDsn('https://o4507.ingest.de.sentry.io/4508')).toBe(false)
  })

  it('rejects undefined and empty', () => {
    expect(isSentryDsn(undefined)).toBe(false)
    expect(isSentryDsn('')).toBe(false)
  })
})

describe('resolveSentryOptions — when it stays off', () => {
  it('returns null with no DSN at all', () => {
    expect(resolve({})).toBeNull()
  })

  it('returns null on the empty string a copied .env.example leaves behind', () => {
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: '' })).toBeNull()
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: '   ' })).toBeNull()
  })

  it('returns null AND warns when the DSN is set but unusable', () => {
    const warn = vi.fn()
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: 'https://sentry.io/beyours' }, warn)).toBeNull()

    expect(warn).toHaveBeenCalledTimes(1)
    const [message] = warn.mock.calls[0] as [string]
    // The variable has to be named: the whole point is that the operator who
    // set it stops believing monitoring is live.
    expect(message).toContain('NEXT_PUBLIC_SENTRY_DSN')
    expect(message).toContain('browser')
  })

  it('does not warn when the DSN is simply absent', () => {
    const warn = vi.fn()
    resolve({}, warn)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('resolveSentryOptions — when it is on', () => {
  it('passes the trimmed DSN through', () => {
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: `  ${DSN}  ` })?.dsn).toBe(DSN)
  })

  it('never sends PII', () => {
    // A restaurant checkout carries names, addresses and phone numbers.
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: DSN })?.sendDefaultPii).toBe(false)
  })

  it('tags the runtime it was built for', () => {
    const env = { NEXT_PUBLIC_SENTRY_DSN: DSN }
    expect(resolveSentryOptions('server', env, () => {})?.initialScope.tags.runtime).toBe('server')
    expect(resolveSentryOptions('edge', env, () => {})?.initialScope.tags.runtime).toBe('edge')
  })

  it('tags the site host so two deployments never merge silently', () => {
    const options = resolve({
      NEXT_PUBLIC_SENTRY_DSN: DSN,
      NEXT_PUBLIC_SITE_URL: 'https://pizzeria-napoli.fr/menu',
    })
    expect(options?.initialScope.tags.site).toBe('pizzeria-napoli.fr')
  })

  it('omits the site tag rather than inventing one', () => {
    expect(resolve({ NEXT_PUBLIC_SENTRY_DSN: DSN })?.initialScope.tags.site).toBeUndefined()
    expect(
      resolve({ NEXT_PUBLIC_SENTRY_DSN: DSN, NEXT_PUBLIC_SITE_URL: 'not a url' })?.initialScope
        .tags.site,
    ).toBeUndefined()
  })
})

describe('resolveSentryEnvironment', () => {
  it('prefers the explicit override', () => {
    expect(
      resolveSentryEnvironment({
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'staging',
        VERCEL_ENV: 'preview',
        NODE_ENV: 'production',
      }),
    ).toBe('staging')
  })

  it('keeps a client preview build out of its production issues', () => {
    // The build is NODE_ENV=production either way; VERCEL_ENV is what tells
    // the two apart.
    expect(resolveSentryEnvironment({ VERCEL_ENV: 'preview', NODE_ENV: 'production' })).toBe(
      'preview',
    )
    expect(resolveSentryEnvironment({ VERCEL_ENV: 'production', NODE_ENV: 'production' })).toBe(
      'production',
    )
  })

  it('falls back to NODE_ENV, then to development', () => {
    expect(resolveSentryEnvironment({ NODE_ENV: 'test' })).toBe('test')
    expect(resolveSentryEnvironment({})).toBe('development')
  })

  it('treats an empty override as unset', () => {
    expect(resolveSentryEnvironment({ NEXT_PUBLIC_SENTRY_ENVIRONMENT: '', VERCEL_ENV: 'preview' }))
      .toBe('preview')
  })
})

describe('resolveSentryRelease', () => {
  it('prefers the pinned release over the commit', () => {
    expect(
      resolveSentryRelease({
        NEXT_PUBLIC_SENTRY_RELEASE: 'pizzeria@2.1.0',
        VERCEL_GIT_COMMIT_SHA: 'deadbeef',
      }),
    ).toBe('pizzeria@2.1.0')
  })

  it('falls back to the commit sha', () => {
    expect(resolveSentryRelease({ VERCEL_GIT_COMMIT_SHA: 'deadbeef' })).toBe('deadbeef')
  })

  it('is undefined rather than empty when nothing pins one', () => {
    expect(resolveSentryRelease({})).toBeUndefined()
    expect(resolveSentryRelease({ NEXT_PUBLIC_SENTRY_RELEASE: '' })).toBeUndefined()
  })
})

describe('traces sample rate', () => {
  const rateFor = (env: SentryEnvSource) =>
    resolve({ NEXT_PUBLIC_SENTRY_DSN: DSN, ...env })?.tracesSampleRate

  it('samples production down so errors are not lost behind traces', () => {
    expect(rateFor({ NODE_ENV: 'production' })).toBe(PRODUCTION_TRACES_SAMPLE_RATE)
    expect(rateFor({ VERCEL_ENV: 'production' })).toBe(PRODUCTION_TRACES_SAMPLE_RATE)
  })

  it('traces everything outside production', () => {
    expect(rateFor({ NODE_ENV: 'development' })).toBe(DEVELOPMENT_TRACES_SAMPLE_RATE)
    expect(rateFor({ VERCEL_ENV: 'preview', NODE_ENV: 'production' })).toBe(
      DEVELOPMENT_TRACES_SAMPLE_RATE,
    )
  })

  it('honours a per-client override, including 0', () => {
    expect(
      rateFor({ NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0.5' }),
    ).toBe(0.5)
    expect(rateFor({ NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '0' })).toBe(0)
    expect(rateFor({ NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '1' })).toBe(1)
  })

  it('ignores a rate that is not a usable number', () => {
    for (const bad of ['', 'half', '2', '-1', 'NaN']) {
      expect(
        rateFor({ NODE_ENV: 'production', NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: bad }),
      ).toBe(PRODUCTION_TRACES_SAMPLE_RATE)
    }
  })
})

describe('isolation between two clients', () => {
  it('produces two unrelated configurations from two environments', () => {
    const napoli = resolve({
      NEXT_PUBLIC_SENTRY_DSN: DSN,
      NEXT_PUBLIC_SITE_URL: 'https://napoli.fr',
      VERCEL_ENV: 'production',
    })
    const burger = resolve({
      NEXT_PUBLIC_SENTRY_DSN: OTHER_DSN,
      NEXT_PUBLIC_SITE_URL: 'https://burger-lyon.fr',
      VERCEL_ENV: 'production',
    })

    expect(napoli?.dsn).not.toBe(burger?.dsn)
    expect(napoli?.initialScope.tags.site).not.toBe(burger?.initialScope.tags.site)
  })
})

describe('scrubSentryEvent', () => {
  it('keeps only the allowlisted headers', () => {
    // Exactly what a live SDK sent before this existed.
    const event = scrubSentryEvent({
      request: {
        headers: {
          host: 'napoli.fr',
          'user-agent': 'Mozilla/5.0',
          accept: '*/*',
          cookie: 'session=SECRET-SESSION-VALUE; beid_locale=fr',
          authorization: 'Bearer SECRET-TOKEN',
          'x-forwarded-for': '81.2.3.4',
        },
      },
    })

    expect(event.request?.headers).toEqual({
      host: 'napoli.fr',
      'user-agent': 'Mozilla/5.0',
      accept: '*/*',
    })
  })

  it('matches header names case-insensitively', () => {
    const event = scrubSentryEvent({
      request: { headers: { Cookie: 'session=x', Host: 'napoli.fr' } },
    })
    expect(event.request?.headers).toEqual({ Host: 'napoli.fr' })
  })

  it('empties the parsed cookie jar, which the allowlist never sees', () => {
    const event = scrubSentryEvent({ request: { cookies: { session: 'SECRET' } } })
    expect(event.request?.cookies).toEqual({})
  })

  it('redacts a password-reset token out of the url', () => {
    const event = scrubSentryEvent({
      request: { url: 'https://napoli.fr/reset-password?token=LIVE-RESET-TOKEN&lang=fr' },
    })
    expect(event.request?.url).toBe('https://napoli.fr/reset-password?token=[Filtered]&lang=fr')
  })

  it("redacts the order view token that opens a customer's order", () => {
    const event = scrubSentryEvent({
      request: { url: 'https://napoli.fr/order/abc?token=VIEW-TOKEN' },
    })
    expect(event.request?.url).toBe('https://napoli.fr/order/abc?token=[Filtered]')
  })

  it('leaves a url with no query string alone', () => {
    const url = 'https://napoli.fr/menu'
    expect(scrubSentryEvent({ request: { url } }).request?.url).toBe(url)
  })

  it('redacts every query_string shape Sentry can produce', () => {
    expect(
      scrubSentryEvent({ request: { query_string: 'token=SECRET&page=2' } }).request?.query_string,
    ).toBe('token=[Filtered]&page=2')

    expect(
      scrubSentryEvent({ request: { query_string: { token: 'SECRET', page: '2' } } }).request
        ?.query_string,
    ).toEqual({ token: '[Filtered]', page: '2' })

    expect(
      scrubSentryEvent({
        request: {
          query_string: [
            ['token', 'SECRET'],
            ['page', '2'],
          ],
        },
      }).request?.query_string,
    ).toEqual([
      ['token', '[Filtered]'],
      ['page', '2'],
    ])
  })

  it('survives an event with no request block', () => {
    expect(scrubSentryEvent({})).toEqual({})
  })

  it('is what the resolved options install on both send hooks', () => {
    // A transaction carries the same request block as an error, so filtering
    // only errors would leak the same cookie on the next traced request.
    const options = resolve({ NEXT_PUBLIC_SENTRY_DSN: DSN })
    expect(options?.beforeSend).toBe(scrubSentryEvent)
    expect(options?.beforeSendTransaction).toBe(scrubSentryEvent)
  })
})

describe('scrubSentryEvent — url edge cases', () => {
  it('keeps everything after a second question mark', () => {
    const event = scrubSentryEvent({
      request: { url: 'https://napoli.fr/order/1?token=SECRET&next=/a?b=2' },
    })
    expect(event.request?.url).toBe('https://napoli.fr/order/1?token=[Filtered]&next=/a?b=2')
  })

  it('handles a trailing question mark with no query', () => {
    expect(scrubSentryEvent({ request: { url: 'https://napoli.fr/menu?' } }).request?.url).toBe(
      'https://napoli.fr/menu?',
    )
  })

  it('leaves a valueless parameter alone', () => {
    expect(
      scrubSentryEvent({ request: { url: 'https://napoli.fr/menu?debug&token=X' } }).request?.url,
    ).toBe('https://napoli.fr/menu?debug&token=[Filtered]')
  })
})
